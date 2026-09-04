import OpenAI from 'openai';
import { LLMProviderAdapter, Message, CompletionOptions, CompletionResult } from './types.js';
import { getLogger } from '../logger.js';

export class OpenCodeAdapter implements LLMProviderAdapter {
  readonly providerName = 'opencode';
  private client: OpenAI;
  private model: string;

  constructor(options: { apiKey: string; baseURL?: string; model: string }) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error(
        'OpenCodeAdapter requiere una API Key válida (AI_MANAGER_KEY / OPENCODE_API_KEY).'
      );
    }
    this.model = options.model || 'deepseek-v4-pro';
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL || 'https://opencode.ai/zen/go/v1',
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
      getLogger().error('Error en API OpenCode', { error: error.message, status: error.status });
      throw error;
    }
  }
}
