import dotenv from 'dotenv';
import path from 'node:path';

// Carga el .env del root del proyecto en el que se ejecuta la CLI
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseURL?: string;
  temperature: number;
}

export function getConfig(): AppConfig {
  const provider = process.env.AI_PROVIDER || 'opencode';

  const apiKey =
    process.env.AI_MANAGER_KEY ||
    process.env.OPENCODE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'Falta la API Key en tu archivo .env. Define la variable AI_MANAGER_KEY (o OPENCODE_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY).'
    );
  }

  const model = process.env.AI_MODEL || process.env.OPENCODE_MODEL || 'deepseek-v4-pro';
  const baseURL = process.env.AI_BASE_URL || process.env.OPENCODE_BASE_URL;
  const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.1');

  return {
    provider,
    apiKey,
    model,
    baseURL,
    temperature,
  };
}