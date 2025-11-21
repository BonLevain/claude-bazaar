import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sirv from 'sirv';
import { ServeOptions } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ServeCommand {
  async execute(options: ServeOptions = {}): Promise<void> {
    const plugins = options.plugins || ['http://localhost:3000'];
    const marketplaces = options.marketplaces || [];
    const port = options.port || 5173;

    // Path to bundled web-ui (in CLI package)
    const webUiPath = path.resolve(__dirname, '../../web-ui');

    if (!fs.existsSync(webUiPath)) {
      console.error('Error: web-ui not found. Run "npm run bundle" first.');
      process.exit(1);
    }

    console.log(`Starting Claude Shipyard UI on port ${port}...`);

    if (plugins.length > 0) {
      console.log(`Plugins: ${plugins.join(', ')}`);
    }

    if (marketplaces.length > 0) {
      console.log(`Marketplaces: ${marketplaces.join(', ')}`);
    }

    // Read and modify index.html to inject runtime config
    const indexPath = path.join(webUiPath, 'index.html');
    let indexHtml = fs.readFileSync(indexPath, 'utf-8');

    // Inject runtime config script before </head>
    const configScript = `
    <script>
      window.__SHIPYARD_CONFIG__ = {
        plugins: ${JSON.stringify(plugins)},
        marketplaces: ${JSON.stringify(marketplaces)}
      };
    </script>`;

    indexHtml = indexHtml.replace('</head>', `${configScript}\n</head>`);

    // Create static file server
    const serve = sirv(webUiPath, {
      dev: true,
      single: true, // SPA mode - serve index.html for all routes
    });

    // Create HTTP server
    const server = http.createServer((req, res) => {
      // Serve modified index.html for root and SPA routes
      if (req.url === '/' || req.url === '/index.html' || !req.url?.includes('.')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexHtml);
        return;
      }

      // Serve static files
      serve(req, res, () => {
        res.writeHead(404);
        res.end('Not found');
      });
    });

    server.listen(port, () => {
      console.log(`\nUI available at: http://localhost:${port}`);
    });

    // Keep process running
    await new Promise(() => {});
  }
}
