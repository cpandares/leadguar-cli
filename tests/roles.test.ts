import { describe, it, expect } from 'vitest';
import { TECHNICAL_ROLES, getRoleModifierPrompt, ROLE_INQUIRER_CHOICES } from '../src/core/roles.js';
import { buildSystemPrompt, BASE_LEADGUARD_PROMPT } from '../src/prompts/system-prompt.js';

describe('Roles & System Prompts', () => {
  it('debe tener definidos los 5 roles técnicos especializados', () => {
    expect(TECHNICAL_ROLES).toHaveLength(5);
    const keys = TECHNICAL_ROLES.map((r) => r.key);
    expect(keys).toContain('SAP_B1_SPECIALIST');
    expect(keys).toContain('SQL_DB_ARCHITECT');
    expect(keys).toContain('FRONTEND_REACT');
    expect(keys).toContain('BACKEND_DISTRIBUTED');
    expect(keys).toContain('GENERAL_TECH_LEAD');
  });

  it('debe retornar el modifierPrompt correspondiente según la clave de rol', () => {
    const sapPrompt = getRoleModifierPrompt('SAP_B1_SPECIALIST');
    expect(sapPrompt).toContain('SAP BUSINESS ONE');

    const sqlPrompt = getRoleModifierPrompt('SQL_DB_ARCHITECT');
    expect(sqlPrompt).toContain('BASES DE DATOS RELACIONALES & SQL');
  });

  it('debe retornar el rol por defecto GENERAL_TECH_LEAD si la clave no existe', () => {
    const unknownPrompt = getRoleModifierPrompt('ROLE_INEXISTENTE');
    const defaultPrompt = getRoleModifierPrompt('GENERAL_TECH_LEAD');
    expect(unknownPrompt).toEqual(defaultPrompt);
  });

  it('debe inyectar la directiva del rol dinámicamente en buildSystemPrompt', () => {
    const roleDirective = '### ENFOQUE DE AUDITORÍA PRUEBA';
    const resultPrompt = buildSystemPrompt(roleDirective);

    expect(resultPrompt).toContain(BASE_LEADGUARD_PROMPT);
    expect(resultPrompt).toContain('ESPECIALIZACIÓN TÉCNICA ACTIVA');
    expect(resultPrompt).toContain('### ENFOQUE DE AUDITORÍA PRUEBA');
  });

  it('debe retornar el prompt base si no se proporciona roleDirective', () => {
    const baseResult = buildSystemPrompt();
    expect(baseResult).toEqual(BASE_LEADGUARD_PROMPT);
  });
});
