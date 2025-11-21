import { promises as fs } from 'fs';
import path from 'path';
import { FileTreeNode, StaticFileConfig } from './types.js';

export interface StaticFilesResult {
  folder: string;
  urlPath: string;
  files: FileTreeNode;
}

export class StaticFilesService {
  private readonly pluginDir: string;

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }

  async listAllStaticFiles(staticFiles: StaticFileConfig[]): Promise<StaticFilesResult[]> {
    const results: StaticFilesResult[] = [];

    for (const config of staticFiles) {
      const folderPath = path.join(this.pluginDir, config.folder.replace(/^\.\//, ''));

      try {
        const tree = await this.buildFileTree(folderPath);
        results.push({
          folder: config.folder,
          urlPath: config.urlPath,
          files: tree,
        });
      } catch (error) {
        console.error(`Failed to list files in ${config.folder}:`, (error as Error).message);
        // Include entry with error indicator
        results.push({
          folder: config.folder,
          urlPath: config.urlPath,
          files: {
            name: path.basename(config.folder),
            type: 'directory',
            children: [],
          },
        });
      }
    }

    return results;
  }

  private async buildFileTree(dirPath: string): Promise<FileTreeNode> {
    const stats = await fs.stat(dirPath);
    const name = path.basename(dirPath);

    if (!stats.isDirectory()) {
      return {
        name,
        type: 'file',
        size: stats.size,
      };
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const children: FileTreeNode[] = [];

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subTree = await this.buildFileTree(entryPath);
        children.push(subTree);
      } else if (entry.isFile()) {
        const fileStats = await fs.stat(entryPath);
        children.push({
          name: entry.name,
          type: 'file',
          size: fileStats.size,
        });
      }
    }

    // Sort: directories first, then files, alphabetically
    children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      name,
      type: 'directory',
      children,
    };
  }
}
