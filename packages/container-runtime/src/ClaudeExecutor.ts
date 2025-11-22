import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { StreamEvent } from './types.js';

export interface ExecutionResult {
  output: string;
  exitCode: number;
}

export interface StreamingExecution extends EventEmitter {
  on(event: 'data', listener: (chunk: string) => void): this;
  on(event: 'event', listener: (event: StreamEvent) => void): this;
  on(event: 'end', listener: (result: ExecutionResult) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'cancelled', listener: () => void): this;
}

export interface StreamingExecutionHandle {
  emitter: StreamingExecution;
  executionId: string;
  process: ChildProcess;
}

export class ClaudeExecutor {
  private readonly defaultTimeout: number;

  constructor(defaultTimeout: number = 120000) {
    this.defaultTimeout = defaultTimeout;
  }

  async execute(
    workspacePath: string,
    prompt: string,
    timeout?: number,
    apiKey?: string
  ): Promise<ExecutionResult> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const process = this.spawnClaude(workspacePath, prompt, false, apiKey);
      const timeoutId = this.setupTimeout(process, effectiveTimeout, reject);

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          resolve({ output: stdout, exitCode: code });
        } else {
          reject(new Error(stderr || `Claude Code exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  executeStreaming(
    workspacePath: string,
    prompt: string,
    timeout?: number,
    apiKey?: string
  ): StreamingExecutionHandle {
    const emitter = new EventEmitter() as StreamingExecution;
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    const executionId = randomUUID();

    const proc = this.spawnClaude(workspacePath, prompt, true, apiKey);
    const timeoutId = this.setupTimeout(proc, effectiveTimeout, (err) => emitter.emit('error', err));

    let stdout = '';
    let stderr = '';

    // Parse stream-json output line by line
    const rl = createInterface({
      input: proc.stdout!,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;

      stdout += line + '\n';

      try {
        const event = JSON.parse(line) as StreamEvent;
        emitter.emit('event', event);
        // Also emit raw data for backwards compatibility
        emitter.emit('data', line);
      } catch {
        // Non-JSON line, emit as raw data
        emitter.emit('data', line);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        emitter.emit('end', { output: stdout, exitCode: code ?? 0 });
      } else if (code === null || proc.killed) {
        // Process was killed (cancelled)
        emitter.emit('cancelled');
      } else {
        emitter.emit('error', new Error(stderr || `Claude Code exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      emitter.emit('error', error);
    });

    return { emitter, executionId, process: proc };
  }

  private spawnClaude(
    workspacePath: string,
    prompt: string,
    streaming: boolean = false,
    apiKey?: string
  ): ChildProcess {
    const args = ['-p', prompt, '--dangerously-skip-permissions'];
    if (streaming) {
      args.push('--output-format', 'stream-json', '--verbose');
    } else {
      args.push('--output-format', 'json');
    }

    // Build environment - only set ANTHROPIC_API_KEY if we have an explicit key
    // Otherwise let Claude use stored subscription credentials
    const env = { ...process.env };
    if (apiKey) {
      env.ANTHROPIC_API_KEY = apiKey;
    }

    return spawn('claude', args, {
      cwd: workspacePath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  private setupTimeout(
    process: ChildProcess,
    timeout: number,
    reject: (error: Error) => void
  ): NodeJS.Timeout {
    return setTimeout(() => {
      process.kill('SIGTERM');
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
      reject(new Error(`Execution timed out after ${timeout}ms`));
    }, timeout);
  }
}
