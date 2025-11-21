import path from 'path';
import { BazaarConfig, FileSystemService } from '../types.js';

export class ConfigLoader {
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async load(projectDir: string): Promise<BazaarConfig> {
    const configPath = path.join(projectDir, 'claude-bazaar.config.ts');

    if (!await this.fileSystem.exists(configPath)) {
      throw new Error(`Config not found: ${configPath}. Run 'bazaar init' first.`);
    }

    const content = await this.fileSystem.readFile(configPath);
    return this.parseConfig(content);
  }

  private parseConfig(content: string): BazaarConfig {
    // Extract the object literal from the export default statement
    const match = content.match(/export\s+default\s+({[\s\S]*});?\s*$/);
    if (!match) {
      throw new Error('Invalid config format: expected "export default { ... }"');
    }

    try {
      // Use Function constructor for safer eval
      const configFn = new Function(`return ${match[1]}`);
      return configFn() as BazaarConfig;
    } catch (error) {
      throw new Error(`Failed to parse config: ${(error as Error).message}`);
    }
  }
}
