import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { getLogger } from './logger.js';

export interface FileSummary {
  path: string;
  content: string;
}

export async function readRequestedFiles(filePaths: string[], rootDir: string): Promise<FileSummary[]> {
  const summaries: FileSummary[] = [];
  const seen = new Set<string>();

  for (const relPath of filePaths.slice(0, 10)) {
    if (seen.has(relPath)) continue;
    seen.add(relPath);

    try {
      const fullPath = path.join(rootDir, relPath);
      const rawContent = await fs.readFile(fullPath, 'utf-8');
      const content =
        rawContent.length > 4000
          ? rawContent.slice(0, 4000) + '\n... [TRUNCATED DUE TO SIZE]'
          : rawContent;
      summaries.push({ path: relPath, content });
    } catch {
      getLogger().debug('No se pudo leer archivo solicitado por el analista', { path: relPath });
    }
  }

  return summaries;
}

export interface SourceStructure {
  components: string[];
  pages: string[];
  routes: string[];
  hooks: string[];
  services: string[];
  utils: string[];
  store: string[];
  middleware: string[];
  config: string[];
  entryPoints: string[];
}

export interface FrameworkConfig {
  framework: string | null;
  uiLibrary: string | null;
  router: string | null;
  stateManagement: string | null;
  cssFramework: string | null;
  tsConfigPaths: Record<string, string[]>;
}

export interface ProjectContext {
  languages: string[];
  manifests: { file: string; contentSummary: string }[];
  databaseSchemas: FileSummary[];
  documentation: FileSummary[];
  infrastructure: string[];
  envKeys: string[];
  sourceStructure: SourceStructure;
  frameworkConfig: FrameworkConfig;
  keySourceFiles: FileSummary[];
}

export class ProjectScanner {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  public async scan(): Promise<ProjectContext> {
    const [manifests, dbSchemas, documentation, infraFiles, envKeys, sourceStructure, frameworkConfig, keySourceFiles] =
      await Promise.all([
        this.detectManifests(),
        this.readDatabaseSchemas(),
        this.readDocumentation(),
        this.detectInfrastructure(),
        this.detectEnvKeys(),
        this.scanSourceStructure(),
        this.scanFrameworkConfig(),
        this.readKeySourceFiles(),
      ]);

    const languages = this.deduceLanguages(manifests.map((m: { file: string }) => m.file));

    return {
      languages,
      manifests,
      databaseSchemas: dbSchemas,
      documentation,
      infrastructure: infraFiles,
      envKeys,
      sourceStructure,
      frameworkConfig,
      keySourceFiles,
    };
  }

  private async scanSourceStructure(): Promise<SourceStructure> {
    const patterns = {
      components: [
        'src/components/**/*.{tsx,jsx,vue,svelte}',
        'components/**/*.{tsx,jsx,vue,svelte}',
        'app/components/**/*.{tsx,jsx,vue,svelte}',
      ],
      pages: [
        'src/pages/**/*.{tsx,jsx,vue,svelte}',
        'src/screens/**/*.{tsx,jsx,vue,svelte}',
        'src/views/**/*.{tsx,jsx,vue,svelte}',
        'pages/**/*.{tsx,jsx,vue,svelte}',
        'app/**/page.{tsx,jsx,vue,svelte}',
        'app/**/layout.{tsx,jsx,vue,svelte}',
      ],
      routes: [
        'src/routes/**/*.{ts,js,tsx,jsx}',
        'src/router/**/*.{ts,js,tsx,jsx}',
        'src/api/**/*.{ts,js,tsx,jsx}',
        'src/server/**/*.{ts,js,tsx,jsx}',
        'app/api/**/*.{ts,js,tsx,jsx}',
        'routes/**/*.{ts,js,tsx,jsx}',
      ],
      hooks: [
        'src/hooks/**/*.{ts,js,tsx,jsx}',
        'src/composables/**/*.{ts,js,vue}',
        'composables/**/*.{ts,js,vue}',
        'hooks/**/*.{ts,js,tsx,jsx}',
      ],
      services: [
        'src/services/**/*.{ts,js}',
        'src/api/**/*.{ts,js}',
        'services/**/*.{ts,js}',
      ],
      utils: [
        'src/utils/**/*.{ts,js}',
        'src/lib/**/*.{ts,js}',
        'src/helpers/**/*.{ts,js}',
        'utils/**/*.{ts,js}',
        'lib/**/*.{ts,js}',
      ],
      store: [
        'src/store/**/*.{ts,js}',
        'src/redux/**/*.{ts,js}',
        'src/context/**/*.{ts,js}',
        'src/stores/**/*.{ts,js}',
        'store/**/*.{ts,js}',
      ],
      middleware: [
        'src/middleware/**/*.{ts,js}',
        'middleware/**/*.{ts,js}',
      ],
      config: [
        'tsconfig*.json',
        'vite.config.*',
        'next.config.*',
        'nuxt.config.*',
        'svelte.config.*',
        'astro.config.*',
        'remix.config.*',
        'gatsby-config.*',
        'angular.json',
        'webpack.config.*',
        'rollup.config.*',
        'esbuild.config.*',
        'jest.config.*',
        'vitest.config.*',
        'playwright.config.*',
        'cypress.config.*',
        'tailwind.config.*',
        'postcss.config.*',
        'eslint.config.*',
        '.eslintrc*',
      ],
      entryPoints: [
        'src/main.{ts,tsx,js,jsx}',
        'src/index.{ts,tsx,js,jsx}',
        'src/App.{tsx,jsx,vue}',
        'src/app.{tsx,jsx,vue}',
        'src/bin/**/*.{ts,tsx,js,jsx}',
        'bin/**/*.{ts,tsx,js,jsx}',
        'app/layout.{tsx,jsx}',
        'app/page.{tsx,jsx}',
        'pages/index.{tsx,jsx,vue}',
        'pages/_app.{tsx,jsx}',
        'src/entry.{ts,tsx,js,jsx}',
        'main.{ts,tsx,js,jsx}',
        'index.{ts,tsx,js,jsx}',
      ],
    };

    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/vendor/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.astro/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/*.stories.{ts,tsx,js,jsx}',
      '**/storybook-static/**',
    ];

    const result: SourceStructure = {
      components: [],
      pages: [],
      routes: [],
      hooks: [],
      services: [],
      utils: [],
      store: [],
      middleware: [],
      config: [],
      entryPoints: [],
    };

    for (const [key, patternList] of Object.entries(patterns)) {
      const files = await fg(patternList, {
        cwd: this.rootDir,
        deep: 5,
        ignore: ignorePatterns,
      });
      (result as any)[key] = files.sort();
    }

    return result;
  }

  private async scanFrameworkConfig(): Promise<FrameworkConfig> {
    const config: FrameworkConfig = {
      framework: null,
      uiLibrary: null,
      router: null,
      stateManagement: null,
      cssFramework: null,
      tsConfigPaths: {},
    };

    // Detectar framework por archivos de config
    const files = await fg(
      [
        'next.config.*',
        'nuxt.config.*',
        'svelte.config.*',
        'astro.config.*',
        'remix.config.*',
        'gatsby-config.*',
        'angular.json',
        'vite.config.*',
        'vue.config.*',
      ],
      { cwd: this.rootDir, deep: 2, ignore: ['**/node_modules/**'] }
    );

    for (const file of files) {
      if (file.startsWith('next.config')) config.framework = 'Next.js';
      else if (file.startsWith('nuxt.config')) config.framework = 'Nuxt';
      else if (file.startsWith('svelte.config')) config.framework = 'SvelteKit';
      else if (file.startsWith('astro.config')) config.framework = 'Astro';
      else if (file.startsWith('remix.config')) config.framework = 'Remix';
      else if (file.startsWith('gatsby-config')) config.framework = 'Gatsby';
      else if (file === 'angular.json') config.framework = 'Angular';
      else if (file.startsWith('vue.config')) config.framework = 'Vue CLI';
      else if (file.startsWith('vite.config')) config.framework = 'Vite';
    }

    // Detectar por dependencias
    try {
      const pkgPath = path.join(this.rootDir, 'package.json');
      const rawContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(rawContent);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const deps = Object.keys(allDeps || {});

      if (deps.includes('react')) config.uiLibrary = 'React';
      if (deps.includes('vue') || deps.includes('vue-router')) config.uiLibrary = 'Vue';
      if (deps.includes('@angular/core')) config.uiLibrary = 'Angular';
      if (deps.includes('svelte')) config.uiLibrary = 'Svelte';
      if (deps.includes('solid-js')) config.uiLibrary = 'SolidJS';

      if (deps.includes('next')) config.framework = 'Next.js';
      else if (deps.includes('nuxt') || deps.includes('nuxt3')) config.framework = 'Nuxt';
      else if (deps.includes('@sveltejs/kit')) config.framework = 'SvelteKit';
      else if (deps.includes('astro')) config.framework = 'Astro';
      else if (deps.includes('@remix-run/react')) config.framework = 'Remix';
      else if (deps.includes('gatsby')) config.framework = 'Gatsby';
      else if (deps.includes('@angular/core')) config.framework = 'Angular';
      else if (deps.includes('vite')) config.framework = config.framework || 'Vite';

      if (deps.includes('react-router-dom') || deps.includes('vue-router')) config.router = 'Declarative Router';
      if (deps.includes('@tanstack/react-router')) config.router = 'TanStack Router';
      if (deps.includes('next') || deps.includes('@remix-run/react')) config.router = 'File-based Router';

      if (deps.includes('redux') || deps.includes('react-redux')) config.stateManagement = 'Redux';
      if (deps.includes('zustand')) config.stateManagement = 'Zustand';
      if (deps.includes('@tanstack/react-query') || deps.includes('@tanstack/vue-query')) config.stateManagement = 'TanStack Query';
      if (deps.includes('pinia')) config.stateManagement = 'Pinia';
      if (deps.includes('mobx')) config.stateManagement = 'MobX';

      if (deps.includes('tailwindcss')) config.cssFramework = 'Tailwind CSS';
      if (deps.includes('styled-components')) config.cssFramework = 'Styled Components';
      if (deps.includes('@emotion/react')) config.cssFramework = 'Emotion';
      if (deps.includes('sass') || deps.includes('node-sass')) config.cssFramework = 'Sass';
      if (deps.includes('bootstrap')) config.cssFramework = 'Bootstrap';
      if (deps.includes('@mui/material')) config.cssFramework = 'Material UI';
    } catch {
      getLogger().debug('No se pudo leer o parsear package.json para detectar framework');
    }

    // Leer tsconfig paths
    try {
      const tsConfigPath = path.join(this.rootDir, 'tsconfig.json');
      const raw = await fs.readFile(tsConfigPath, 'utf-8');
      const tsConfig = JSON.parse(raw);
      if (tsConfig.compilerOptions?.paths) {
        config.tsConfigPaths = tsConfig.compilerOptions.paths;
      }
    } catch {
      getLogger().debug('No se encontró tsconfig.json o no tiene paths configurados');
    }

    return config;
  }

  private async readKeySourceFiles(): Promise<FileSummary[]> {
    const candidates = [
      'src/main.{ts,tsx,js,jsx}',
      'src/index.{ts,tsx,js,jsx}',
      'src/App.{tsx,jsx,vue}',
      'src/app.{tsx,jsx,vue}',
      'src/bin/**/*.{ts,tsx,js,jsx}',
      'bin/**/*.{ts,tsx,js,jsx}',
      'app/layout.{tsx,jsx}',
      'app/page.{tsx,jsx}',
      'src/router/index.{ts,tsx,js,jsx}',
      'src/routes/index.{ts,tsx,js,jsx}',
      'src/store/index.{ts,js}',
      'src/api/index.{ts,js}',
      'src/services/index.{ts,js}',
      'vite.config.*',
      'next.config.*',
      'nuxt.config.*',
      'tailwind.config.*',
      'tsconfig.json',
    ];

    const files = await fg(candidates, {
      cwd: this.rootDir,
      deep: 3,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });

    const summaries: FileSummary[] = [];
    let totalBytesRead = 0;
    const MAX_KEY_FILES_BYTES = 15000;

    for (const relPath of files.slice(0, 20)) {
      if (totalBytesRead >= MAX_KEY_FILES_BYTES) break;

      try {
        const fullPath = path.join(this.rootDir, relPath);
        const rawContent = await fs.readFile(fullPath, 'utf-8');
        const content =
          rawContent.length > 2000
            ? rawContent.slice(0, 2000) + '\n... [TRUNCATED DUE TO SIZE]'
            : rawContent;

        summaries.push({ path: relPath, content });
        totalBytesRead += content.length;
      } catch {
        getLogger().debug('No se pudo leer archivo clave', { path: relPath });
      }
    }

    return summaries;
  }

  // Lee el contenido real de esquemas de BD, modelos y migraciones
  private async readDatabaseSchemas(): Promise<FileSummary[]> {
    const patterns = [
      '**/*schema.prisma',
      '**/*schema.sql',
      '**/db/schema.{ts,js}',
      '**/models/**/*.{ts,js,py}',
      '**/entities/**/*.{ts,js}',
      '**/migrations/**/*.{sql,ts,js}',
      '**/database/migrations/**/*.{sql,ts,js}',
    ];

    const files = await fg(patterns, {
      cwd: this.rootDir,
      deep: 4,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/vendor/**'],
    });

    const summaries: FileSummary[] = [];
    let totalBytesRead = 0;
    const MAX_SCHEMA_BYTES = 30000; // Límite de 30KB para evitar sobrecarga de tokens

    for (const relPath of files) {
      if (totalBytesRead >= MAX_SCHEMA_BYTES) break;

      try {
        const fullPath = path.join(this.rootDir, relPath);
        const rawContent = await fs.readFile(fullPath, 'utf-8');

        const content =
          rawContent.length > 4000
            ? rawContent.slice(0, 4000) + '\n... [TRUNCATED DUE TO SIZE]'
            : rawContent;

        summaries.push({ path: relPath, content });
        totalBytesRead += content.length;
      } catch {
        getLogger().debug('No se pudo leer archivo de esquema', { path: relPath });
      }
    }

    return summaries;
  }

  // Lee documentación existente (README, docs, architecture)
  private async readDocumentation(): Promise<FileSummary[]> {
    const patterns = [
      'README.md',
      'README',
      'ARCHITECTURE.md',
      'docs/**/*.md',
      '.github/**/*.md',
    ];

    const files = await fg(patterns, {
      cwd: this.rootDir,
      deep: 3,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });

    const docs: FileSummary[] = [];
    let totalBytesRead = 0;
    const MAX_DOCS_BYTES = 20000; // Límite de 20KB para documentación

    for (const relPath of files) {
      if (totalBytesRead >= MAX_DOCS_BYTES) break;

      try {
        const fullPath = path.join(this.rootDir, relPath);
        const rawContent = await fs.readFile(fullPath, 'utf-8');

        const content =
          rawContent.length > 3000
            ? rawContent.slice(0, 3000) + '\n... [TRUNCATED]'
            : rawContent;

        docs.push({ path: relPath, content });
        totalBytesRead += content.length;
      } catch {
        getLogger().debug('No se pudo leer documentación', { path: relPath });
      }
    }

    return docs;
  }

  private async detectManifests(): Promise<{ file: string; contentSummary: string }[]> {
    const patterns = [
      'package.json',
      'composer.json',
      'requirements.txt',
      'pyproject.toml',
      'Pipfile',
      'go.mod',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      '*.csproj',
      'Gemfile',
    ];

    const files = await fg(patterns, {
      cwd: this.rootDir,
      deep: 2,
      ignore: ['**/node_modules/**', '**/vendor/**', '**/target/**', '**/dist/**'],
    });

    const results: { file: string; contentSummary: string }[] = [];

    for (const relPath of files) {
      try {
        const fullPath = path.join(this.rootDir, relPath);
        const rawContent = await fs.readFile(fullPath, 'utf-8');

        let summary = rawContent;
        if (relPath === 'package.json') {
          const pkg = JSON.parse(rawContent);
          summary = JSON.stringify(
            {
              name: pkg.name,
              dependencies: pkg.dependencies,
              devDependencies: pkg.devDependencies,
              engines: pkg.engines,
            },
            null,
            2
          );
        } else if (rawContent.length > 2000) {
          summary = rawContent.slice(0, 2000) + '\n... [TRUNCATED]';
        }

        results.push({ file: relPath, contentSummary: summary });
      } catch {
        getLogger().debug('No se pudo leer manifiesto', { path: relPath });
      }
    }

    return results;
  }

  private async detectInfrastructure(): Promise<string[]> {
    return fg(['Dockerfile*', 'docker-compose*.{yml,yaml}', 'k8s/**/*.{yml,yaml}', 'serverless.{yml,ts,js}'], {
      cwd: this.rootDir,
      deep: 3,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
  }

  private async detectEnvKeys(): Promise<string[]> {
    const envTemplates = ['.env.example', '.env.template', '.env.dist', '.env.sample'];
    const keys: string[] = [];

    for (const file of envTemplates) {
      const fullPath = path.join(this.rootDir, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const key = trimmed.split('=')[0].trim();
            if (key) keys.push(key);
          }
        }
        break;
      } catch {
        getLogger().debug('Template .env no encontrado', { file });
      }
    }

    return keys;
  }

  private deduceLanguages(manifestFiles: string[]): string[] {
    const langs = new Set<string>();

    for (const file of manifestFiles) {
      if (file.endsWith('package.json')) langs.add('JavaScript/TypeScript');
      if (file.endsWith('requirements.txt') || file.endsWith('pyproject.toml') || file.endsWith('Pipfile')) langs.add('Python');
      if (file.endsWith('composer.json')) langs.add('PHP');
      if (file.endsWith('go.mod')) langs.add('Go');
      if (file.endsWith('Cargo.toml')) langs.add('Rust');
      if (file.endsWith('pom.xml') || file.endsWith('build.gradle')) langs.add('Java/Kotlin');
      if (file.endsWith('.csproj')) langs.add('C#/.NET');
      if (file.endsWith('Gemfile')) langs.add('Ruby');
    }

    return Array.from(langs);
  }
}

function formatFileList(files: string[], max = 15): string {
  if (files.length === 0) return '*Ninguno detectado*';
  const shown = files.slice(0, max);
  const remaining = files.length - max;
  return shown.join(', ') + (remaining > 0 ? ` ... y ${remaining} más` : '');
}

export function formatContextForLLM(ctx: ProjectContext): string {
  const docsBlock =
    ctx.documentation.length > 0
      ? `\n#### DOCUMENTACIÓN DEL PROYECTO (README / DOCS):\n` +
      ctx.documentation.map((d) => `**[${d.path}]**\n\`\`\`markdown\n${d.content}\n\`\`\``).join('\n\n')
      : '';

  const dbBlock =
    ctx.databaseSchemas.length > 0
      ? `\n#### ESQUEMAS DE BASE DE DATOS Y MODELOS DETECTADOS:\n` +
      ctx.databaseSchemas.map((s) => `**[${s.path}]**\n\`\`\`\n${s.content}\n\`\`\``).join('\n\n')
      : '\n*No se encontraron esquemas ni migraciones legibles.*';

  const sourceBlock = `
#### ESTRUCTURA DEL CÓDIGO FUENTE:
- **Framework:** ${ctx.frameworkConfig.framework || 'No detectado'}
- **UI Library:** ${ctx.frameworkConfig.uiLibrary || 'No detectada'}
- **Router:** ${ctx.frameworkConfig.router || 'No detectado'}
- **State Management:** ${ctx.frameworkConfig.stateManagement || 'No detectado'}
- **CSS Framework:** ${ctx.frameworkConfig.cssFramework || 'No detectado'}
- **TypeScript Paths:** ${Object.keys(ctx.frameworkConfig.tsConfigPaths).length > 0 ? JSON.stringify(ctx.frameworkConfig.tsConfigPaths) : 'Ninguno'}

- **Entry Points:** ${formatFileList(ctx.sourceStructure.entryPoints)}
- **Componentes (${ctx.sourceStructure.components.length}):** ${formatFileList(ctx.sourceStructure.components)}
- **Páginas (${ctx.sourceStructure.pages.length}):** ${formatFileList(ctx.sourceStructure.pages)}
- **Rutas API/Servidor (${ctx.sourceStructure.routes.length}):** ${formatFileList(ctx.sourceStructure.routes)}
- **Hooks (${ctx.sourceStructure.hooks.length}):** ${formatFileList(ctx.sourceStructure.hooks)}
- **Servicios (${ctx.sourceStructure.services.length}):** ${formatFileList(ctx.sourceStructure.services)}
- **Utils (${ctx.sourceStructure.utils.length}):** ${formatFileList(ctx.sourceStructure.utils)}
- **Store/State (${ctx.sourceStructure.store.length}):** ${formatFileList(ctx.sourceStructure.store)}
- **Middleware (${ctx.sourceStructure.middleware.length}):** ${formatFileList(ctx.sourceStructure.middleware)}
- **Config (${ctx.sourceStructure.config.length}):** ${formatFileList(ctx.sourceStructure.config)}
`;

  const keyFilesBlock =
    ctx.keySourceFiles.length > 0
      ? `\n#### ARCHIVOS CLAVE LEÍDOS AUTOMÁTICAMENTE:\n` +
      ctx.keySourceFiles.map((f) => `**[${f.path}]**\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
      : '';

  return `
### CONTEXTO TÉCNICO COMPLETO DEL REPOSITORIO
- **Lenguajes:** ${ctx.languages.join(', ') || 'No identificados'}
- **Infraestructura:** ${ctx.infrastructure.join(', ') || 'Ninguna'}
- **Variables de Entorno Clave (.env.example):** ${ctx.envKeys.join(', ') || 'Ninguna'}

#### Manifiestos de Dependencias:
${ctx.manifests.map((m) => `**[${m.file}]**\n\`\`\`json\n${m.contentSummary}\n\`\`\``).join('\n\n')}
${sourceBlock}
${keyFilesBlock}
${docsBlock}
${dbBlock}
`.trim();
}
