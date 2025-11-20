import { spawn } from 'child_process';
import { WorkspaceManager } from './WorkspaceManager.js';
import { FileInput } from './types.js';

const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function debug(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[SessionManager]', ...args);
  }
}

interface Session {
  id: string;
  workspacePath: string;
  conversationId?: string;
  lastActivity: number;
  apiKey?: string;
}

interface SessionManagerConfig {
  idleTimeoutMs: number;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: SessionManagerConfig = {
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  cleanupIntervalMs: 60 * 1000,   // 1 minute
};

export class SessionManager {
  private readonly sessions: Map<string, Session> = new Map();
  private readonly workspaceManager: WorkspaceManager;
  private readonly config: SessionManagerConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(workspaceManager: WorkspaceManager, config: Partial<SessionManagerConfig> = {}) {
    this.workspaceManager = workspaceManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  async getOrCreate(
    sessionId: string,
    files?: FileInput[],
    apiKey?: string
  ): Promise<Session> {
    debug('getOrCreate called', { sessionId, hasFiles: !!files?.length, hasApiKey: !!apiKey });

    let session = this.sessions.get(sessionId);

    if (!session) {
      // Create new session with workspace
      debug('Creating new session', sessionId);
      const workspacePath = await this.workspaceManager.create();
      debug('Workspace created', workspacePath);

      session = {
        id: sessionId,
        workspacePath,
        lastActivity: Date.now(),
        apiKey,
      };

      this.sessions.set(sessionId, session);
    } else {
      debug('Reusing existing session', sessionId);
    }

    // Update API key if provided
    if (apiKey) {
      session.apiKey = apiKey;
    }

    // Write any new files to workspace
    if (files?.length) {
      await this.workspaceManager.writeFiles(session.workspacePath, files);
    }

    // Update activity timestamp
    session.lastActivity = Date.now();

    return session;
  }

  async execute(
    session: Session,
    prompt: string,
    onText?: (text: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['-p', prompt, '--output-format', 'json'];

      // Resume conversation if we have one
      if (session.conversationId) {
        args.push('--resume', session.conversationId);
      }

      debug('Executing claude', {
        args,
        cwd: session.workspacePath,
        hasConversationId: !!session.conversationId,
      });

      // Build environment
      const env = { ...process.env };
      if (session.apiKey) {
        env.ANTHROPIC_API_KEY = session.apiKey;
      }

      const claude = spawn('claude', args, {
        cwd: session.workspacePath,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      claude.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        onText?.(chunk);
      });

      claude.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        debug('Claude process closed', { code, stdoutLength: stdout.length, stderrLength: stderr.length });

        if (code === 0) {
          // Try to extract conversation ID from output for future resume
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.conversation_id || parsed.session_id) {
              session.conversationId = parsed.conversation_id || parsed.session_id;
              debug('Captured conversation ID', session.conversationId);
            }
          } catch {
            // Output might not be JSON, that's ok
            debug('Could not parse stdout as JSON');
          }

          session.lastActivity = Date.now();
          resolve(stdout);
        } else {
          debug('Claude process failed', { code, stderr });
          reject(new Error(stderr || `Claude Code exited with code ${code}`));
        }
      });

      claude.on('error', (error) => {
        debug('Claude spawn error', error);
        reject(error);
      });
    });
  }

  get(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  async delete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await this.workspaceManager.cleanup(session.workspacePath);
      this.sessions.delete(sessionId);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanupIdleSessions(),
      this.config.cleanupIntervalMs
    );
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.config.idleTimeoutMs) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      console.log(`Cleaning up idle session: ${id}`);
      await this.delete(id);
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Cleanup all sessions
    for (const id of this.sessions.keys()) {
      await this.delete(id);
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
