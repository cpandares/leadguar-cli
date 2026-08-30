import dotenv from 'dotenv';
import path from 'node:path';

// Carga el .env del root del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  apiKey: string;
  model: string;
  baseURL: string;
}

export function getConfig(): AppConfig {
  const apiKey = process.env.OPENCODE_API_KEY;
  const model = process.env.OPENCODE_MODEL || 'deepseek-v4-pro';
  const baseURL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1';

  if (!apiKey) {
    throw new Error(
      'Falta la variable de entorno OPENCODE_API_KEY. Configúrala en tu archivo .env'
    );
  }

  return {
    apiKey,
    model,
    baseURL,
  };
}