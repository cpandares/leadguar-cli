import OpenAI from 'openai';
import { LLMProviderAdapter, Message, CompletionOptions, CompletionResult } from './types.js';
import { getLogger } from '../logger.js';

export class CustomAdapter implements LLMProviderAdapter {
  readonly providerName = 'custom';
  private client: OpenAI;
  private model: string;

  constructor(options: { apiKey: string; baseURL?: string; model: string }) {
    if (!options.baseURL || !options.baseURL.trim()) {
      throw new Error(
        'CustomAdapter requiere la variable de entorno AI_BASE_URL declarada explícitamente (ej: http://localhost:11434/v1 para Ollama o la URL de vLLM/LocalAI).'
      );
    }
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error(
        'CustomAdapter requiere una API Key válida (AI_MANAGER_KEY / OPENAI_API_KEY). Puedes usar un valor ficticio como "no-key" si el servidor local no requiere auth.'
      );
    }
    this.model = options.model || 'default-model';
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
  }

  async generateCompletion(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens,
      });

      return {
        content: response.choices[0]?.message?.content || '',
        finishReason: response.choices[0]?.finish_reason as CompletionResult['finishReason'],
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
        },
      };
    } catch (error: any) {
      getLogger().error('Error en API Custom', { error: error.message, status: error.status });
      throw error;
    }
  }
}
