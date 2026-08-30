import { AppConfig } from '../config.js';
import { LLMProviderAdapter } from './types.js';
import { OpenCodeAdapter } from './opencode.adapter.js';
import { OpenAIAdapter } from './openai.adapter.js';
import { AnthropicAdapter } from './anthropic.adapter.js';
import { GoogleAdapter } from './google.adapter.js';
import { CustomAdapter } from './custom.adapter.js';

export function getLLMAdapter(config: AppConfig): LLMProviderAdapter {
  const provider = (config.provider || 'opencode').toLowerCase();

  switch (provider) {
    case 'opencode':
      return new OpenCodeAdapter({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
      });

    case 'openai':
      return new OpenAIAdapter({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
      });

    case 'anthropic':
      return new AnthropicAdapter({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
      });

    case 'google':
    case 'gemini':
      return new GoogleAdapter({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'custom':
      return new CustomAdapter({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
      });

    default:
      throw new Error(
        `Proveedor de IA no reconocido: "${config.provider}". Los proveedores válidos en AI_PROVIDER son: opencode, openai, anthropic, google, custom.`
      );
  }
}
