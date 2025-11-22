import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface ExecutionEntry {
  process: ChildProcess;
  sessionId?: string;
  startTime: number;
  emitter?: EventEmitter;
}

export class ExecutionRegistry {
  private executions = new Map<string, ExecutionEntry>();

  register(
    executionId: string,
    process: ChildProcess,
    sessionId?: string,
    emitter?: EventEmitter
  ): void {
    this.executions.set(executionId, {
      process,
      sessionId,
      startTime: Date.now(),
      emitter,
    });

    // Auto-cleanup when process exits
    process.on('close', () => {
      this.executions.delete(executionId);
    });
  }

  cancel(executionId: string): boolean {
    const entry = this.executions.get(executionId);
    if (!entry) {
      return false;
    }

    // Kill the process
    entry.process.kill('SIGTERM');

    // Force kill after 2 seconds if still alive
    setTimeout(() => {
      if (!entry.process.killed) {
        entry.process.kill('SIGKILL');
      }
    }, 2000);

    // Emit cancellation event if emitter exists
    if (entry.emitter) {
      entry.emitter.emit('cancelled');
    }

    this.executions.delete(executionId);
    return true;
  }

  get(executionId: string): ExecutionEntry | undefined {
    return this.executions.get(executionId);
  }

  getActive(): string[] {
    return Array.from(this.executions.keys());
  }

  getActiveCount(): number {
    return this.executions.size;
  }

  cleanup(): void {
    for (const [id] of this.executions) {
      this.cancel(id);
    }
  }
}

// Singleton instance
export const executionRegistry = new ExecutionRegistry();
