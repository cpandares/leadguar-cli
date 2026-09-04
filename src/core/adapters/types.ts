export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  content: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'other';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProviderAdapter {
  readonly providerName: string;
  generateCompletion(messages: Message[], options?: CompletionOptions): Promise<CompletionResult>;
}
