import { describe, it, expect } from 'vitest';
import { ProjectScanner, formatContextForLLM, ProjectContext, readRequestedFiles } from '../src/core/scanner.js';

describe('ProjectScanner & Context Formatting', () => {
  it('debe escanear el proyecto actual y detectar la configuración de TypeScript/Node', async () => {
    const scanner = new ProjectScanner(process.cwd());
    const context = await scanner.scan();

    expect(context.languages).toContain('JavaScript/TypeScript');
    expect(context.manifests.some((m) => m.file === 'package.json')).toBe(true);
  });

  it('debe detectar la estructura del código fuente del proyecto actual', async () => {
    const scanner = new ProjectScanner(process.cwd());
    const context = await scanner.scan();

    expect(context.sourceStructure).toBeDefined();
    expect(context.sourceStructure.entryPoints).toContain('src/bin/cli.ts');
    expect(context.sourceStructure.components.length).toBe(0);
    expect(context.sourceStructure.config.length).toBeGreaterThan(0);
  });

  it('debe detectar el framework y la UI library', async () => {
    const scanner = new ProjectScanner(process.cwd());
    const context = await scanner.scan();

    expect(context.frameworkConfig).toBeDefined();
    expect(context.frameworkConfig.uiLibrary).toBeNull();
    expect(context.frameworkConfig.framework).toBeNull();
  });

  it('debe leer archivos clave del proyecto actual', async () => {
    const scanner = new ProjectScanner(process.cwd());
    const context = await scanner.scan();

    expect(context.keySourceFiles.length).toBeGreaterThan(0);
    expect(context.keySourceFiles.some((f) => f.path === 'src/bin/cli.ts')).toBe(true);
  });

  it('debe leer archivos solicitados por el analista', async () => {
    const files = await readRequestedFiles(['src/bin/cli.ts', 'archivo-que-no-existe.ts'], process.cwd());

    expect(files.length).toBe(1);
    expect(files[0].path).toBe('src/bin/cli.ts');
    expect(files[0].content.length).toBeGreaterThan(0);
  });

  it('debe formatear adecuadamente el contexto para la entrada del LLM', () => {
    const mockContext: ProjectContext = {
      languages: ['TypeScript', 'SQL'],
      manifests: [{ file: 'package.json', contentSummary: '{"name": "test-app"}' }],
      databaseSchemas: [{ path: 'prisma/schema.prisma', content: 'model User { id String }' }],
      documentation: [{ path: 'README.md', content: '# Test App' }],
      infrastructure: ['Dockerfile'],
      envKeys: ['DATABASE_URL', 'API_KEY'],
      sourceStructure: {
        components: ['src/components/Header.tsx'],
        pages: ['src/pages/Home.tsx'],
        routes: ['src/api/users.ts'],
        hooks: ['src/hooks/useAuth.ts'],
        services: ['src/services/api.ts'],
        utils: ['src/utils/date.ts'],
        store: [],
        middleware: [],
        config: ['vite.config.ts'],
        entryPoints: ['src/main.tsx'],
      },
      frameworkConfig: {
        framework: 'Vite',
        uiLibrary: 'React',
        router: 'react-router-dom',
        stateManagement: null,
        cssFramework: 'Tailwind CSS',
        tsConfigPaths: { '@/*': ['src/*'] },
      },
      keySourceFiles: [{ path: 'src/main.tsx', content: 'import App from "./App";' }],
    };

    const formatted = formatContextForLLM(mockContext);

    expect(formatted).toContain('### CONTEXTO TÉCNICO COMPLETO DEL REPOSITORIO');
    expect(formatted).toContain('TypeScript, SQL');
    expect(formatted).toContain('Dockerfile');
    expect(formatted).toContain('DATABASE_URL, API_KEY');
    expect(formatted).toContain('test-app');
    expect(formatted).toContain('prisma/schema.prisma');
    expect(formatted).toContain('ESTRUCTURA DEL CÓDIGO FUENTE');
    expect(formatted).toContain('src/components/Header.tsx');
    expect(formatted).toContain('src/pages/Home.tsx');
    expect(formatted).toContain('src/main.tsx');
    expect(formatted).toContain('ARCHIVOS CLAVE LEÍDOS AUTOMÁTICAMENTE');
    expect(formatted).toContain('Vite');
    expect(formatted).toContain('React');
    expect(formatted).toContain('Tailwind CSS');
  });
});
