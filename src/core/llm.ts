import { getConfig } from './config.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import { ProjectContext, formatContextForLLM, readRequestedFiles } from './scanner.js';
import { LLMResponse } from './types.js';
import { getRoleModifierPrompt } from './roles.js';
import { getLLMAdapter } from './adapters/factory.js';
import { Message, CompletionResult } from './adapters/types.js';
import { getLogger } from './logger.js';

// ---------------------------------------------------------------------------
// DETECCIÓN DE TRUNCAMIENTO
// ---------------------------------------------------------------------------
export function isSpecTruncated(spec: string, finishReason?: string): boolean {
  if (finishReason === 'length') return true;

  const trimmed = spec.trim();
  if (trimmed.length === 0) return true;

  const lastLine = trimmed.split('\n').pop()?.trim() || '';
  if (lastLine.length > 0 && !/[.!?;:`})\]]$/.test(lastLine)) return true;

  const requiredSections = [
    'Objetivo y Alcance Técnico',
    'Componentes y Archivos Afectados',
    'Interfaces, Endpoints, DTOs',
    'Plan de Pruebas',
  ];
  for (const section of requiredSections) {
    if (!spec.includes(section)) return true;
  }

  const codeBlocks = (spec.match(/```/g) || []).length;
  if (codeBlocks % 2 !== 0) return true;

  return false;
}

// ---------------------------------------------------------------------------
// PARSEO DE JSON DEL LLM
// ---------------------------------------------------------------------------
export function parseLLMJson(rawText: string): LLMResponse {
  try {
    let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (markdownMatch && markdownMatch[1]) {
      cleaned = markdownMatch[1].trim();
    } else {
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace !== -1) {
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace === -1 || lastBrace < firstBrace) {
          cleaned = cleaned.substring(firstBrace);
          if (!cleaned.endsWith('"}')) {
            if (cleaned.endsWith('"')) cleaned += '}';
            else cleaned += '"}';
          }
        } else {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
        }
      }
    }

    return JSON.parse(cleaned) as LLMResponse;
  } catch (err: any) {
    getLogger().warn('Error parseando JSON estricto, intentando fallback', { error: err.message });

    const specMatch = rawText.match(/"specContent"\s*:\s*"([\s\S]*)/);
    if (specMatch && specMatch[1]) {
      let partialSpec = specMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      if (partialSpec.endsWith('"}')) partialSpec = partialSpec.slice(0, -2);
      if (partialSpec.endsWith('"')) partialSpec = partialSpec.slice(0, -1);

      return {
        status: 'READY',
        detectedContextSummary: 'JSON recuperado por fallback de longitud.',
        specContent: partialSpec,
        finishReason: 'length',
      };
    }

    throw new Error(`Error parseando respuesta JSON:\nDetalle: ${err.message}\nRaw:\n${rawText}`);
  }
}

// ---------------------------------------------------------------------------
// POST-PROCESAMIENTO: Extraer peticiones de archivo de questions
// ---------------------------------------------------------------------------
const FILE_PATH_PATTERN = /(?:[\w./-]+\/[\w./-]+\.(?:tsx?|jsx?|vue|svelte|json|css|scss|md|yaml|yml|sql|prisma|env)|(?:tailwind|vite|next|nuxt|webpack|rollup|esbuild|postcss|eslint|prettier|jest|vitest|playwright|cypress|tsconfig|package|docker-compose|angular)\.config\.(?:ts|js|json|mjs|cjs)|\.env[\w.]*)/gi;

export function extractFileReadRequests(questions: string[]): {
  cleanQuestions: string[];
  filesToRead: string[];
} {
  const filesToRead: string[] = [];
  const cleanQuestions: string[] = [];

  for (const q of questions) {
    const matches = q.match(FILE_PATH_PATTERN);
    if (matches && matches.length > 0) {
      filesToRead.push(...matches);
    } else {
      cleanQuestions.push(q);
    }
  }

  return { cleanQuestions, filesToRead: [...new Set(filesToRead)] };
}

// ---------------------------------------------------------------------------
// CONTEXTO DE GENERACIÓN
// ---------------------------------------------------------------------------
interface GenerationContext {
  taskDescription: string;
  projectContext: ProjectContext;
  qaHistory: { question: string; answer: string }[];
  roleKey?: string;
  rootDir: string;
}

// ---------------------------------------------------------------------------
// LLAMADA BASE AL LLM
// ---------------------------------------------------------------------------
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number
): Promise<CompletionResult> {
  const config = getConfig();
  const adapter = getLLMAdapter(config);

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    return await adapter.generateCompletion(messages, {
      temperature: config.temperature,
      maxTokens: maxTokens ?? config.maxTokens,
    });
  } catch (error: any) {
    getLogger().error('Fallo en consulta LLM', { provider: config.provider, model: config.model, error: error.message });
    throw new Error(`Fallo en Proveedor LLM (${config.provider} / ${config.model}): ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// FASE 1: EVALUACIÓN + OUTLINE
// ---------------------------------------------------------------------------
function buildEvaluationPrompt(
  ctx: GenerationContext,
  requestedFiles?: { path: string; content: string }[]
): string {
  const formattedContext = formatContextForLLM(ctx.projectContext);

  const historyText =
    ctx.qaHistory.length > 0
      ? `\n### ACLARATORIAS PREVIAS RESUELTAS:\n` +
      ctx.qaHistory
        .map((qa, i) => `${i + 1}. **P:** ${qa.question}\n   **R:** ${qa.answer}`)
        .join('\n')
      : '';

  const requestedFilesText =
    requestedFiles && requestedFiles.length > 0
      ? `\n### ARCHIVOS SOLICITADOS POR EL ANALISTA (LEÍDOS AUTOMÁTICAMENTE):\n` +
      requestedFiles
        .map((f) => `**[${f.path}]**\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n')
      : '';

  return `
${formattedContext}
${historyText}
${requestedFilesText}

### REQUERIMIENTO DEL USUARIO:
${ctx.taskDescription}

## INSTRUCCIONES DE EVALUACIÓN

Evalúa si tienes contexto suficiente para generar un SPEC COMPLETO para este requerimiento.

### CHECKLIST DE EVALUACIÓN (responde internamente):
1. ¿El requerimiento menciona archivos/componentes que existen en la estructura del proyecto?
2. ¿Hay endpoints, modelos, DTOs o servicios que debo conocer pero no tengo en el contexto?
3. ¿Faltan variables de entorno o configuraciones críticas para la implementación?
4. ¿El alcance es lo suficientemente pequeño para un SPEC atómico y sin suposiciones?

### DECISIÓN:
- Si falta información crítica → Retorna BLOCKED con preguntas CONCRETAS y ESPECÍFICAS (máximo 10).
  Cada pregunta debe ser evaluable: "¿Existe el componente X?", "¿Cuál es la URL del endpoint Y?", "¿Dónde está definido el modelo Z?"
  Si necesitas leer archivos, inclúyelos en "filesToRead".
  
- Si tienes todo lo necesario → Retorna READY con un OUTLINE COMPACTO en specContent (máximo 1500 palabras):
  1. Objetivo (1-2 oraciones)
  2. Archivos afectados (lista de crear/modificar/eliminar)
  3. Cambios en interfaces/DB (resumen)
  4. Plan de pruebas (resumen)

IMPORTANTE: Máximo 10 preguntas en "questions". NO pidas al usuario que pegue código. Usa "filesToRead" para obtener archivos automáticamente.

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO:
{
  "status": "BLOCKED" | "READY",
  "detectedContextSummary": "string",
  "questions": ["pregunta 1", "pregunta 2"],
  "filesToRead": ["ruta/relativa/archivo.ts"],
  "specContent": "string (outline compacto si status es READY)"
}
`.trim();
}

async function evaluateAndPlan(
  ctx: GenerationContext,
  requestedFiles?: { path: string; content: string }[]
): Promise<LLMResponse> {
  const rolePrompt = ctx.roleKey ? getRoleModifierPrompt(ctx.roleKey) : '';
  const systemPrompt = buildSystemPrompt(rolePrompt);
  const userPrompt = buildEvaluationPrompt(ctx, requestedFiles);

  const result = await callLLM(systemPrompt, userPrompt);
  const parsed = parseLLMJson(result.content || '{}');
  parsed.finishReason = result.finishReason;

  // Post-procesamiento: mover peticiones de archivo de questions a filesToRead
  if (parsed.status === 'BLOCKED' && parsed.questions && parsed.questions.length > 0) {
    const { cleanQuestions, filesToRead } = extractFileReadRequests(parsed.questions);

    if (filesToRead.length > 0) {
      getLogger().info('Peticiones de archivo detectadas en questions, moviendo a filesToRead', {
        files: filesToRead,
        originalQuestions: parsed.questions.length,
        cleanQuestions: cleanQuestions.length,
      });

      parsed.filesToRead = [...(parsed.filesToRead || []), ...filesToRead];
      parsed.questions = cleanQuestions.length > 0 ? cleanQuestions : undefined;
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// FASE 2: SPEC COMPLETO
// ---------------------------------------------------------------------------
function buildFullSpecPrompt(ctx: GenerationContext, plan: string): string {
  const formattedContext = formatContextForLLM(ctx.projectContext);

  return `
${formattedContext}

### REQUERIMIENTO DEL USUARIO:
${ctx.taskDescription}

### OUTLINE APROBADO:
${plan}

## INSTRUCCIONES

Genera el SPEC COMPLETO en Markdown basado en el outline aprobado. Sé completo pero evita verbosidad innecesaria.

REGLAS CRÍTICAS:
- Incluye TODAS las secciones obligatorias: Objetivo, Componentes Afectados, Interfaces/DB, Plan de Pruebas
- Cada sección debe estar COMPLETA y CERRADA
- No dejes oraciones a medias ni secciones incompletas
- Si el SPEC es largo, prioriza completar todas las secciones antes que extender una sola
- Termina el documento con una conclusión o resumen claro

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO:
{
  "status": "READY",
  "detectedContextSummary": "string",
  "specContent": "string (SPEC completo en Markdown)"
}
`.trim();
}

async function generateFullSpec(ctx: GenerationContext, plan: string): Promise<LLMResponse> {
  const rolePrompt = ctx.roleKey ? getRoleModifierPrompt(ctx.roleKey) : '';
  const systemPrompt = buildSystemPrompt(rolePrompt);
  const userPrompt = buildFullSpecPrompt(ctx, plan);

  const result = await callLLM(systemPrompt, userPrompt);
  const parsed = parseLLMJson(result.content || '{}');
  parsed.finishReason = result.finishReason;
  return parsed;
}

// ---------------------------------------------------------------------------
// FASE 3: CONTINUACIÓN
// ---------------------------------------------------------------------------
function buildContinuePrompt(ctx: GenerationContext, partialSpec: string): string {
  return `
El SPEC se cortó a la mitad. Continúa EXACTAMENTE donde quedaste. NO repitas nada de lo anterior.

### CONTENIDO GENERADO HASTA AHORA (NO REPETIR):
${partialSpec.slice(-2000)}

### INSTRUCCIONES:
- Continúa desde la última oración/sección completa
- Completa todas las secciones faltantes
- Termina el documento de forma limpia

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO:
{
  "status": "READY",
  "specContent": "string (SOLO el contenido nuevo que continúa, NO repitas lo anterior)"
}
`.trim();
}

async function continueSpec(ctx: GenerationContext, partialSpec: string): Promise<LLMResponse> {
  const rolePrompt = ctx.roleKey ? getRoleModifierPrompt(ctx.roleKey) : '';
  const systemPrompt = buildSystemPrompt(rolePrompt);
  const userPrompt = buildContinuePrompt(ctx, partialSpec);

  const result = await callLLM(systemPrompt, userPrompt);
  const parsed = parseLLMJson(result.content || '{}');
  parsed.finishReason = result.finishReason;
  return parsed;
}

// ---------------------------------------------------------------------------
// FASE 4: SPEC CONCISO (FALLBACK)
// ---------------------------------------------------------------------------
function buildConciseSpecPrompt(ctx: GenerationContext, plan: string): string {
  const formattedContext = formatContextForLLM(ctx.projectContext);

  return `
${formattedContext}

### REQUERIMIENTO DEL USUARIO:
${ctx.taskDescription}

### OUTLINE:
${plan}

## INSTRUCCIONES - SPEC CONCISO

El SPEC completo excedió el límite de salida. Genera una versión CORTA pero COMPLETA y CONCISA.

REGLAS:
- Máximo 3000 palabras
- Incluye TODAS las secciones obligatorias (Objetivo, Componentes, Interfaces/DB, Plan de Pruebas)
- Sé directo y preciso. Sin párrafos largos.
- Usa listas y tablas donde sea posible
- Termina CADA sección completamente
- No dejes el documento a medias

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO:
{
  "status": "READY",
  "detectedContextSummary": "string",
  "specContent": "string (SPEC conciso en Markdown)"
}
`.trim();
}

async function generateConciseSpec(ctx: GenerationContext, plan: string): Promise<LLMResponse> {
  const rolePrompt = ctx.roleKey ? getRoleModifierPrompt(ctx.roleKey) : '';
  const systemPrompt = buildSystemPrompt(rolePrompt);
  const userPrompt = buildConciseSpecPrompt(ctx, plan);

  const result = await callLLM(systemPrompt, userPrompt);
  const parsed = parseLLMJson(result.content || '{}');
  parsed.finishReason = result.finishReason;
  return parsed;
}

// ---------------------------------------------------------------------------
// FUNCIÓN PRINCIPAL DE CONSULTA
// ---------------------------------------------------------------------------
export async function consultLeadGuard(
  taskDescription: string,
  context: ProjectContext,
  qaHistory: { question: string; answer: string }[] = [],
  roleKey?: string,
  rootDir: string = process.cwd()
): Promise<LLMResponse> {
  const genCtx: GenerationContext = { taskDescription, projectContext: context, qaHistory, roleKey, rootDir };

  // -------------------------------------------------------------------------
  // FASE 1: Evaluación + Outline (con auto-resolución de filesToRead)
  // -------------------------------------------------------------------------
  let requestedFiles: { path: string; content: string }[] | undefined;
  let planResult: LLMResponse | null = null;
  const MAX_AUTO_READ_ROUNDS = 2;

  for (let round = 0; round <= MAX_AUTO_READ_ROUNDS; round++) {
    const result = await evaluateAndPlan(genCtx, requestedFiles);

    if (result.status === 'BLOCKED') {
      const hasQuestions = result.questions && result.questions.length > 0;
      const hasFilesToRead = result.filesToRead && result.filesToRead.length > 0;

      // Si hay archivos para leer, leerlos primero (pueden resolver las preguntas)
      if (hasFilesToRead) {
        getLogger().info('Leyendo archivos solicitados automáticamente', {
          files: result.filesToRead,
        });
        const newFiles = await readRequestedFiles(result.filesToRead!, rootDir);

        if (newFiles.length > 0) {
          requestedFiles = [...(requestedFiles || []), ...newFiles];
          // Si no hay preguntas reales, re-evaluar con los archivos leídos
          if (!hasQuestions) {
            continue;
          }
          // Si hay preguntas Y archivos, leer archivos y luego devolver las preguntas
          // Pero primero re-evaluar una vez más con los archivos leídos
          if (round < MAX_AUTO_READ_ROUNDS) {
            continue;
          }
        }
      }

      // Si no hay archivos para leer o ya se agotaron las rondas, devolver preguntas
      return result;
    }

    if (result.status === 'READY' && result.specContent) {
      planResult = result;
      break;
    }

    return result;
  }

  if (!planResult || !planResult.specContent) {
    return {
      status: 'BLOCKED',
      detectedContextSummary: 'No se pudo generar un plan. Intenta con una descripción más detallada.',
      questions: ['¿Podrías proporcionar más detalles sobre el requerimiento?'],
    };
  }

  const plan = planResult.specContent;

  // -------------------------------------------------------------------------
  // FASE 2: Generar SPEC completo
  // -------------------------------------------------------------------------
  const fullResult = await generateFullSpec(genCtx, plan);

  if (fullResult.status === 'READY' && fullResult.specContent) {
    if (!isSpecTruncated(fullResult.specContent, fullResult.finishReason)) {
      return fullResult;
    }

    getLogger().warn('SPEC completo truncado, intentando continuación', {
      finishReason: fullResult.finishReason,
      specLength: fullResult.specContent.length,
    });

    // -------------------------------------------------------------------------
    // FASE 3: Intentar continuar
    // -------------------------------------------------------------------------
    const continuedResult = await continueSpec(genCtx, fullResult.specContent);

    if (continuedResult.status === 'READY' && continuedResult.specContent) {
      const combined = fullResult.specContent + '\n\n' + continuedResult.specContent;

      if (!isSpecTruncated(combined, continuedResult.finishReason)) {
        return {
          status: 'READY',
          detectedContextSummary: 'SPEC generado con continuación automática.',
          specContent: combined,
          finishReason: continuedResult.finishReason,
        };
      }
    }

    getLogger().warn('SPEC sigue truncado después de continuación, generando versión concisa');
  }

  // -------------------------------------------------------------------------
  // FASE 4: Fallback - SPEC conciso
  // -------------------------------------------------------------------------
  const conciseResult = await generateConciseSpec(genCtx, plan);

  if (conciseResult.status === 'READY' && conciseResult.specContent) {
    if (!isSpecTruncated(conciseResult.specContent, conciseResult.finishReason)) {
      return conciseResult;
    }

    getLogger().warn('SPEC conciso también truncado, sugiriendo dividir tarea');
    return {
      status: 'BLOCKED',
      detectedContextSummary: 'El SPEC es demasiado grande incluso en versión concisa.',
      questions: [
        'El requerimiento es demasiado grande para generar un SPEC completo. ¿Podrías dividirlo en subtareas más pequeñas?',
        'Ejemplo: "Implementar el endpoint de login" o "Crear el componente de tabla de usuarios"',
      ],
    };
  }

  return conciseResult;
}
