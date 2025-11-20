import express, { Express, Request, Response, NextFunction } from 'express';
import { ExecutionService } from './ExecutionService.js';
import { ExecuteRequest, RuntimeConfig } from './types.js';
import { AuthManager } from './auth/AuthManager.js';
import { AuthErrorResponse } from './auth/types.js';
import { CommandDiscovery } from './CommandDiscovery.js';

export class Server {
  private readonly app: Express;
  private readonly executionService: ExecutionService;
  private readonly config: RuntimeConfig;
  private readonly authManager: AuthManager;
  private readonly commandDiscovery: CommandDiscovery;

  constructor(executionService: ExecutionService, config: RuntimeConfig) {
    this.executionService = executionService;
    this.config = config;
    this.authManager = new AuthManager();
    this.commandDiscovery = new CommandDiscovery(config.pluginDir);
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Auth status endpoint
    this.app.get('/auth/status', (_req: Request, res: Response) => {
      const status = this.authManager.getAuthStatus();
      res.json(status);
    });

    // Commands endpoint - returns available slash commands
    this.app.get('/commands', async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const commands = await this.commandDiscovery.discoverCommands();
        res.json({ commands });
      } catch (error) {
        next(error);
      }
    });

    this.app.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Resolve authentication
        const auth = this.authManager.resolveAuth(req);

        if (!auth) {
          const errorResponse: AuthErrorResponse = {
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED',
            hint: 'Provide API key via Authorization: Bearer header, x-api-key header, or apiKey in body',
          };
          return res.status(401).json(errorResponse);
        }

        const request = this.validateRequest(req.body);
        request.apiKey = auth.apiKey;

        const response = await this.executionService.execute(request);

        if (response.success) {
          res.json(response);
        } else {
          res.status(500).json(response);
        }
      } catch (error) {
        next(error);
      }
    });

    this.app.post('/execute/stream', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Resolve authentication
        const auth = this.authManager.resolveAuth(req);

        if (!auth) {
          const errorResponse: AuthErrorResponse = {
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED',
            hint: 'Provide API key via Authorization: Bearer header, x-api-key header, or apiKey in body',
          };
          return res.status(401).json(errorResponse);
        }

        const request = this.validateRequest(req.body);
        request.apiKey = auth.apiKey;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await this.executionService.executeStreaming(request);

        stream.on('data', (chunk) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        });

        stream.on('end', () => {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
        });

        stream.on('error', (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        });

        req.on('close', () => {
          // Client disconnected
        });
      } catch (error) {
        next(error);
      }
    });
  }

  private setupErrorHandler(): void {
    this.app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Request error:', error.message);
      console.error('Stack:', error.stack);
      res.status(400).json({
        success: false,
        output: '',
        error: error.message,
      });
    });
  }

  private validateRequest(body: unknown): ExecuteRequest {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body must be an object');
    }

    const { prompt, files, timeout, sessionId } = body as Record<string, unknown>;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('prompt is required and must be a non-empty string');
    }

    if (files !== undefined && !Array.isArray(files)) {
      throw new Error('files must be an array');
    }

    if (files) {
      for (const file of files) {
        if (!file || typeof file !== 'object') {
          throw new Error('Each file must be an object');
        }
        if (typeof file.path !== 'string' || typeof file.content !== 'string') {
          throw new Error('Each file must have path and content strings');
        }
      }
    }

    if (timeout !== undefined && typeof timeout !== 'number') {
      throw new Error('timeout must be a number');
    }

    if (sessionId !== undefined && typeof sessionId !== 'string') {
      throw new Error('sessionId must be a string');
    }

    return {
      prompt: prompt.trim(),
      files: files as ExecuteRequest['files'],
      timeout: timeout as number | undefined,
      sessionId: sessionId as string | undefined,
    };
  }

  start(): void {
    this.app.listen(this.config.port, () => {
      console.log(`Shipyard runtime listening on port ${this.config.port}`);
    });
  }
}
