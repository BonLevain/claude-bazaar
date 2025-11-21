import path from 'path';
import readline from 'readline';
import { FileSystemService, StaticFileConfig } from '../types.js';

export class InitCommand {
  private readonly fileSystem: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
  }

  async execute(projectDir: string = process.cwd()): Promise<void> {
    const configPath = path.join(projectDir, 'claude-shipyard.config.ts');

    if (await this.fileSystem.exists(configPath)) {
      console.log('Already initialized (claude-shipyard.config.ts exists)');
      return;
    }

    const defaultName = path.basename(projectDir);

    // Get project name and description
    const { name: projectName, description } = await this.promptForProjectInfo(defaultName);

    // Get runtime selection from user
    const runtimeImage = await this.promptForRuntime();

    // Get dependencies configuration
    const dependencies = await this.promptForDependencies(projectDir);

    // Get static files configuration
    const staticFiles = await this.promptForStaticFiles(projectDir);

    const config = this.generateConfig(projectName, description, runtimeImage, dependencies, staticFiles);

    await this.fileSystem.writeFile(configPath, config);
    console.log('Created claude-shipyard.config.ts');

    await this.updateGitignore(projectDir);
  }

  private async promptForProjectInfo(defaultName: string): Promise<{ name: string; description: string }> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    try {
      const name = await question(`Project name [${defaultName}]: `);
      const description = await question('Description [A Claude Code plugin]: ');

      return {
        name: name || defaultName,
        description: description || 'A Claude Code plugin',
      };
    } finally {
      rl.close();
    }
  }

  private async promptForDependencies(projectDir: string): Promise<{ python?: string; node?: string }> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    const dependencies: { python?: string; node?: string } = {};

    try {
      // Check for Python dependencies
      const defaultRequirements = './requirements.txt';
      const hasRequirements = await this.fileSystem.exists(path.join(projectDir, 'requirements.txt'));

      if (hasRequirements) {
        console.log(`\nDetected requirements.txt`);
        const useIt = await question('Include Python dependencies? [Y/n]: ');
        if (useIt.toLowerCase() !== 'n') {
          dependencies.python = defaultRequirements;
          console.log(`Using: ${defaultRequirements}`);
        }
      } else {
        const addPython = await question('\nPath to requirements.txt (or press Enter to skip): ');
        if (addPython) {
          if (await this.fileSystem.exists(path.join(projectDir, addPython))) {
            dependencies.python = addPython.startsWith('./') ? addPython : `./${addPython}`;
            console.log(`Using: ${dependencies.python}`);
          } else {
            console.log(`File not found: ${addPython}, skipping`);
          }
        }
      }

      // Check for Node dependencies
      const defaultPackageJson = './package.json';
      const hasPackageJson = await this.fileSystem.exists(path.join(projectDir, 'package.json'));

      if (hasPackageJson) {
        console.log(`\nDetected package.json`);
        const useIt = await question('Include Node.js dependencies? [Y/n]: ');
        if (useIt.toLowerCase() !== 'n') {
          dependencies.node = defaultPackageJson;
          console.log(`Using: ${defaultPackageJson}`);
        }
      } else {
        const addNode = await question('\nPath to package.json (or press Enter to skip): ');
        if (addNode) {
          if (await this.fileSystem.exists(path.join(projectDir, addNode))) {
            dependencies.node = addNode.startsWith('./') ? addNode : `./${addNode}`;
            console.log(`Using: ${dependencies.node}`);
          } else {
            console.log(`File not found: ${addNode}, skipping`);
          }
        }
      }

      return dependencies;
    } finally {
      rl.close();
    }
  }

  private async promptForStaticFiles(projectDir: string): Promise<StaticFileConfig[]> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    const staticFiles: StaticFileConfig[] = [];

    try {
      const addStatic = await question('\nServe static files? [y/N]: ');

      if (addStatic.toLowerCase() === 'y') {
        let addMore = true;

        while (addMore) {
          const folder = await question('Folder path (e.g., ./public): ');

          if (!folder) {
            break;
          }

          // Validate folder exists
          const folderPath = path.join(projectDir, folder.replace(/^\.\//, ''));
          if (!await this.fileSystem.exists(folderPath)) {
            console.log(`Warning: Folder not found: ${folder}`);
          }

          const urlPath = await question(`URL path [/${path.basename(folder)}]: `);
          // const accessType = await question('Access type - shared/per-user [shared]: ');

          staticFiles.push({
            folder: folder.startsWith('./') ? folder : `./${folder}`,
            urlPath: urlPath || `/${path.basename(folder)}`,
            access: 'shared', // Default for now
          });

          console.log(`Added: ${folder} -> ${urlPath || `/${path.basename(folder)}`}`);

          const another = await question('Add another folder? [y/N]: ');
          addMore = another.toLowerCase() === 'y';
        }
      }

      return staticFiles;
    } finally {
      rl.close();
    }
  }

  private async promptForRuntime(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    const defaultImage = 'nikolaik/python-nodejs:python3.11-nodejs20';

    try {
      console.log('\nSelect Docker runtime:');
      console.log(`  1) Node.js & Python - ${defaultImage} (default)`);
      console.log('  2) Custom Docker image\n');

      const selection = await question('Enter selection [1]: ');

      let runtimeImage: string;

      if (selection === '' || selection === '1') {
        runtimeImage = defaultImage;
        console.log(`Using: ${runtimeImage}`);
      } else if (selection === '2') {
        const customImage = await question('Enter Docker image name: ');

        if (!this.isValidDockerImage(customImage)) {
          console.error(`Invalid Docker image name. Using default: ${defaultImage}`);
          runtimeImage = defaultImage;
        } else {
          runtimeImage = customImage;
          console.log(`Using: ${runtimeImage}`);
        }
      } else {
        console.log(`Invalid selection. Using default: ${defaultImage}`);
        runtimeImage = defaultImage;
      }

      return runtimeImage;
    } finally {
      rl.close();
    }
  }

  /**
   * Validates Docker image name format
   * Valid formats: name, name:tag, registry/name, registry/name:tag
   */
  private isValidDockerImage(image: string): boolean {
    if (!image || image.length === 0) {
      return false;
    }

    // Docker image naming pattern
    // Allows: lowercase letters, digits, separators (., _, -), forward slashes, and optional tag
    const pattern = /^[a-z0-9]+([._-][a-z0-9]+)*(\/[a-z0-9]+([._-][a-z0-9]+)*)*(:[\w][\w.-]{0,127})?$/;

    return pattern.test(image);
  }

  private generateConfig(
    projectName: string,
    description: string,
    runtimeImage: string,
    dependencies: { python?: string; node?: string },
    staticFiles: StaticFileConfig[]
  ): string {
    const hasDependencies = dependencies.python || dependencies.node;
    const dependenciesSection = hasDependencies
      ? `

  // Dependencies to install in container
  dependencies: {${dependencies.python ? `
    python: '${dependencies.python}',` : ''}${dependencies.node ? `
    node: '${dependencies.node}',` : ''}
  },`
      : '';

    const staticFilesSection = staticFiles.length > 0
      ? `

  // Static files served via nginx
  staticFiles: ${JSON.stringify(staticFiles, null, 4).replace(/\n/g, '\n  ')},`
      : '';

    return `export default {
  name: '${projectName}',
  version: '0.1.0',
  description: '${description}',

  // Files to include in the container (glob patterns)
  include: [
    '**/*',
    '!node_modules/**',
    '!.git/**',
    '!dist/**',
    '!.claude-shipyard/**',
  ],

  // Runtime configuration
  runtime: {
    image: '${runtimeImage}',
    port: 3000,
    timeout: 120000, // 2 minutes
  },${dependenciesSection}${staticFilesSection}
};
`;
  }

  private async updateGitignore(projectDir: string): Promise<void> {
    const gitignorePath = path.join(projectDir, '.gitignore');
    const shipyardEntry = '.claude-shipyard/';
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
