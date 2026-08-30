import { LLMProviderAdapter, Message, CompletionOptions } from './types.js';

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

  async generateCompletion(messages: Message[], options?: CompletionOptions): Promise<string> {
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
      throw new Error(`Error en API Anthropic (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    if (data.content && Array.isArray(data.content) && data.content.length > 0) {
      return data.content[0].text || '';
    }

    return '';
  }
}
