import { promises as fs } from 'fs';
import path from 'path';
import { FileInput } from './types.js';

export class WorkspaceManager {
  private readonly baseDir: string;
  private readonly pluginDir: string;

  constructor(baseDir: string, pluginDir: string) {
    this.baseDir = baseDir;
    this.pluginDir = pluginDir;
  }

  async create(): Promise<string> {
    const workspaceId = `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const workspacePath = path.join(this.baseDir, workspaceId);

    await fs.mkdir(workspacePath, { recursive: true });
    await this.copyPluginFiles(workspacePath);

    return workspacePath;
  }

  async writeFiles(workspacePath: string, files: FileInput[]): Promise<void> {
    for (const file of files) {
      const filePath = path.join(workspacePath, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  async cleanup(workspacePath: string): Promise<void> {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }

  private async copyPluginFiles(workspacePath: string): Promise<void> {
    try {
      await fs.access(this.pluginDir);
      await fs.cp(this.pluginDir, workspacePath, { recursive: true });
    } catch {
      // Plugin dir may not exist in dev mode
    }
  }
}
