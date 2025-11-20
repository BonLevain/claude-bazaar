import { Server } from './Server.js';
import { ExecutionService } from './ExecutionService.js';
import { WorkspaceManager } from './WorkspaceManager.js';
import { ClaudeExecutor } from './ClaudeExecutor.js';
import { RuntimeConfig } from './types.js';

function loadConfig(): RuntimeConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    timeout: parseInt(process.env.TIMEOUT || '120000', 10),
    pluginDir: process.env.PLUGIN_DIR || '/app/plugin',
    workspaceBaseDir: process.env.WORKSPACE_DIR || '/tmp/shipyard',
  };
}

function main(): void {
  const config = loadConfig();

  // Dependency injection
  const workspaceManager = new WorkspaceManager(config.workspaceBaseDir, config.pluginDir);
  const executor = new ClaudeExecutor(config.timeout);
  const executionService = new ExecutionService(workspaceManager, executor);
  const server = new Server(executionService, config);

  server.start();
}

main();

// Export for testing
export { Server, ExecutionService, WorkspaceManager, ClaudeExecutor };
export type { RuntimeConfig, ExecuteRequest, ExecuteResponse, FileInput } from './types.js';
