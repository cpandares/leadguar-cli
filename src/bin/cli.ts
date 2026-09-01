#!/usr/bin/env node
import { Command } from 'commander';
import { taskCommand } from '../commands/task.js';
import { initCommand } from '../commands/init.js';

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
    } catch (error) {
      console.error('Error durante la inicialización:', error);
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
    } catch (error) {
      console.error('Error durante la ejecución:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);