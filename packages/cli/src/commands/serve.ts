import { execa } from 'execa';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServeOptions } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ServeCommand {
  async execute(options: ServeOptions = {}): Promise<void> {
    const plugins = options.plugins || [];
    const marketplaces = options.marketplaces || [];
    const port = options.port || 5173;

    if (plugins.length === 0 && marketplaces.length === 0) {
      console.warn('Warning: No plugins or marketplaces specified. The UI will have no backends to connect to.');
    }

    const webInterfacePath = path.resolve(__dirname, '../../../web-interface');

    console.log(`Starting Claude Shipyard UI on port ${port}...`);

    if (plugins.length > 0) {
      console.log(`Plugins: ${plugins.join(', ')}`);
    }

    if (marketplaces.length > 0) {
      console.log(`Marketplaces: ${marketplaces.join(', ')}`);
    }

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      VITE_SHIPYARD_PLUGINS: JSON.stringify(plugins),
      VITE_SHIPYARD_MARKETPLACES: JSON.stringify(marketplaces),
    };

    if (port !== 5173) {
      env.VITE_PORT = String(port);
    }

    await execa('npm', ['run', 'dev'], {
      cwd: webInterfacePath,
      env,
      stdio: 'inherit',
    });
  }
}
