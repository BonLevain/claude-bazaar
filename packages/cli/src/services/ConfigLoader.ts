import path from 'path';
import { BazaarConfig, FileSystemService } from '../types.js';

export class ConfigLoader {
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async load(projectDir: string): Promise<BazaarConfig> {
    const configPath = path.join(projectDir, 'claude-bazaar.config.json');

    if (!await this.fileSystem.exists(configPath)) {
      throw new Error(`Config not found: ${configPath}. Run 'claude-bazaar init' first.`);
    }

    const content = await this.fileSystem.readFile(configPath);

    try {
      return JSON.parse(content) as BazaarConfig;
    } catch (error) {
      throw new Error(`Failed to parse config: ${(error as Error).message}`);
    }
  }
}
