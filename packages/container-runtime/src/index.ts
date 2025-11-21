import { Server } from './Server.js';
import { ExecutionService } from './ExecutionService.js';
import { WorkspaceManager } from './WorkspaceManager.js';
import { ClaudeExecutor } from './ClaudeExecutor.js';
import { SessionManager } from './SessionManager.js';
import { PluginConfigLoader } from './PluginConfigLoader.js';
import { RuntimeConfig } from './types.js';

function loadConfig(): RuntimeConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    timeout: parseInt(process.env.TIMEOUT || '120000', 10),
    pluginDir: process.env.PLUGIN_DIR || '/app/plugin',
    workspaceBaseDir: process.env.WORKSPACE_DIR || '/tmp/bazaar',
  };
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Load plugin configuration
  const pluginConfigLoader = new PluginConfigLoader(config.pluginDir);
  const pluginConfig = await pluginConfigLoader.load();
  if (pluginConfig) {
    config.pluginConfig = pluginConfig;
    console.log(`Loaded plugin: ${pluginConfig.name} v${pluginConfig.version}`);
  }

  // Dependency injection
  const workspaceManager = new WorkspaceManager(config.workspaceBaseDir, config.pluginDir);
  const executor = new ClaudeExecutor(config.timeout);
  const sessionManager = new SessionManager(workspaceManager);
  const executionService = new ExecutionService(workspaceManager, executor, sessionManager);
  const server = new Server(executionService, config);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await sessionManager.shutdown();
    process.exit(0);
  });

  server.start();
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Export for testing
export { Server, ExecutionService, WorkspaceManager, ClaudeExecutor, SessionManager };
export type { RuntimeConfig, ExecuteRequest, ExecuteResponse, FileInput } from './types.js';
