#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { taskCommand } from '../commands/task.js';
import { initCommand } from '../commands/init.js';
import { initLogger, getLogger } from '../core/logger.js';

initLogger(process.cwd());

const program = new Command();

program
  .name('leadguard')
  .description('Agente PM Técnico y Supervisor de Arquitectura')
  .version('1.1.1');

program
  .command('init')
  .description('Inicializa la configuración local de LeadGuard (.leadguard/config.json) y selecciona el perfil técnico')
  .action(async () => {
    try {
      await initCommand();
    } catch (error: any) {
      getLogger().error('Error durante la inicialización', { error: error.message, stack: error.stack });
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('task')
  .description('Inicia el discovery interactivo y genera el SPEC técnico de una tarea')
  .argument('[description]', 'Descripción inicial de la tarea')
  .action(async (description) => {
    try {
      await taskCommand(description);
    } catch (error: any) {
      getLogger().error('Error durante la ejecución de tarea', { error: error.message, stack: error.stack });
      console.error(chalk.red(`\nError: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse(process.argv);
