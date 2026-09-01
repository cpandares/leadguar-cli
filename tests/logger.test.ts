import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initLogger, getLogger } from '../src/core/logger.js';

describe('Logger', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadguard-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('debe crear el directorio .leadguard/logs/ si no existe', () => {
    initLogger(tmpDir, 'info');
    const logDir = path.join(tmpDir, '.leadguard', 'logs');
    expect(fs.existsSync(logDir)).toBe(true);
  });

  it('debe crear el archivo de log con el nombre correcto (fecha)', async () => {
    initLogger(tmpDir, 'info');
    getLogger().info('init');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tmpDir, '.leadguard', 'logs', `leadguard-${today}.log`);
    expect(fs.existsSync(logFile)).toBe(true);
  });

  it('debe retornar un logger válido con getLogger() sin init previo', () => {
    const logger = getLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
  });

  it('debe escribir mensajes de error en el archivo de log', async () => {
    initLogger(tmpDir, 'debug');
    const logger = getLogger();
    logger.error('Mensaje de prueba', { code: 'TEST_ERROR' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tmpDir, '.leadguard', 'logs', `leadguard-${today}.log`);
    const content = fs.readFileSync(logFile, 'utf-8');

    expect(content).toContain('Mensaje de prueba');
    expect(content).toContain('TEST_ERROR');
    expect(content).toContain('[ERROR]');
  });

  it('debe respetar el nivel de log configurado', async () => {
    initLogger(tmpDir, 'error');
    const logger = getLogger();
    logger.debug('Este mensaje no debería aparecer');
    logger.info('Este tampoco');
    logger.error('Este sí debería aparecer');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tmpDir, '.leadguard', 'logs', `leadguard-${today}.log`);
    const content = fs.readFileSync(logFile, 'utf-8');

    expect(content).not.toContain('Este mensaje no debería aparecer');
    expect(content).not.toContain('Este tampoco');
    expect(content).toContain('Este sí debería aparecer');
  });
});
