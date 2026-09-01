import { describe, it, expect } from 'vitest';
import { ProjectScanner, formatContextForLLM, ProjectContext } from '../src/core/scanner.js';

describe('ProjectScanner & Context Formatting', () => {
  it('debe escanear el proyecto actual y detectar la configuración de TypeScript/Node', async () => {
    const scanner = new ProjectScanner(process.cwd());
    const context = await scanner.scan();

    expect(context.languages).toContain('JavaScript/TypeScript');
    expect(context.manifests.some((m) => m.file === 'package.json')).toBe(true);
  });

  it('debe formatear adecuadamente el contexto para la entrada del LLM', () => {
    const mockContext: ProjectContext = {
      languages: ['TypeScript', 'SQL'],
      manifests: [{ file: 'package.json', contentSummary: '{"name": "test-app"}' }],
      databaseSchemas: [{ path: 'prisma/schema.prisma', content: 'model User { id String }' }],
      documentation: [{ path: 'README.md', content: '# Test App' }],
      infrastructure: ['Dockerfile'],
      envKeys: ['DATABASE_URL', 'API_KEY'],
    };

    const formatted = formatContextForLLM(mockContext);

    expect(formatted).toContain('### CONTEXTO TÉCNICO COMPLETO DEL REPOSITORIO');
    expect(formatted).toContain('TypeScript, SQL');
    expect(formatted).toContain('Dockerfile');
    expect(formatted).toContain('DATABASE_URL, API_KEY');
    expect(formatted).toContain('test-app');
    expect(formatted).toContain('prisma/schema.prisma');
  });
});
