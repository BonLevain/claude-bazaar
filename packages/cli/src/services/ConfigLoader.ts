import path from 'path';
import { ShipyardConfig, FileSystemService } from '../types.js';

export class ConfigLoader {
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async load(projectDir: string): Promise<ShipyardConfig> {
    const configPath = path.join(projectDir, 'claude-shipyard.config.ts');

    if (!await this.fileSystem.exists(configPath)) {
      throw new Error(`Config not found: ${configPath}. Run 'shipyard init' first.`);
    }

    const content = await this.fileSystem.readFile(configPath);
    return this.parseConfig(content);
  }

  private parseConfig(content: string): ShipyardConfig {
    // Extract the object literal from the export default statement
    const match = content.match(/export\s+default\s+({[\s\S]*});?\s*$/);
    if (!match) {
      throw new Error('Invalid config format: expected "export default { ... }"');
    }

    try {
      // Use Function constructor for safer eval
      const configFn = new Function(`return ${match[1]}`);
      return configFn() as ShipyardConfig;
    } catch (error) {
      throw new Error(`Failed to parse config: ${(error as Error).message}`);
    }
  }
}
