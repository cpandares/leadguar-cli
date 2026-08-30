#!/usr/bin/env node
import { Command } from 'commander';
import { taskCommand } from '../commands/task.js';

const program = new Command();

program
  .name('leadguard')
  .description('Agente PM Técnico y Supervisor de Arquitectura')
  .version('1.0.0');

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