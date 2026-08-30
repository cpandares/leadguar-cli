import { getConfig } from './config.js';
import { getLLMAdapter } from './adapters/factory.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import { getRoleModifierPrompt } from './roles.js';
import { ProjectContext, formatContextForLLM } from './scanner.js';
import { LLMResponse } from './types.js';
import { Message } from './adapters/types.js';

function parseLLMJson(rawText: string): LLMResponse {
  try {
    let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (markdownMatch && markdownMatch[1]) {
      cleaned = markdownMatch[1].trim();
    } else {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
      }
    }

    return JSON.parse(cleaned) as LLMResponse;
  } catch (err: any) {
    throw new Error(
      `Error parseando respuesta JSON del proveedor de IA:\n${rawText}\nDetalle: ${err.message}`
    );
  }
}

export async function consultLeadGuard(
  taskDescription: string,
  context: ProjectContext,
  qaHistory: { question: string; answer: string }[] = [],
  roleKey?: string
): Promise<LLMResponse> {
  const config = getConfig();
  const adapter = getLLMAdapter(config);

  const formattedContext = formatContextForLLM(context);
  const roleModifier = roleKey ? getRoleModifierPrompt(roleKey) : undefined;
  const systemPrompt = buildSystemPrompt(roleModifier);

  const historyText =
    qaHistory.length > 0
      ? `\n### ACLARATORIAS PREVIAS RESUELTAS:\n` +
        qaHistory
          .map((qa, i) => `${i + 1}. **P:** ${qa.question}\n   **R:** ${qa.answer}`)
          .join('\n')
      : '';

  const userPrompt = `
${formattedContext}

${historyText}

### REQUERIMIENTO DEL USUARIO:
${taskDescription}

Analiza el requerimiento contra las reglas de LeadGuard y la especialización activa. Si falta algún dato técnico crítico del checklist (BD, versión, inputs/outputs, DoD), responde en JSON con status "BLOCKED" y el array "questions". Si tienes todo lo necesario para un desarrollo atómico y sin suposiciones, responde con status "READY" y el campo "specContent" con el SPEC en Markdown.

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO:
{
  "status": "BLOCKED" | "READY",
  "detectedContextSummary": "string",
  "questions": ["pregunta 1", "pregunta 2"],
  "specContent": "string (Markdown del SPEC si status es READY)"
}
`.trim();

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const rawContent = await adapter.generateCompletion(messages, {
      temperature: config.temperature,
    });
    return parseLLMJson(rawContent);
  } catch (error: any) {
    throw new Error(
      `Fallo en Proveedor de IA [${adapter.providerName}] (${config.model}): ${error.message}`
    );
  }
}