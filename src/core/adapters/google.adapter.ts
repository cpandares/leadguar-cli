import { LLMProviderAdapter, Message, CompletionOptions } from './types.js';

export class GoogleAdapter implements LLMProviderAdapter {
  readonly providerName = 'google';
  private apiKey: string;
  private model: string;

  constructor(options: { apiKey: string; model: string }) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error(
        'GoogleAdapter requiere una API Key válida (AI_MANAGER_KEY / GEMINI_API_KEY).'
      );
    }
    this.apiKey = options.apiKey;
    this.model = options.model || 'gemini-1.5-pro';
  }

  async generateCompletion(messages: Message[], options?: CompletionOptions): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const contents = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.1,
        maxOutputTokens: options?.maxTokens,
      },
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage }],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en API Google Gemini (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;
    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text;
    }

    return '';
  }
}
