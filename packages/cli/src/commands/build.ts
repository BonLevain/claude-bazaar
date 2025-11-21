import path from 'path';
import { promises as fs } from 'fs';
import { execa } from 'execa';
import { ShipyardConfig, BuildOptions, FileSystemService } from '../types.js';
import { ConfigLoader } from '../services/ConfigLoader.js';
import { ImageTag } from '../services/ImageTag.js';

export class BuildCommand {
  private readonly fileSystem: FileSystemService;
  private readonly configLoader: ConfigLoader;

  constructor(fileSystem: FileSystemService, configLoader: ConfigLoader) {
    this.fileSystem = fileSystem;
    this.configLoader = configLoader;
  }

  async execute(projectDir: string = process.cwd(), options: BuildOptions = {}): Promise<string> {
    const config = await this.configLoader.load(projectDir);
    const dockerfilePath = await this.generateDockerfile(projectDir, config);
    const imageTag = options.tag
      ? new ImageTag(options.tag.split(':')[0], options.tag.split(':')[1] || 'latest')
      : ImageTag.fromConfig(config);
    const tag = imageTag.toString();

    console.log(`Building ${tag}...`);

    await execa('docker', [
      'build',
      '-t', tag,
      '-f', dockerfilePath,
      projectDir,
    ], { stdio: 'inherit' });

    console.log(`\nBuilt: ${tag}`);

    if (options.push && options.registry) {
      return this.pushImage(tag, options.registry);
    }

    return tag;
  }

  private async generateDockerfile(projectDir: string, config: ShipyardConfig): Promise<string> {
    const port = config.runtime?.port || 3000;
    const timeout = config.runtime?.timeout || 120000;
    const image = config.runtime?.image || 'nikolaik/python-nodejs:python3.11-nodejs20';

    const shipyardDir = path.join(projectDir, '.claude-shipyard');
    await this.fileSystem.mkdir(shipyardDir);

    // Copy runtime files into .claude-shipyard to avoid symlink issues
    await this.copyRuntimeFiles(projectDir, shipyardDir);

    // Build dependency installation commands
    let dependencyCommands = '';

    if (config.dependencies?.python) {
      const requirementsPath = config.dependencies.python.replace(/^\.\//, '');
      dependencyCommands += `
# Install Python dependencies
COPY ${requirementsPath} /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
`;
    }

    if (config.dependencies?.node) {
      const packagePath = config.dependencies.node.replace(/^\.\//, '');
      const packageDir = path.dirname(packagePath);
      dependencyCommands += `
# Install Node.js dependencies
COPY ${packagePath} /tmp/package.json
${packageDir !== '.' ? `COPY ${packageDir}/package-lock.json /tmp/package-lock.json 2>/dev/null || true` : 'COPY package-lock.json /tmp/package-lock.json 2>/dev/null || true'}
RUN cd /tmp && npm install --production && cp -r node_modules /app/plugin/node_modules
`;
    }

    const dockerfile = `FROM ${image}

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code
${dependencyCommands}
# Create runtime directory
WORKDIR /app/runtime

# Copy runtime package and install dependencies
COPY .claude-shipyard/runtime/package.json ./
RUN npm install --production
COPY .claude-shipyard/runtime/dist ./dist

# Copy plugin files
WORKDIR /app/plugin
COPY . .

# Back to runtime
WORKDIR /app/runtime
EXPOSE ${port}

ENV PORT=${port}
ENV TIMEOUT=${timeout}
ENV PLUGIN_DIR=/app/plugin

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:${port}/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
`;

    const dockerfilePath = path.join(shipyardDir, 'Dockerfile');
    await this.fileSystem.writeFile(dockerfilePath, dockerfile);

    console.log('Generated .claude-shipyard/Dockerfile');
    return dockerfilePath;
  }

  private async copyRuntimeFiles(projectDir: string, shipyardDir: string): Promise<void> {
    const runtimeSrcPath = await this.findRuntimePackage(projectDir);
    const runtimeDestPath = path.join(shipyardDir, 'runtime');

    // Resolve symlinks and copy actual files
    const resolvedSrc = await fs.realpath(path.join(projectDir, runtimeSrcPath));

    await fs.rm(runtimeDestPath, { recursive: true, force: true });
    await fs.cp(resolvedSrc, runtimeDestPath, { recursive: true });

    console.log('Copied runtime files to .claude-shipyard/runtime');
  }

  private async findRuntimePackage(projectDir: string): Promise<string> {
    // Check possible locations for the container-runtime package
    const possiblePaths = [
      'node_modules/@shipyard/container-runtime',
      'node_modules/container-runtime',
    ];

    for (const relativePath of possiblePaths) {
      const fullPath = path.join(projectDir, relativePath);
      if (await this.fileSystem.exists(fullPath)) {
        return relativePath;
      }
    }

    throw new Error(
      'Could not find @shipyard/container-runtime. Install it with:\n' +
      '  npm install @shipyard/container-runtime'
    );
  }

  private async pushImage(tag: string, registry: string): Promise<string> {
    const [name, version] = tag.split(':');
    const imageTag = new ImageTag(name, version || 'latest');
    const remoteTag = imageTag.withRegistry(registry);

    await execa('docker', ['tag', tag, remoteTag]);
    await execa('docker', ['push', remoteTag], { stdio: 'inherit' });

    console.log(`Pushed: ${remoteTag}`);
    return remoteTag;
  }
}
