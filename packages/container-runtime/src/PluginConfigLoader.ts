import { promises as fs } from 'fs';
import path from 'path';
import { PluginConfig } from './types.js';

export class PluginConfigLoader {
  private readonly pluginDir: string;

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }

  async load(): Promise<PluginConfig | undefined> {
    const configPath = path.join(this.pluginDir, 'claude-shipyard.config.ts');

    try {
      await fs.access(configPath);
    } catch {
      console.log('No claude-shipyard.config.ts found in plugin directory');
      return undefined;
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return this.parseConfig(content);
    } catch (error) {
      console.error('Failed to load plugin config:', (error as Error).message);
      return undefined;
    }
  }

  private parseConfig(content: string): PluginConfig {
    // Extract the object literal from the export default statement
    const match = content.match(/export\s+default\s+({[\s\S]*});?\s*$/);
    if (!match) {
      throw new Error('Invalid config format: expected "export default { ... }"');
    }

    try {
      // Use Function constructor for safer eval
      const configFn = new Function(`return ${match[1]}`);
      const config = configFn();

      return {
        name: config.name || 'unknown',
        version: config.version || '0.0.0',
        description: config.description || '',
        staticFiles: config.staticFiles,
      };
    } catch (error) {
      throw new Error(`Failed to parse config: ${(error as Error).message}`);
    }
  }
}
