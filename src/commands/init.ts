import chalk from 'chalk';
import { select, input } from '@inquirer/prompts';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLocalConfig, saveLocalConfig } from '../core/state.js';
import { ROLE_INQUIRER_CHOICES, TECHNICAL_ROLES } from '../core/roles.js';
import { getLogger } from '../core/logger.js';

const VALID_PROVIDERS = ['opencode', 'openai', 'anthropic', 'google', 'custom'] as const;

const PROVIDER_LABELS: Record<string, string> = {
  opencode: 'OpenCode (deepseek-v4-pro)',
  openai: 'OpenAI (gpt-4o)',
  anthropic: 'Anthropic (claude-3-7-sonnet)',
  google: 'Google Gemini (gemini-1.5-pro)',
  custom: 'Custom / Ollama / vLLM',
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  opencode: 'deepseek-v4-pro',
  openai: 'gpt-4o',
  anthropic: 'claude-3-7-sonnet-20250219',
  google: 'gemini-1.5-pro',
  custom: 'default-model',
};

function hasProviderSpecificKey(): boolean {
  return !!(
    process.env.OPENCODE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY
  );
}

async function readExistingEnv(envPath: string): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

async function writeEnvFile(envPath: string, updates: Record<string, string>): Promise<void> {
  const existing = await readExistingEnv(envPath);
  const merged = { ...existing, ...updates };

  const lines: string[] = [
    '# ============================================================',
    '# CONFIGURACIÓN DE ENTORNO - LeadGuard',
    '# ============================================================',
    '',
    '# Proveedor de IA (OBLIGATORIO): opencode | openai | anthropic | google | custom',
    `AI_PROVIDER=${merged.AI_PROVIDER || ''}`,
    '',
    '# API Key (OBLIGATORIO): key unificada o específica del proveedor',
    `AI_MANAGER_KEY=${merged.AI_MANAGER_KEY || ''}`,
    '',
    '# Modelo (OBLIGATORIO): según el proveedor elegido',
    `AI_MODEL=${merged.AI_MODEL || ''}`,
    '',
    '# Endpoint base (Obligatorio solo si AI_PROVIDER=custom)',
    `AI_BASE_URL=${merged.AI_BASE_URL || ''}`,
    '',
    '# Temperatura de generación (Default: 0.1)',
    `AI_TEMPERATURE=${merged.AI_TEMPERATURE || '0.1'}`,
    '',
    '# Nivel de log: debug | info | warn | error (Default: info)',
    `LOG_LEVEL=${merged.LOG_LEVEL || 'info'}`,
  ];

  await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');
}

async function ensureEnvConfig(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const needsProvider = !process.env.AI_PROVIDER;
  const needsKey = !process.env.AI_MANAGER_KEY && !hasProviderSpecificKey();
  const needsModel = !process.env.AI_MODEL && !process.env.OPENCODE_MODEL;

  if (!needsProvider && !needsKey && !needsModel) return;

  console.log(chalk.yellow('\nVariables de entorno obligatorias faltantes o incompletas.\n'));

  const provider = await select({
    message: 'Selecciona el proveedor de IA:',
    choices: VALID_PROVIDERS.map((p) => ({
      name: PROVIDER_LABELS[p],
      value: p,
    })),
  });

  const apiKey = await input({
    message: `Ingresa tu API Key para ${PROVIDER_LABELS[provider]}:`,
    validate: (val) => (val.trim().length > 0 ? true : 'La API Key es obligatoria.'),
  });

  const defaultModel = PROVIDER_DEFAULT_MODELS[provider];
  const model = await input({
    message: `Modelo a utilizar:`,
    default: defaultModel,
    validate: (val) => (val.trim().length > 0 ? true : 'El modelo es obligatorio.'),
  });

  let baseURL = '';
  if (provider === 'custom') {
    baseURL = await input({
      message: 'URL base del servidor (ej: http://localhost:11434/v1):',
      validate: (val) => (val.trim().length > 0 ? true : 'La URL base es obligatoria para el proveedor custom.'),
    });
  }

  const envPath = path.resolve(process.cwd(), '.env');
  const updates: Record<string, string> = {
    AI_PROVIDER: provider,
    AI_MANAGER_KEY: apiKey,
    AI_MODEL: model,
  };
  if (baseURL) updates.AI_BASE_URL = baseURL;

  await writeEnvFile(envPath, updates);

  dotenv.config({ path: envPath });

  console.log(chalk.green('\nVariables de entorno configuradas y guardadas en .env\n'));
}

export async function initCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n🛡️  LeadGuard - Inicialización de Proyecto\n'));

  await ensureEnvConfig();

  const existingConfig = await loadLocalConfig();
  if (existingConfig && existingConfig.selectedRole) {
    const currentRole = TECHNICAL_ROLES.find((r) => r.key === existingConfig.selectedRole);
    console.log(
      chalk.yellow(`El proyecto ya está inicializado con el perfil: ${chalk.bold.white(currentRole?.name || existingConfig.selectedRole)}\n`)
    );
  }

  const selectedRole = await select({
    message: 'Selecciona el perfil técnico especializado de LeadGuard para este proyecto:',
    choices: ROLE_INQUIRER_CHOICES,
  });

  const newConfig = {
    selectedRole,
    initializedAt: new Date().toISOString(),
  };

  await saveLocalConfig(newConfig);

  const roleInfo = TECHNICAL_ROLES.find((r) => r.key === selectedRole);
  console.log(
    chalk.green(`\nConfiguración guardada exitosamente en .leadguard/config.json`)
  );
  console.log(
    chalk.gray(`Perfil activo: ${chalk.bold.white(roleInfo?.name || selectedRole)}\n`)
  );

  getLogger().info('Proyecto inicializado', { role: selectedRole });
}
