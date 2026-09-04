import { describe, it, expect } from 'vitest';
import { parseLLMJson, isSpecTruncated, extractFileReadRequests } from '../src/core/llm.js';
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

    it('debe recuperar contenido si el JSON se truncó al final (cleanup)', () => {
      const truncatedInput = '{"status":"READY", "specContent":"# SPEC INCOMPLETO\\n- Detalle 1';
      const parsed = parseLLMJson(truncatedInput);

      expect(parsed.status).toBe('READY');
      expect(parsed.specContent).toContain('# SPEC INCOMPLETO');
    });

    it('debe marcar finishReason como length si el fallback de regex se activa', () => {
      const brokenInput = 'texto basura "specContent": "contenido parcial sin cerrar';
      const parsed = parseLLMJson(brokenInput);

      expect(parsed.status).toBe('READY');
      expect(parsed.finishReason).toBe('length');
    });

    it('debe extraer el campo filesToRead si está presente', () => {
      const input = JSON.stringify({
        status: 'BLOCKED',
        questions: ['¿Qué hace este hook?'],
        filesToRead: ['src/hooks/useAuth.ts', 'src/services/api.ts'],
      });

      const parsed = parseLLMJson(input);
      expect(parsed.status).toBe('BLOCKED');
      expect(parsed.filesToRead).toEqual(['src/hooks/useAuth.ts', 'src/services/api.ts']);
    });
  });

  describe('isSpecTruncated', () => {
    it('debe detectar truncamiento si finishReason es length', () => {
      expect(isSpecTruncated('cualquier contenido', 'length')).toBe(true);
    });

    it('debe detectar truncamiento si el contenido está vacío', () => {
      expect(isSpecTruncated('', 'stop')).toBe(true);
      expect(isSpecTruncated('   ', 'stop')).toBe(true);
    });

    it('debe detectar truncamiento si falta una sección obligatoria', () => {
      const incompleteSpec = `
# SPEC TÉCNICO

## 1. Objetivo y Alcance Técnico
Implementar feature X.

## 2. Componentes y Archivos Afectados
- src/feature.ts (nuevo)
      `;
      expect(isSpecTruncated(incompleteSpec, 'stop')).toBe(true);
    });

    it('debe detectar truncamiento si un bloque de código está abierto', () => {
      const spec = `
## 1. Objetivo y Alcance Técnico
Implementar feature X.

## 2. Componentes y Archivos Afectados
- src/feature.ts

## 3. Interfaces, Endpoints, DTOs y Cambios en BD
\`\`\`typescript
export interface Feature {
  id: string;
      `;
      expect(isSpecTruncated(spec, 'stop')).toBe(true);
    });

    it('debe detectar truncamiento si la última oración está cortada', () => {
      const spec = `
## 1. Objetivo y Alcance Técnico
Implementar feature X.

## 2. Componentes y Archivos Afectados
- src/feature.ts

## 3. Interfaces, Endpoints, DTOs y Cambios en BD
Endpoint GET /api/feature que retorna

## 4. Plan de Pruebas y Criterios de Aceptación (Definition of Done)
- Test unitario para
      `;
      expect(isSpecTruncated(spec, 'stop')).toBe(true);
    });

    it('debe retornar false para un SPEC completo', () => {
      const completeSpec = `
## 1. Objetivo y Alcance Técnico
Implementar feature X que permite a los usuarios Y.

## 2. Componentes y Archivos Afectados
- src/feature.ts (nuevo)
- src/api/feature.ts (nuevo)

## 3. Interfaces, Endpoints, DTOs y Cambios en BD
- GET /api/feature → retorna lista de features.
- POST /api/feature → crea un nuevo feature.

## 4. Plan de Pruebas y Criterios de Aceptación (Definition of Done)
- Test unitario para el servicio.
- Test de integración para el endpoint.
      `;
      expect(isSpecTruncated(completeSpec, 'stop')).toBe(false);
    });
  });

  describe('Adapters Factory', () => {
    it('debe instanciar el adaptador correcto según AI_PROVIDER', () => {
      const openaiConfig: AppConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o',
        temperature: 0.1,
        maxTokens: 32000,
      };
      const openaiAdapter = getLLMAdapter(openaiConfig);
      expect(openaiAdapter.providerName).toBe('openai');

      const anthropicConfig: AppConfig = {
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-7-sonnet-20250219',
        temperature: 0.1,
        maxTokens: 32000,
      };
      const anthropicAdapter = getLLMAdapter(anthropicConfig);
      expect(anthropicAdapter.providerName).toBe('anthropic');

      const googleConfig: AppConfig = {
        provider: 'google',
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
        temperature: 0.1,
        maxTokens: 32000,
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
        maxTokens: 32000,
      };
      expect(() => getLLMAdapter(invalidConfig)).toThrow('Proveedor de IA no reconocido');
    });
  });

  describe('extractFileReadRequests', () => {
    it('debe extraer rutas de archivo de questions y moverlas a filesToRead', () => {
      const questions = [
        '¿Cuál es el contenido de src/App.tsx?',
        '¿Qué hace el componente src/components/Header.tsx?',
        '¿Cuál es la URL del endpoint de login?',
      ];

      const result = extractFileReadRequests(questions);

      expect(result.filesToRead).toContain('src/App.tsx');
      expect(result.filesToRead).toContain('src/components/Header.tsx');
      expect(result.cleanQuestions).toEqual(['¿Cuál es la URL del endpoint de login?']);
    });

    it('debe manejar questions sin rutas de archivo', () => {
      const questions = [
        '¿Cuál es la URL del endpoint?',
        '¿Qué base de datos usan?',
      ];

      const result = extractFileReadRequests(questions);

      expect(result.filesToRead).toEqual([]);
      expect(result.cleanQuestions).toEqual(questions);
    });

    it('debe manejar questions con múltiples rutas de archivo', () => {
      const questions = [
        '¿Cómo se relacionan src/services/api.ts y src/store/authStore.ts?',
      ];

      const result = extractFileReadRequests(questions);

      expect(result.filesToRead).toContain('src/services/api.ts');
      expect(result.filesToRead).toContain('src/store/authStore.ts');
      expect(result.cleanQuestions).toEqual([]);
    });

    it('debe deduplicar rutas de archivo', () => {
      const questions = [
        '¿Qué hace src/App.tsx?',
        '¿Cuál es el contenido de src/App.tsx?',
      ];

      const result = extractFileReadRequests(questions);

      expect(result.filesToRead).toEqual(['src/App.tsx']);
    });

    it('debe extraer rutas con extensiones variadas', () => {
      const questions = [
        '¿Qué hay en src/styles/main.css?',
        '¿Cuál es la config de tailwind.config.ts?',
        '¿Qué variables hay en .env.example?',
      ];

      const result = extractFileReadRequests(questions);

      expect(result.filesToRead).toContain('src/styles/main.css');
      expect(result.filesToRead).toContain('tailwind.config.ts');
    });
  });
});
