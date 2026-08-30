import fs from 'node:fs/promises';
import path from 'node:path';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { ProjectScanner } from '../core/scanner.js';
import { consultLeadGuard } from '../core/llm.js';

export async function taskCommand(initialDescription?: string): Promise<void> {
  console.log(chalk.bold.cyan('\n🛡️  LeadGuard - PM & Supervisor Técnico\n'));

  // 1. Obtener la descripción inicial si no vino por CLI args
  let description = initialDescription;
  if (!description) {
    description = await input({
      message: 'Describe el requerimiento u objetivo de la tarea:',
      validate: (val) => (val.trim().length > 5 ? true : 'Sé más específico con la tarea inicial.'),
    });
  }

  // 2. Escanear el proyecto
  const spinner = ora('Escaneando contexto del repositorio...').start();
  const scanner = new ProjectScanner(process.cwd());
  const context = await scanner.scan();
  spinner.succeed('Contexto del proyecto analizado.');

  const qaHistory: { question: string; answer: string }[] = [];
  let isReady = false;
  let specOutput = '';

  // 3. Bucle interactivo de Discovery
  while (!isReady) {
    const analysisSpinner = ora('LeadGuard está analizando requerimientos y dependencias...').start();
    
    const result = await consultLeadGuard(description, context, qaHistory);
    analysisSpinner.stop();

    if (result.status === 'BLOCKED' && result.questions && result.questions.length > 0) {
      console.log(chalk.yellow('\n⚠️  Falta contexto crítico para garantizar el alcance:'));
      if (result.detectedContextSummary) {
        console.log(chalk.gray(`Contexto detectado: ${result.detectedContextSummary}\n`));
      }

      for (const question of result.questions) {
        const answer = await input({
          message: chalk.whiteBright(question),
          validate: (val) => (val.trim().length > 0 ? true : 'Esta respuesta es obligatoria.'),
        });
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

  // 4. Guardar el SPEC aprobado
  if (isReady && specOutput) {
    const saveSpinner = ora('Guardando especificación técnica...').start();
    
    const outputDir = path.join(process.cwd(), '.leadguard', 'tasks');
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const fileName = `TASK-${timestamp}.md`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, specOutput, 'utf-8');
    saveSpinner.succeed(chalk.green(`SPEC aprobado y guardado en: ${chalk.bold(path.relative(process.cwd(), filePath))}`));

    console.log(chalk.bold.green('\n📋 Resumen del SPEC Generado:\n'));
    console.log(chalk.white(specOutput));
  }
}