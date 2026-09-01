import dotenv from 'dotenv';
import path from 'node:path';
import { getLogger } from './logger.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseURL?: string;
  temperature: number;
}

const VALID_PROVIDERS = ['opencode', 'openai', 'anthropic', 'google', 'gemini', 'custom'] as const;

export function getConfig(): AppConfig {
  const provider = process.env.AI_PROVIDER;
  if (!provider || !provider.trim()) {
    const msg = 'Falta la variable AI_PROVIDER en tu archivo .env. Valores válidos: opencode, openai, anthropic, google, custom.';
    getLogger().error(msg);
    throw new Error(msg);
  }
  if (!VALID_PROVIDERS.includes(provider.toLowerCase() as any)) {
    const msg = `AI_PROVIDER "${provider}" no es válido. Valores válidos: ${VALID_PROVIDERS.join(', ')}.`;
    getLogger().error(msg);
    throw new Error(msg);
  }

  const apiKey =
    process.env.AI_MANAGER_KEY ||
    process.env.OPENCODE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const msg = 'Falta la API Key en tu archivo .env. Define AI_MANAGER_KEY (o la key específica de tu proveedor).';
    getLogger().error(msg);
    throw new Error(msg);
  }

  const model = process.env.AI_MODEL || process.env.OPENCODE_MODEL;
  if (!model || !model.trim()) {
    const msg = 'Falta la variable AI_MODEL en tu archivo .env. Define el modelo a utilizar (ej: gpt-4o, claude-3-7-sonnet, gemini-1.5-pro).';
    getLogger().error(msg);
    throw new Error(msg);
  }

  const baseURL = process.env.AI_BASE_URL || process.env.OPENCODE_BASE_URL;
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.1');

  return {
    provider: provider.toLowerCase(),
    apiKey,
    model,
    baseURL,
    temperature,
  };
}