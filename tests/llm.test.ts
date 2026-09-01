import { describe, it, expect } from 'vitest';
import { parseLLMJson } from '../src/core/llm.js';
import { getLLMAdapter } from '../src/core/adapters/factory.js';
import { AppConfig } from '../src/core/config.js';

describe('LLM & Adapters', () => {
  describe('parseLLMJson', () => {
    it('debe parsear adecuadamente un JSON válido con status BLOCKED', () => {
      const input = JSON.stringify({
        status: 'BLOCKED',
        questions: ['¿Qué tabla se modificará?', '¿Cuáles son los DTOs?'],
      });

      const parsed = parseLLMJson(input);
      expect(parsed.status).toBe('BLOCKED');
      expect(parsed.questions).toHaveLength(2);
    });

    it('debe limpiar bloques de pensamiento tipo <think>...</think>', () => {
      const input = `
<think>
El requerimiento es ambiguo, debo pedir más información.
</think>
\`\`\`json
{
  "status": "BLOCKED",
  "questions": ["¿Cuál es el motor de base de datos?"]
}
\`\`\`
      `;

      const parsed = parseLLMJson(input);
      expect(parsed.status).toBe('BLOCKED');
      expect(parsed.questions).toEqual(['¿Cuál es el motor de base de datos?']);
    });

    it('debe extraer JSON rodeado de bloques markdown ```json ... ```', () => {
      const input = '```json\n{"status":"READY","specContent":"# SPEC TÉCNICO"}\n```';
      const parsed = parseLLMJson(input);
      expect(parsed.status).toBe('READY');
      expect(parsed.specContent).toBe('# SPEC TÉCNICO');
    });

    it('debe ejecutar el fallback si el JSON se truncó al final', () => {
      const truncatedInput = '{"status":"READY", "specContent":"# SPEC INCOMPLETO\\n- Detalle 1';
      const parsed = parseLLMJson(truncatedInput);

      expect(parsed.status).toBe('READY');
      expect(parsed.specContent).toContain('# SPEC INCOMPLETO');
    });
  });

  describe('Adapters Factory', () => {
    it('debe instanciar el adaptador correcto según AI_PROVIDER', () => {
      const openaiConfig: AppConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
        temperature: 0.1,
      };
      const openaiAdapter = getLLMAdapter(openaiConfig);
      expect(openaiAdapter.providerName).toBe('openai');

      const anthropicConfig: AppConfig = {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.1,
      };
      const anthropicAdapter = getLLMAdapter(anthropicConfig);
      expect(anthropicAdapter.providerName).toBe('anthropic');

      const googleConfig: AppConfig = {
        provider: 'google',
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        temperature: 0.1,
      };
      const googleAdapter = getLLMAdapter(googleConfig);
      expect(googleAdapter.providerName).toBe('google');
    });

    it('debe lanzar error si el proveedor no es reconocido', () => {
      const invalidConfig: AppConfig = {
        provider: 'invalido',
        apiKey: 'test-key',
        model: 'test-model',
        temperature: 0.1,
      };
      expect(() => getLLMAdapter(invalidConfig)).toThrow('Proveedor de IA no reconocido');
    });
  });
});
