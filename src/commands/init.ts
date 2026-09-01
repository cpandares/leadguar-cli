import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { loadLocalConfig, saveLocalConfig } from '../core/state.js';
import { ROLE_INQUIRER_CHOICES, TECHNICAL_ROLES } from '../core/roles.js';

export async function initCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n🛡️  LeadGuard - Inicialización de Proyecto\n'));

  const existingConfig = await loadLocalConfig();
  if (existingConfig && existingConfig.selectedRole) {
    const currentRole = TECHNICAL_ROLES.find((r) => r.key === existingConfig.selectedRole);
    console.log(
      chalk.yellow(`El proyecto ya está inicializado con el perfil: ${chalk.bold.white(currentRole?.name || existingConfig.selectedRole)}\n`)
    );
  }

  const selectedRole = await select({
    message: 'Selecciona el perfil técnico especializado de LeadGuard para este proyecto:',
    choices: ROLE_INQUIRER_CHOICES,
  });

  const newConfig = {
    selectedRole,
    initializedAt: new Date().toISOString(),
  };

  await saveLocalConfig(newConfig);

  const roleInfo = TECHNICAL_ROLES.find((r) => r.key === selectedRole);
  console.log(
    chalk.green(`\nConfiguración guardada exitosamente en .leadguard/config.json`)
  );
  console.log(
    chalk.gray(`Perfil activo: ${chalk.bold.white(roleInfo?.name || selectedRole)}\n`)
  );
}
