import express, { Express, Request, Response, NextFunction } from 'express';
import { ExecutionService } from './ExecutionService.js';
import { ExecuteRequest, RuntimeConfig } from './types.js';

export class Server {
  private readonly app: Express;
  private readonly executionService: ExecutionService;
  private readonly config: RuntimeConfig;

  constructor(executionService: ExecutionService, config: RuntimeConfig) {
    this.executionService = executionService;
    this.config = config;
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

    this.app.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const request = this.validateRequest(req.body);
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
        const request = this.validateRequest(req.body);

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

    const { prompt, files, timeout } = body as Record<string, unknown>;

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

    return {
      prompt: prompt.trim(),
      files: files as ExecuteRequest['files'],
      timeout: timeout as number | undefined,
    };
  }

  start(): void {
    this.app.listen(this.config.port, () => {
      console.log(`Shipyard runtime listening on port ${this.config.port}`);
    });
  }
}
