export interface LLMResponse {
  status: 'BLOCKED' | 'READY';
  detectedContextSummary?: string;
  questions?: string[];
  specContent?: string;
  filesToRead?: string[];
  finishReason?: 'stop' | 'length' | 'content_filter' | 'other';
}
