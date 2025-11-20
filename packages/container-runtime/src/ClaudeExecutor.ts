import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ExecutionResult {
  output: string;
  exitCode: number;
}

export interface StreamingExecution extends EventEmitter {
  on(event: 'data', listener: (chunk: string) => void): this;
  on(event: 'end', listener: (result: ExecutionResult) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export class ClaudeExecutor {
  private readonly defaultTimeout: number;

  constructor(defaultTimeout: number = 120000) {
    this.defaultTimeout = defaultTimeout;
  }

  async execute(
    workspacePath: string,
    prompt: string,
    timeout?: number
  ): Promise<ExecutionResult> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const process = this.spawnClaude(workspacePath, prompt);
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
    timeout?: number
  ): StreamingExecution {
    const emitter = new EventEmitter() as StreamingExecution;
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    const process = this.spawnClaude(workspacePath, prompt, true);
    const timeoutId = this.setupTimeout(process, effectiveTimeout, (err) => emitter.emit('error', err));

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      emitter.emit('data', chunk);
    });

    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        emitter.emit('end', { output: stdout, exitCode: code });
      } else {
        emitter.emit('error', new Error(stderr || `Claude Code exited with code ${code}`));
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutId);
      emitter.emit('error', error);
    });

    return emitter;
  }

  private spawnClaude(workspacePath: string, prompt: string, streaming: boolean = false): ChildProcess {
    const args = ['-p', prompt];
    if (!streaming) {
      args.push('--output-format', 'json');
    }

    return spawn('claude', args, {
      cwd: workspacePath,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
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
