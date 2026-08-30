export interface LLMResponse {
  status: 'BLOCKED' | 'READY';
  detectedContextSummary?: string;
  questions?: string[]; // Si status === 'BLOCKED'
  specContent?: string;  // Si status === 'READY'
}