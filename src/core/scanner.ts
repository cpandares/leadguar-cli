import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { getLogger } from './logger.js';

export interface FileSummary {
  path: string;
  content: string;
}

export interface ProjectContext {
  languages: string[];
  manifests: { file: string; contentSummary: string }[];
  databaseSchemas: FileSummary[];
  documentation: FileSummary[];
  infrastructure: string[];
  envKeys: string[];
}

export class ProjectScanner {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  public async scan(): Promise<ProjectContext> {
    const [manifests, dbSchemas, documentation, infraFiles, envKeys] = await Promise.all([
      this.detectManifests(),
      this.readDatabaseSchemas(),
      this.readDocumentation(),
      this.detectInfrastructure(),
      this.detectEnvKeys(),
    ]);

    const languages = this.deduceLanguages(manifests.map((m) => m.file));

    return {
      languages,
      manifests,
      databaseSchemas: dbSchemas,
      documentation,
      infrastructure: infraFiles,
      envKeys,
    };
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

  return `
### CONTEXTO TÉCNICO COMPLETO DEL REPOSITORIO
- **Lenguajes:** ${ctx.languages.join(', ') || 'No identificados'}
- **Infraestructura:** ${ctx.infrastructure.join(', ') || 'Ninguna'}
- **Variables de Entorno Clave (.env.example):** ${ctx.envKeys.join(', ') || 'Ninguna'}

#### Manifiestos de Dependencias:
${ctx.manifests.map((m) => `**[${m.file}]**\n\`\`\`json\n${m.contentSummary}\n\`\`\``).join('\n\n')}
${docsBlock}
${dbBlock}
`.trim();
}