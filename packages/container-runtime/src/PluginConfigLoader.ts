import { promises as fs } from 'fs';
import path from 'path';
import { PluginConfig } from './types.js';

export class PluginConfigLoader {
  private readonly pluginDir: string;

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }

  async load(): Promise<PluginConfig | undefined> {
    const configPath = path.join(this.pluginDir, 'claude-bazaar.config.json');

    try {
      await fs.access(configPath);
    } catch {
      console.log('No claude-bazaar.config.json found in plugin directory');
      return undefined;
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      return {
        name: config.name || 'unknown',
        version: config.version || '0.0.0',
        description: config.description || '',
        staticFiles: config.staticFiles,
      };
    } catch (error) {
      console.error('Failed to load plugin config:', (error as Error).message);
      return undefined;
    }
  }
}
