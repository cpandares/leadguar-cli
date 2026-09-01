import winston from 'winston';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';

let logger: winston.Logger | null = null;

export function initLogger(cwd: string, level?: string): winston.Logger {
  const logDir = path.join(cwd, '.leadguard', 'logs');
  fs.mkdirSync(logDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const logFile = path.join(logDir, `leadguard-${today}.log`);

  logger = winston.createLogger({
    level: level || process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` | meta: ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
      })
    ),
    transports: [
      new winston.transports.File({ filename: logFile }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.printf(({ level, message }) => {
            if (level === 'error') return chalk.red(`[ERROR] ${message}`);
            if (level === 'warn') return chalk.yellow(`[WARN] ${message}`);
            return `[${level.toUpperCase()}] ${message}`;
          })
        ),
      }),
    ],
  });

  return logger;
}

export function getLogger(): winston.Logger {
  if (!logger) {
    return winston.createLogger({ transports: [] });
  }
  return logger;
}
