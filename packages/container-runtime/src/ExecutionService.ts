import { WorkspaceManager } from './WorkspaceManager.js';
import { ClaudeExecutor, StreamingExecution } from './ClaudeExecutor.js';
import { ExecuteRequest, ExecuteResponse } from './types.js';
import { EventEmitter } from 'events';

export interface StreamingExecutionHandle extends EventEmitter {
  on(event: 'data', listener: (chunk: string) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export class ExecutionService {
  private readonly workspaceManager: WorkspaceManager;
  private readonly executor: ClaudeExecutor;

  constructor(workspaceManager: WorkspaceManager, executor: ClaudeExecutor) {
    this.workspaceManager = workspaceManager;
    this.executor = executor;
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    const startTime = Date.now();
    let workspacePath: string | null = null;

    try {
      workspacePath = await this.workspaceManager.create();

      if (request.files?.length) {
        await this.workspaceManager.writeFiles(workspacePath, request.files);
      }

      const result = await this.executor.execute(
        workspacePath,
        request.prompt,
        request.timeout,
        request.apiKey
      );

      return {
        success: true,
        output: result.output,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (workspacePath) {
        await this.workspaceManager.cleanup(workspacePath);
      }
    }
  }

  async executeStreaming(request: ExecuteRequest): Promise<StreamingExecutionHandle> {
    const emitter = new EventEmitter() as StreamingExecutionHandle;

    let workspacePath: string | null = null;

    try {
      workspacePath = await this.workspaceManager.create();

      if (request.files?.length) {
        await this.workspaceManager.writeFiles(workspacePath, request.files);
      }

      const stream = this.executor.executeStreaming(
        workspacePath,
        request.prompt,
        request.timeout,
        request.apiKey
      );

      stream.on('data', (chunk) => emitter.emit('data', chunk));

      stream.on('end', () => {
        if (workspacePath) {
          this.workspaceManager.cleanup(workspacePath);
        }
        emitter.emit('end');
      });

      stream.on('error', (error) => {
        if (workspacePath) {
          this.workspaceManager.cleanup(workspacePath);
        }
        emitter.emit('error', error);
      });

    } catch (error) {
      if (workspacePath) {
        await this.workspaceManager.cleanup(workspacePath);
      }
      process.nextTick(() => {
        emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
      });
    }

    return emitter;
  }
}
