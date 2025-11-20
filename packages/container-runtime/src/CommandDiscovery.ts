import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface SlashCommand {
  name: string;
  description: string;
  source: 'builtin' | 'project' | 'user';
}

// Built-in Claude Code slash commands
const BUILTIN_COMMANDS: SlashCommand[] = [
  // Session Management
  { name: '/clear', description: 'Clear conversation history', source: 'builtin' },
  { name: '/compact', description: 'Compact conversation with optional focus instructions', source: 'builtin' },
  { name: '/exit', description: 'Exit the REPL', source: 'builtin' },
  { name: '/rewind', description: 'Rewind the conversation and/or code', source: 'builtin' },

  // Configuration & Settings
  { name: '/config', description: 'Open the Settings interface', source: 'builtin' },
  { name: '/status', description: 'View version, model, account, and connectivity status', source: 'builtin' },
  { name: '/model', description: 'Select or change the AI model', source: 'builtin' },
  { name: '/permissions', description: 'View or update permissions', source: 'builtin' },
  { name: '/privacy-settings', description: 'View and update privacy settings', source: 'builtin' },
  { name: '/output-style', description: 'Set the output style', source: 'builtin' },

  // Project & Workspace
  { name: '/add-dir', description: 'Add additional working directories', source: 'builtin' },
  { name: '/init', description: 'Initialize project with CLAUDE.md guide', source: 'builtin' },
  { name: '/memory', description: 'Edit CLAUDE.md memory files', source: 'builtin' },

  // Development Tools
  { name: '/agents', description: 'Manage custom AI subagents', source: 'builtin' },
  { name: '/bashes', description: 'List and manage background tasks', source: 'builtin' },
  { name: '/review', description: 'Request code review', source: 'builtin' },
  { name: '/todos', description: 'List current todo items', source: 'builtin' },
  { name: '/pr_comments', description: 'View pull request comments', source: 'builtin' },
  { name: '/sandbox', description: 'Enable sandboxed bash tool', source: 'builtin' },

  // Monitoring & Diagnostics
  { name: '/context', description: 'Visualize current context usage', source: 'builtin' },
  { name: '/cost', description: 'Show token usage statistics', source: 'builtin' },
  { name: '/usage', description: 'Show plan usage limits', source: 'builtin' },
  { name: '/doctor', description: 'Check installation health', source: 'builtin' },
  { name: '/bug', description: 'Report bugs', source: 'builtin' },

  // Integration & Authentication
  { name: '/mcp', description: 'Manage MCP server connections', source: 'builtin' },
  { name: '/hooks', description: 'Manage hook configurations', source: 'builtin' },
  { name: '/login', description: 'Switch Anthropic accounts', source: 'builtin' },
  { name: '/logout', description: 'Sign out from Anthropic account', source: 'builtin' },

  // Utilities
  { name: '/export', description: 'Export the current conversation', source: 'builtin' },
  { name: '/help', description: 'Get usage help', source: 'builtin' },
  { name: '/statusline', description: 'Set up status line UI', source: 'builtin' },
  { name: '/terminal-setup', description: 'Install Shift+Enter key binding', source: 'builtin' },
  { name: '/vim', description: 'Enter vim mode', source: 'builtin' },
];

export class CommandDiscovery {
  private pluginDir: string;
  private cachedCommands: SlashCommand[] | null = null;

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }

  async discoverCommands(): Promise<SlashCommand[]> {
    if (this.cachedCommands) {
      return this.cachedCommands;
    }

    const commands: SlashCommand[] = [...BUILTIN_COMMANDS];

    // Discover project commands from .claude/commands/
    const projectCommands = await this.discoverCustomCommands(
      path.join(this.pluginDir, '.claude', 'commands'),
      'project'
    );
    commands.push(...projectCommands);

    // Discover user commands from ~/.claude/commands/
    const userCommands = await this.discoverCustomCommands(
      path.join(os.homedir(), '.claude', 'commands'),
      'user'
    );
    commands.push(...userCommands);

    // Sort by name
    commands.sort((a, b) => a.name.localeCompare(b.name));

    this.cachedCommands = commands;
    return commands;
  }

  private async discoverCustomCommands(
    dir: string,
    source: 'project' | 'user'
  ): Promise<SlashCommand[]> {
    const commands: SlashCommand[] = [];

    try {
      const exists = await fs.stat(dir).then(() => true).catch(() => false);
      if (!exists) return commands;

      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const commandName = '/' + file.replace('.md', '');
        const description = this.extractDescription(content);

        commands.push({
          name: commandName,
          description: description || `Custom command: ${commandName}`,
          source,
        });
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      console.error(`Error reading commands from ${dir}:`, error);
    }

    return commands;
  }

  private extractDescription(content: string): string | null {
    // Try to extract description from frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const descMatch = frontmatter.match(/description:\s*(.+)/);
      if (descMatch) {
        return descMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }

    // Fall back to first non-empty line
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].replace(/^#+\s*/, '').trim();
      if (firstLine.length < 100) {
        return firstLine;
      }
    }

    return null;
  }

  clearCache(): void {
    this.cachedCommands = null;
  }
}
