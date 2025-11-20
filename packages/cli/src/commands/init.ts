import path from 'path';
import { FileSystemService } from '../types.js';

export class InitCommand {
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async execute(projectDir: string = process.cwd()): Promise<void> {
    const configPath = path.join(projectDir, 'shipyard.config.ts');

    if (await this.fileSystem.exists(configPath)) {
      console.log('Already initialized (shipyard.config.ts exists)');
      return;
    }

    const projectName = path.basename(projectDir);
    const config = this.generateConfig(projectName);

    await this.fileSystem.writeFile(configPath, config);
    console.log('Created shipyard.config.ts');

    await this.updateGitignore(projectDir);
  }

  private generateConfig(projectName: string): string {
    return `export default {
  name: '${projectName}',
  version: '0.1.0',
  description: 'A Claude Code plugin',

  // Files to include in the container (glob patterns)
  include: [
    '**/*',
    '!node_modules/**',
    '!.git/**',
    '!dist/**',
    '!.shipyard/**',
  ],

  // Runtime configuration
  runtime: {
    port: 3000,
    timeout: 120000, // 2 minutes
  },
};
`;
  }

  private async updateGitignore(projectDir: string): Promise<void> {
    const gitignorePath = path.join(projectDir, '.gitignore');
    const shipyardEntry = '.shipyard/';
    const ignoreContent = `\n# Shipyard\n${shipyardEntry}\n`;

    if (await this.fileSystem.exists(gitignorePath)) {
      const content = await this.fileSystem.readFile(gitignorePath);
      if (!content.includes(shipyardEntry)) {
        await this.fileSystem.appendFile(gitignorePath, ignoreContent);
        console.log('Updated .gitignore');
      }
    } else {
      await this.fileSystem.writeFile(gitignorePath, `# Shipyard\n${shipyardEntry}\n`);
      console.log('Created .gitignore');
    }
  }
}
