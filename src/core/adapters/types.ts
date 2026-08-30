export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProviderAdapter {
  readonly providerName: string;
  generateCompletion(messages: Message[], options?: CompletionOptions): Promise<string>;
}
