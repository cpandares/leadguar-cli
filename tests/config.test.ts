import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../src/core/config.js';

describe('Config - Validación estricta', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.AI_MANAGER_KEY;
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENCODE_MODEL;
    delete process.env.AI_MAX_TOKENS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('debe lanzar error si falta AI_PROVIDER', () => {
    process.env.AI_MANAGER_KEY = 'test-key';
    process.env.AI_MODEL = 'test-model';
    expect(() => getConfig()).toThrow('Falta la variable AI_PROVIDER');
  });

  it('debe lanzar error si AI_PROVIDER no es válido', () => {
    process.env.AI_PROVIDER = 'invalido';
    process.env.AI_MANAGER_KEY = 'test-key';
    process.env.AI_MODEL = 'test-model';
    expect(() => getConfig()).toThrow('no es válido');
  });

  it('debe lanzar error si falta la API Key', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'gpt-4o';
    expect(() => getConfig()).toThrow('Falta la API Key');
  });

  it('debe lanzar error si falta AI_MODEL', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MANAGER_KEY = 'test-key';
    expect(() => getConfig()).toThrow('Falta la variable AI_MODEL');
  });

  it('debe retornar config válida con las 3 variables presentes', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MANAGER_KEY = 'sk-test-key';
    process.env.AI_MODEL = 'gpt-4o';

    const config = getConfig();
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('sk-test-key');
    expect(config.model).toBe('gpt-4o');
  });

  it('debe aceptar proveedores válidos (opencode, openai, anthropic, google, custom)', () => {
    const validProviders = ['opencode', 'openai', 'anthropic', 'google', 'custom'];

    for (const provider of validProviders) {
      process.env.AI_PROVIDER = provider;
      process.env.AI_MANAGER_KEY = 'test-key';
      process.env.AI_MODEL = 'test-model';

      const config = getConfig();
      expect(config.provider).toBe(provider);
    }
  });

  it('debe aceptar key específica del proveedor si AI_MANAGER_KEY no está', () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.AI_MODEL = 'claude-3-7-sonnet';

    const config = getConfig();
    expect(config.apiKey).toBe('sk-ant-test');
  });

  it('debe normalizar el provider a minúsculas', () => {
    process.env.AI_PROVIDER = 'OpenAI';
    process.env.AI_MANAGER_KEY = 'test-key';
    process.env.AI_MODEL = 'gpt-4o';

    const config = getConfig();
    expect(config.provider).toBe('openai');
  });

  it('debe usar AI_MAX_TOKENS=32000 por defecto', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MANAGER_KEY = 'test-key';
    process.env.AI_MODEL = 'gpt-4o';

    const config = getConfig();
    expect(config.maxTokens).toBe(32000);
  });

  it('debe leer AI_MAX_TOKENS del entorno si está definido', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MANAGER_KEY = 'test-key';
    process.env.AI_MODEL = 'gpt-4o';
    process.env.AI_MAX_TOKENS = '16000';

    const config = getConfig();
    expect(config.maxTokens).toBe(16000);
  });
});
