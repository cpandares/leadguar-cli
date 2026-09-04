import fs from 'node:fs/promises';
import path from 'node:path';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { ProjectScanner } from '../core/scanner.js';
import { consultLeadGuard, extractFileReadRequests } from '../core/llm.js';
import { readRequestedFiles } from '../core/scanner.js';
import { loadLocalConfig, saveLocalConfig } from '../core/state.js';
import { ROLE_INQUIRER_CHOICES, TECHNICAL_ROLES } from '../core/roles.js';
import { getLogger } from '../core/logger.js';

const AUTO_READ_PATTERN = /^(inspeccion|revis|le[eé]|mira|usa|ya est|est[aá] en el c|no s[eé]|no tengo|no aplica|no lo s|no existe|no hay|no contiene| revisalo|leelo|inspeccionalo)/i;

function detectAutoReadAnswer(question: string, answer: string): string | null {
  if (AUTO_READ_PATTERN.test(answer.trim())) {
    const filePattern = /(?:src|app|components|pages|hooks|services|utils|lib|routes|api|store|middleware|bin|public|assets|styles|types|interfaces|models|entities|config|server|client)\/[\w./-]+\.(?:tsx?|jsx?|vue|svelte|json|css|scss|md|yaml|yml|sql|prisma|env)/gi;
    const match = question.match(filePattern);
    return match ? match[0] : null;
  }
  return null;
}

export async function taskCommand(initialDescription?: string): Promise<void> {
  console.log(chalk.bold.cyan('\n🛡️  LeadGuard - PM & Supervisor Técnico\n'));

  // 1. Verificar o seleccionar el rol técnico del proyecto
  let localConfig = await loadLocalConfig();
  let selectedRole: string;

  if (!localConfig || !localConfig.selectedRole) {
    console.log(chalk.yellow('Configuración de proyecto no detectada en .leadguard/\n'));
    selectedRole = await select({
      message: 'Selecciona el perfil técnico especializado de LeadGuard para este proyecto:',
      choices: ROLE_INQUIRER_CHOICES,
    });

    localConfig = {
      selectedRole,
      initializedAt: new Date().toISOString(),
    };
    await saveLocalConfig(localConfig);
    console.log(chalk.green(`\nConfiguración guardada en .leadguard/config.json\n`));
  } else {
    selectedRole = localConfig.selectedRole;
    const roleInfo = TECHNICAL_ROLES.find((r) => r.key === selectedRole);
    console.log(
      chalk.gray(`Perfil Técnico Activo: ${chalk.bold.white(roleInfo?.name || selectedRole)}\n`)
    );
  }

  // 2. Obtener la descripción inicial si no vino por CLI args
  let description = initialDescription;
  if (!description) {
    description = await input({
      message: 'Describe el requerimiento u objetivo de la tarea:',
      validate: (val) => (val.trim().length > 5 ? true : 'Sé más específico con la tarea inicial.'),
    });
  }

  // 3. Escanear el proyecto
  const spinner = ora('Escaneando contexto del repositorio...').start();
  const scanner = new ProjectScanner(process.cwd());
  const context = await scanner.scan();
  spinner.succeed('Contexto del proyecto analizado.');

  const qaHistory: { question: string; answer: string }[] = [];
  let isReady = false;
  let specOutput = '';
  const MAX_BLOCKED_ROUNDS = 5;
  let blockedRound = 0;

  // 4. Bucle interactivo de Discovery
  while (!isReady && blockedRound < MAX_BLOCKED_ROUNDS) {
    const analysisSpinner = ora('LeadGuard está analizando requerimientos y dependencias...').start();

    const result = await consultLeadGuard(description, context, qaHistory, selectedRole, process.cwd());
    analysisSpinner.stop();

    if (result.status === 'BLOCKED' && result.questions && result.questions.length > 0) {
      blockedRound++;

      if (blockedRound >= MAX_BLOCKED_ROUNDS) {
        console.log(
          chalk.red(
            `\n⚠️  Se alcanzó el límite de ${MAX_BLOCKED_ROUNDS} rondas de clarificación. Generando SPEC con el contexto disponible...\n`
          )
        );
        // Forzar generación del SPEC con lo que se tiene
        continue;
      }

      console.log(chalk.yellow('\n⚠️  Falta contexto crítico para garantizar el alcance:'));
      if (result.detectedContextSummary) {
        console.log(chalk.gray(`Contexto detectado: ${result.detectedContextSummary}\n`));
      }

      const questions = result.questions.slice(0, 10);
      if (result.questions.length > 10) {
        console.log(chalk.gray(`(Mostrando solo las 10 preguntas más críticas de ${result.questions.length})\n`));
      }

      for (const question of questions) {
        const answer = await input({
          message: chalk.whiteBright(question),
          validate: (val) => (val.trim().length > 0 ? true : 'Esta respuesta es obligatoria.'),
        });

        // Detectar si el usuario dice "leelo vos mismo"
        const autoFile = detectAutoReadAnswer(question, answer);
        if (autoFile) {
          getLogger().info('Usuario indicó leer archivo automáticamente', { file: autoFile });
          const files = await readRequestedFiles([autoFile], process.cwd());
          if (files.length > 0) {
            qaHistory.push({
              question,
              answer: `[Contenido de ${autoFile}]:\n${files[0].content}`,
            });
            console.log(chalk.gray(`  → Archivo ${autoFile} leído automáticamente.\n`));
            continue;
          }
        }

        qaHistory.push({ question, answer });
      }
      console.log(chalk.cyan('\nReevaluando con las nuevas aclaratorias...'));
    } else if (result.status === 'READY' && result.specContent) {
      isReady = true;
      specOutput = result.specContent;
    } else {
      console.log(chalk.red('Respuesta inesperada del motor de análisis. Reintentando...'));
      break;
    }
  }

  if (!isReady && blockedRound >= MAX_BLOCKED_ROUNDS) {
    const forceSpinner = ora('Generando SPEC con el contexto acumulado...').start();
    const finalResult = await consultLeadGuard(
      `GENERA UN SPEC CON LO QUE TIENES. El usuario ya no responderá más preguntas. Asume las mejores prácticas del framework detectado y documenta explícitamente cualquier suposición razonable en una sección "Supuestos". Requerimiento original: ${description}`,
      context,
      qaHistory,
      selectedRole,
      process.cwd()
    );
    forceSpinner.stop();

    if (finalResult.status === 'READY' && finalResult.specContent) {
      isReady = true;
      specOutput = finalResult.specContent;
    } else {
      console.log(chalk.red('\nNo fue posible generar el SPEC. Intenta describir el requerimiento con más detalle.\n'));
      return;
    }
  }

  // 5. Guardar el SPEC aprobado
  if (isReady && specOutput) {
    const saveSpinner = ora('Guardando especificación técnica...').start();

    const outputDir = path.join(process.cwd(), '.leadguard', 'tasks');
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const fileName = `TASK-${timestamp}.md`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, specOutput, 'utf-8');
    saveSpinner.succeed(
      chalk.green(
        `SPEC aprobado y guardado en: ${chalk.bold(path.relative(process.cwd(), filePath))}`
      )
    );

    console.log(chalk.bold.green('\n📋 Resumen del SPEC Generado:\n'));
    console.log(chalk.white(specOutput));
  }
}