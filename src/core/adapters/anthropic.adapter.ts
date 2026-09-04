import { LLMProviderAdapter, Message, CompletionOptions, CompletionResult } from './types.js';
import { getLogger } from '../logger.js';

export class AnthropicAdapter implements LLMProviderAdapter {
  readonly providerName = 'anthropic';
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(options: { apiKey: string; baseURL?: string; model: string }) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error(
        'AnthropicAdapter requiere una API Key válida (AI_MANAGER_KEY / ANTHROPIC_API_KEY).'
      );
    }
    this.apiKey = options.apiKey;
    this.model = options.model || 'claude-3-7-sonnet-20250219';
    this.baseURL = options.baseURL || 'https://api.anthropic.com/v1/messages';
  }

  async generateCompletion(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const userAndAssistantMessages = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const body: Record<string, any> = {
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      messages: userAndAssistantMessages,
      temperature: options?.temperature ?? 0.1,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      getLogger().error('Error en API Anthropic', { status: response.status, body: errorText.slice(0, 500) });
      throw new Error(`Error en API Anthropic (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const content = data.content?.[0]?.text || '';

    return {
      content,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : undefined,
    };
  }
}
