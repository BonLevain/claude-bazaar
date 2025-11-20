import { WorkspaceManager } from './WorkspaceManager.js';
import { ClaudeExecutor, StreamingExecution } from './ClaudeExecutor.js';
import { SessionManager } from './SessionManager.js';
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
  private readonly sessionManager: SessionManager;

  constructor(
    workspaceManager: WorkspaceManager,
    executor: ClaudeExecutor,
    sessionManager: SessionManager
  ) {
    this.workspaceManager = workspaceManager;
    this.executor = executor;
    this.sessionManager = sessionManager;
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    const startTime = Date.now();

    // Use session-based execution if sessionId provided
    if (request.sessionId) {
      return this.executeWithSession(request, startTime);
    }

    // Legacy: stateless execution
    return this.executeStateless(request, startTime);
  }

  private async executeWithSession(
    request: ExecuteRequest,
    startTime: number
  ): Promise<ExecuteResponse> {
    try {
      const session = await this.sessionManager.getOrCreate(
        request.sessionId!,
        request.files,
        request.apiKey
      );

      const output = await this.sessionManager.execute(
        session,
        request.prompt
      );

      return {
        success: true,
        output,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async executeStateless(
    request: ExecuteRequest,
    startTime: number
  ): Promise<ExecuteResponse> {
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

    // Use session-based streaming if sessionId provided
    if (request.sessionId) {
      this.executeStreamingWithSession(request, emitter);
      return emitter;
    }

    // Legacy: stateless streaming
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

  private async executeStreamingWithSession(
    request: ExecuteRequest,
    emitter: StreamingExecutionHandle
  ): Promise<void> {
    try {
      const session = await this.sessionManager.getOrCreate(
        request.sessionId!,
        request.files,
        request.apiKey
      );

      await this.sessionManager.execute(
        session,
        request.prompt,
        (text) => emitter.emit('data', text)
      );

      emitter.emit('end');
    } catch (error) {
      emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }
}
