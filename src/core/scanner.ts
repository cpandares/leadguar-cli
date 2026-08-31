import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

export interface ProjectContext {
  languages: string[];
  manifests: { file: string; contentSummary: string }[];
  databaseArtifacts: string[];
  infrastructure: string[];
  envKeys: string[];
  gitBranch?: string;
}

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
    const [manifests, dbFiles, infraFiles, envKeys] = await Promise.all([
      this.detectManifests(),
      this.detectDatabaseArtifacts(),
      this.detectInfrastructure(),
      this.detectEnvKeys(),
    ]);

    const languages = this.deduceLanguages(manifests.map((m) => m.file));

    return {
      languages,
      manifests,
      databaseArtifacts: dbFiles,
      infrastructure: infraFiles,
      envKeys,
    };
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
        // Archivo no legible o JSON inválido
      }
    }

    return results;
  }

  private async detectDatabaseArtifacts(): Promise<string[]> {
    const patterns = [
      '**/*schema.prisma',
      '**/*schema.sql',
      '**/migrations/**/*.{sql,ts,js,py}',
      '**/database/migrations/**/*',
      '**/db/migrations/**/*',
      '**/models/**/*.{ts,js,py,go,php}',
      '**/entities/**/*.{ts,js,java}',
      '**/alembic/**/*',
      '**/knexfile.{js,ts}',
      '**/ormconfig.{json,js,ts}',
    ];

    const matches = await fg(patterns, {
      cwd: this.rootDir,
      deep: 4,
      ignore: ['**/node_modules/**', '**/vendor/**', '**/dist/**', '**/.git/**'],
    });

    return matches.slice(0, 30);
  }

  private async detectInfrastructure(): Promise<string[]> {
    const patterns = [
      'Dockerfile*',
      'docker-compose*.{yml,yaml}',
      'k8s/**/*.{yml,yaml}',
      'kubernetes/**/*.{yml,yaml}',
      'helm/**/*',
      'Procfile',
      'serverless.{yml,ts,js}',
      'terraform/**/*.tf',
    ];

    return fg(patterns, {
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
        // El archivo no existe, continúa buscando
      }
    }

    return keys;
  }

  private deduceLanguages(manifestFiles: string[]): string[] {
    const langs = new Set<string>();

    for (const file of manifestFiles) {
      if (file.endsWith('package.json')) langs.add('JavaScript/TypeScript');
      if (file.endsWith('requirements.txt') || file.endsWith('pyproject.toml')) langs.add('Python');
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
  const docsBlock = ctx.documentation.length > 0
    ? `\n#### DOCUMENTACIÓN DEL PROYECTO (README / DOCS):\n` +
      ctx.documentation.map((d) => `**[${d.path}]**\n\`\`\`markdown\n${d.content}\n\`\`\``).join('\n\n')
    : '';

  const dbBlock = ctx.databaseSchemas.length > 0
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