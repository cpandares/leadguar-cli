import OpenAI from 'openai';
import { getConfig } from './config.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';
import { ProjectContext, formatContextForLLM } from './scanner.js';
import { LLMResponse } from './types.js';

let clientInstance: OpenAI | null = null;

function getClient(): { client: OpenAI; model: string } {
  const config = getConfig();

  if (!clientInstance) {
    clientInstance = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  return { client: clientInstance, model: config.model };
}

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
      `Error parseando respuesta JSON de OpenCode Go:\n${rawText}\nDetalle: ${err.message}`
    );
  }
}

// Asegúrate de que tenga "export" aquí
export async function consultLeadGuard(
  taskDescription: string,
  context: ProjectContext,
  qaHistory: { question: string; answer: string }[] = []
): Promise<LLMResponse> {
  const { client, model } = getClient();
  const formattedContext = formatContextForLLM(context);

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

Analiza el requerimiento contra las reglas de LeadGuard. Si falta algún dato técnico crítico del checklist (BD, versión, inputs/outputs, DoD), responde en JSON con status "BLOCKED" y el array "questions". Si tienes todo lo necesario para un desarrollo atómico y sin suposiciones, responde con status "READY" y el campo "specContent" con el SPEC en Markdown.

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO:
{
  "status": "BLOCKED" | "READY",
  "detectedContextSummary": "string",
  "questions": ["pregunta 1", "pregunta 2"],
  "specContent": "string (Markdown del SPEC si status es READY)"
}
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    return parseLLMJson(content);
  } catch (error: any) {
    throw new Error(`Fallo en OpenCode Go (${model}): ${error.message}`);
  }
}