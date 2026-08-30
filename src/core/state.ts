import fs from 'node:fs/promises';
import path from 'node:path';

export interface LocalProjectConfig {
  selectedRole: string;
  initializedAt: string;
}

const CONFIG_PATH = path.join(process.cwd(), '.leadguard', 'config.json');

export async function loadLocalConfig(): Promise<LocalProjectConfig | null> {
  try {
    const rawData = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(rawData) as LocalProjectConfig;
  } catch {
    return null;
  }
}

export async function saveLocalConfig(config: LocalProjectConfig): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
