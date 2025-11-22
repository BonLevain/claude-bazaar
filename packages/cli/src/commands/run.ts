import { execa } from 'execa';
import { RunOptions } from '../types.js';
import { ConfigLoader } from '../services/ConfigLoader.js';
import { ImageTag } from '../services/ImageTag.js';

export class RunCommand {
  private readonly configLoader: ConfigLoader;

  constructor(configLoader: ConfigLoader) {
    this.configLoader = configLoader;
  }

  async execute(projectDir: string = process.cwd(), options: RunOptions = {}): Promise<void> {
    const config = await this.configLoader.load(projectDir);
    const imageTag = options.tag
      ? new ImageTag(options.tag.split(':')[0], options.tag.split(':')[1] || 'latest')
      : ImageTag.fromConfig(config);

    const port = options.port || config.runtime?.port || 3000;
    const tag = imageTag.toString();

    console.log(`Running ${tag} on port ${port}...`);

    console.log(`\n*********\nTo connect the web interface open a new terminal and run: "claude-bazaar serve --projects http://localhost:${port}"\n*********\n`);

    const args = [
      'run',
      '-p', `${port}:${port}`,
    ];

    if (options.detach) {
      args.push('-d');
    }

    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('-e', `${key}=${value}`);
      }
    }

    args.push(tag);

    await execa('docker', args, { stdio: 'inherit' });

  }
}
