# Claude Shipyard Marketplace Monetization PRD

## Overview

This document outlines the architecture for a Claude Code plugin marketplace that enables creators to monetize their plugins while protecting their intellectual property. The core innovation is running headless Claude Code instances server-side, ensuring prompts and logic are protected.

Claude Shipyard supports two deployment paths:
1. **Shipyard Marketplace (Monetized)** - Plugins hosted on Shipyard infrastructure with auth/billing middleware
2. **Self-Hosted (Open Source)** - Users deploy plugins to their own infrastructure

## Problem Statement

### Core Challenges

1. **Monetization**: Plugin creators need a way to charge for their work
2. **Code Protection**: Plugin internals (prompts, agents, logic) must be hidden from paying users
3. **Distribution**: Seamless integration with Claude Code's plugin ecosystem

### Why Traditional Approaches Fail

- **Thin client with prompts exposed**: Users can copy markdown files and recreate the plugin
- **Direct Claude API calls**: Different behavior than Claude Code (no tools, no agents, no agentic workflows)
- **Obfuscation**: Determined users can always reverse-engineer

## Solution: Headless Claude Code as a Service

### Architecture Overview

#### Path 1: Shipyard Marketplace (Monetized)

```
┌─────────────────────────────────────────────────────────┐
│ User's Claude Code                                       │
│                                                          │
│  /analyze-security src/                                  │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────────────┐                                │
│  │ Thin Client         │                                │
│  │  - No prompts/logic │                                │
│  │  - Just MCP config  │                                │
│  └──────────┬──────────┘                                │
└─────────────┼───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ Shipyard Infrastructure (Shipyard's AWS)                 │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ API Gateway / Load Balancer                      │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Auth/Billing Middleware                          │    │
│  │  - Validate API key                             │    │
│  │  - Check subscription active                    │    │
│  │  - Rate limiting                                │    │
│  │  - Usage metering for billing                   │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Plugin Container (ECS Service per plugin)        │    │
│  │                                                  │    │
│  │  - Full plugin installed (prompts, agents, etc) │    │
│  │  - Headless Claude Code                         │    │
│  │  - User's files in temp workspace               │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│              ┌─────────────────────┐                     │
│              │ Claude API          │                     │
│              └─────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
              │
              │ SSE Stream
              ▼
┌─────────────────────────────────────────────────────────┐
│ User sees streamed response in their terminal           │
└─────────────────────────────────────────────────────────┘
```

#### Path 2: Self-Hosted (Open Source)

```
┌─────────────────────────────────────────────────────────┐
│ User's Claude Code                                       │
│                                                          │
│  /analyze-security src/                                  │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────────────┐                                │
│  │ Thin Client         │                                │
│  │  - Points to local  │                                │
│  │    or self-hosted   │                                │
│  └──────────┬──────────┘                                │
└─────────────┼───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ User's Own Infrastructure (Docker/AWS/etc)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Plugin Container                                 │    │
│  │                                                  │    │
│  │  - Full plugin (user owns the source)           │    │
│  │  - Headless Claude Code                         │    │
│  │  - No auth middleware (or custom)               │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│              ┌─────────────────────┐                     │
│              │ Claude API          │                     │
│              └─────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### Key Benefits

1. **Identical behavior** - Same Claude Code runtime, same tools, same agentic workflows
2. **Full protection** - Prompts, agents, hooks all stay in container
3. **Agentic workflows** - Multi-turn, tool use, file editing all work
4. **Simple thin client** - Literally just "send prompt, stream response"

## Technical Specification

### Component 1: Thin Client (Installed by End User)

The thin client is a minimal plugin that routes requests to the creator's server.

#### Structure

```
my-premium-plugin-client/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   └── analyze-security.md
└── .mcp.json
```

#### Example Command (commands/analyze-security.md)

```markdown
---
description: Analyze code for security vulnerabilities
---

Collect all files the user wants to analyze, then call the `execute_remote`
MCP tool with:
- prompt: The user's full request
- files: Array of {path, content} for each file

Stream the response back to the user exactly as received.
```

### Component 1.5: MCP Proxy Layer (Native Feel Architecture)

The key to making marketplace plugins feel native is generating thin clients that **mirror the original plugin's interface exactly**, but route everything through MCP to our container.

#### Architecture Overview

```
User's Machine                         Shipyard Infrastructure
┌─────────────────────────┐           ┌─────────────────────────┐
│ Thin Client Plugin      │           │ Container               │
│                         │           │                         │
│ /commands/              │    MCP    │ Original Plugin         │
│   analyze.md ──────────────────────►│   /commands/analyze.md  │
│   report.md  ──────────────────────►│   /commands/report.md   │
│                         │           │                         │
│ /agents/                │           │                         │
│   reviewer.md ─────────────────────►│   /agents/reviewer.md   │
│                         │           │                         │
│ hooks (config) ────────────────────►│   hooks (actual scripts)│
│                         │           │                         │
│ mcpServers:             │           │   mcpServers:           │
│   shipyard-proxy ───────────────────►│   (original servers)    │
└─────────────────────────┘           └─────────────────────────┘
```

#### Thin Client Generation Strategy

For each component type, we generate a **stub that calls our MCP proxy**:

##### Commands → Stub Markdown Files

**Original:** `commands/analyze.md`
```markdown
Analyze the codebase for security vulnerabilities.
Use the local database to check against known CVEs...
[actual prompt content - 500 lines of detailed instructions]
```

**Generated Thin Client:** `commands/analyze.md`
```markdown
---
description: Analyze code for security vulnerabilities
mcp: shipyard-proxy
tool: execute_command
args:
  command: analyze
  plugin: security-analyzer
---
Execute the security analysis command remotely. All context will be passed through.
```

When user runs `/project:security-analyzer analyze`, Claude Code reads this stub, sees it's an MCP call, and routes to our proxy.

##### Agents → Stub Agent Files

**Original:** `agents/reviewer.md`
```markdown
You are a security reviewer agent with deep expertise in OWASP top 10...
[full agent prompt with persona, instructions, examples]
```

**Generated Thin Client:** `agents/reviewer.md`
```markdown
---
mcp: shipyard-proxy
tool: invoke_agent
args:
  agent: reviewer
  plugin: security-analyzer
---
Invoke the remote security reviewer agent. Pass through all context and task details.
```

##### Hooks → Proxy Hook Configuration

**Original plugin.json:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{"type": "command", "command": "./scripts/lint.sh"}]
    }]
  }
}
```

**Generated thin client plugin.json:**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "mcp",
        "server": "shipyard-proxy",
        "tool": "execute_hook",
        "args": {
          "hook": "PostToolUse",
          "plugin": "security-analyzer"
        }
      }]
    }]
  }
}
```

##### MCP Servers → Single Unified Proxy

**Original plugin with multiple MCP servers:**
```json
{
  "mcpServers": {
    "database": { "command": "./db-server" },
    "api-client": { "command": "./api-server" }
  }
}
```

**Generated thin client - single proxy exposing all tools:**
```json
{
  "mcpServers": {
    "shipyard-proxy": {
      "type": "http",
      "url": "https://api.shipyard.run/plugins/security-analyzer/mcp",
      "headers": {
        "Authorization": "Bearer ${SHIPYARD_API_KEY}"
      }
    }
  }
}
```

The proxy exposes all tools from `database` and `api-client` under namespaced names (e.g., `database_query`, `api_fetch`).

#### Shipyard MCP Proxy Server (Container-Side)

Each container runs an MCP server that proxies requests to the actual plugin components:

```typescript
// Container-side MCP server that proxies to actual plugin components
class ShipyardMCPProxy {
  private plugin: Plugin;
  private claudeCode: HeadlessClaudeCode;

  // Expose tools that map to plugin components
  tools = {
    // Command execution
    execute_command: async ({ command, context, files }) => {
      const commandPath = `./commands/${command}.md`;
      const prompt = await fs.readFile(commandPath, 'utf-8');

      // Write files to temp workspace
      const workspace = await this.createWorkspace(files);

      // Execute via Claude Code headless
      return await this.claudeCode.execute(prompt, {
        cwd: workspace,
        context
      });
    },

    // Agent invocation
    invoke_agent: async ({ agent, task, context, files }) => {
      const agentPath = `./agents/${agent}.md`;
      const agentPrompt = await fs.readFile(agentPath, 'utf-8');

      const workspace = await this.createWorkspace(files);

      // Run agent via Claude Code headless
      return await this.claudeCode.runAgent(agentPrompt, task, {
        cwd: workspace,
        context
      });
    },

    // Hook execution
    execute_hook: async ({ hook, event, context }) => {
      const hookConfig = this.plugin.hooks[hook];
      // Run the actual hook script
      return await this.executeHook(hookConfig, event, context);
    },

    // Plus all tools from original MCP servers
    // Dynamically loaded and namespaced
    ...this.loadOriginalMCPTools()
  };

  private loadOriginalMCPTools() {
    const tools = {};
    for (const [serverName, server] of Object.entries(this.plugin.mcpServers)) {
      const serverTools = this.startMCPServer(server);
      for (const [toolName, tool] of Object.entries(serverTools)) {
        // Namespace: database_query, api_fetch, etc.
        tools[`${serverName}_${toolName}`] = tool;
      }
    }
    return tools;
  }
}
```

#### Complete Thin Client Structure

```
plugins/security-analyzer/          # In Shipyard marketplace repo
├── plugin.json                     # Thin config with MCP proxy
├── commands/
│   ├── analyze.md                  # Stub → MCP execute_command
│   ├── report.md                   # Stub → MCP execute_command
│   └── scan.md                     # Stub → MCP execute_command
├── agents/
│   └── reviewer.md                 # Stub → MCP invoke_agent
└── README.md                       # User-facing docs (visible)
```

#### Thin Client Generation Algorithm

```typescript
async function generateThinClient(creatorPlugin: Plugin): Promise<ThinClient> {
  const thin: ThinClient = {
    name: creatorPlugin.name,
    description: `${creatorPlugin.description}`,
    version: creatorPlugin.version,
    mcpServers: {
      'shipyard-proxy': {
        type: 'http',
        url: `https://api.shipyard.run/plugins/${creatorPlugin.name}/mcp`,
        headers: { Authorization: 'Bearer ${SHIPYARD_API_KEY}' }
      }
    },
    commands: [],
    agents: [],
    hooks: {}
  };

  // Generate command stubs
  for (const cmd of await discoverCommands(creatorPlugin)) {
    const stub = generateCommandStub(creatorPlugin.name, cmd.name, cmd.description);
    thin.commands.push({
      path: `commands/${cmd.name}.md`,
      content: stub
    });
  }

  // Generate agent stubs
  for (const agent of await discoverAgents(creatorPlugin)) {
    const stub = generateAgentStub(creatorPlugin.name, agent.name, agent.description);
    thin.agents.push({
      path: `agents/${agent.name}.md`,
      content: stub
    });
  }

  // Generate hook proxy configuration
  if (creatorPlugin.hooks) {
    for (const [event, handlers] of Object.entries(creatorPlugin.hooks)) {
      thin.hooks[event] = handlers.map(h => ({
        matcher: h.matcher,
        hooks: [{
          type: 'mcp',
          server: 'shipyard-proxy',
          tool: 'execute_hook',
          args: { hook: event, plugin: creatorPlugin.name, matcher: h.matcher }
        }]
      }));
    }
  }

  return thin;
}

function generateCommandStub(pluginName: string, commandName: string, description: string): string {
  return `---
description: ${description}
mcp: shipyard-proxy
tool: execute_command
args:
  command: ${commandName}
  plugin: ${pluginName}
---
Execute the ${commandName} command. Context and files will be passed to the remote plugin.
`;
}

function generateAgentStub(pluginName: string, agentName: string, description: string): string {
  return `---
mcp: shipyard-proxy
tool: invoke_agent
args:
  agent: ${agentName}
  plugin: ${pluginName}
---
${description || `Invoke the ${agentName} agent remotely.`}
`;
}
```

#### User Experience - Feels Completely Native

From the user's perspective, marketplace plugins are indistinguishable from local plugins:

```bash
# Install (gets thin client with stubs)
/plugin install security-analyzer@shipyard

# Use commands - works exactly like local
/project:security-analyzer analyze src/

# Tab completion works (stubs have descriptions)
/project:security-analyzer [TAB]
  analyze  - Analyze code for security vulnerabilities
  report   - Generate security report
  scan     - Quick security scan

# Agents work
# (internally routed through MCP)

# Hooks fire on Write/Edit
# (internally routed through MCP)

# Even MCP tools from original plugin work
# (exposed through shipyard-proxy with namespacing)
```

The user never knows the actual prompts, agents, and logic are running remotely in a Shipyard container.

#### MCP Configuration (.mcp.json)

**For Shipyard Marketplace:**
```json
{
  "mcpServers": {
    "shipyard-proxy": {
      "type": "http",
      "url": "https://api.shipyard.run/plugins/security-analyzer/mcp",
      "headers": {
        "Authorization": "Bearer ${SHIPYARD_API_KEY}"
      }
    }
  }
}
```

**For Self-Hosted:**
```json
{
  "mcpServers": {
    "shipyard-proxy": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${LOCAL_API_KEY}"
      }
    }
  }
}
```

### Component 2: Shipyard Middleware (Marketplace Only)

All marketplace requests flow through Shipyard's auth/billing middleware before reaching the plugin container.

```typescript
// Shipyard API Gateway middleware
app.post('/plugins/:pluginId/execute', async (req, res) => {
  const { pluginId } = req.params;
  const apiKey = req.headers.authorization?.split(' ')[1];

  // 1. Auth
  const user = await validateApiKey(apiKey);
  if (!user) return res.status(401).json({ error: 'Invalid API key' });

  // 2. Subscription check
  const subscription = await getSubscription(user.id, pluginId);
  if (!subscription?.active) {
    return res.status(403).json({
      error: 'Subscription required',
      subscribeUrl: `https://shipyard.run/subscribe/${pluginId}`
    });
  }

  // 3. Rate limiting
  if (await isRateLimited(user.id, pluginId)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // 4. Forward to plugin container (internal ECS service)
  const pluginEndpoint = await getPluginInternalEndpoint(pluginId);
  const response = await proxyToPlugin(pluginEndpoint, req.body, res);

  // 5. Track usage for billing
  await trackUsage(user.id, pluginId, response.tokensUsed);
});
```

### Component 3: Plugin Server (Container)

The server runs headless Claude Code with the full plugin installed.

#### Server Implementation

```typescript
// server/src/index.ts
import express from 'express';
import { spawn } from 'child_process';
import { validateAuth, trackUsage } from './auth';

const app = express();

app.post('/execute', async (req, res) => {
  const { apiKey, prompt, files } = req.body;

  // Validate subscription
  const user = await validateAuth(apiKey);
  if (!user.active) {
    return res.status(401).json({ error: 'Subscription required' });
  }

  // Set up SSE for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Write files to temp workspace
  const workspace = await createTempWorkspace(files);

  // Spawn Claude Code in headless mode
  const claude = spawn('claude', [
    '--print',
    '--output-format', 'stream-json',
    '--max-turns', '50',
    prompt
  ], {
    cwd: workspace,
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.CREATOR_ANTHROPIC_KEY,
    }
  });

  // Stream stdout to client
  claude.stdout.on('data', (data) => {
    res.write(`data: ${data.toString()}\n\n`);
  });

  claude.stderr.on('data', (data) => {
    console.error('Claude error:', data.toString());
  });

  claude.on('close', async (code) => {
    await trackUsage(user.id, /* tokens used */);
    await cleanupWorkspace(workspace);
    res.write(`data: [DONE]\n\n`);
    res.end();
  });
});

app.listen(3000);
```

#### Dockerfile

```dockerfile
FROM node:20-slim

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code

# Copy the FULL plugin (with all the secret prompts)
COPY ./plugin /app/plugin

# Install plugin into Claude Code
RUN claude plugin install /app/plugin

# Copy server
COPY ./server /app/server
WORKDIR /app/server
RUN npm install

EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Component 3: Creator Plugin Source Structure

```
my-premium-plugin/
├── .claude-plugin/
│   └── plugin.json           # Metadata
├── public/                    # Goes into thin client
│   ├── commands/
│   │   └── analyze.md        # Stub command (no logic)
│   └── README.md
├── plugin/                    # Full plugin (stays in container)
│   ├── commands/
│   │   └── analyze.md        # Real prompts
│   ├── agents/
│   │   └── security-expert.md
│   └── hooks/
│       └── hooks.json
├── server/                    # MCP server code
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── Dockerfile
├── shipyard.config.ts         # Deployment configuration
└── pricing.json               # Pricing tiers
```

### Component 4: Shipyard Configuration

#### shipyard.config.ts

```typescript
export default {
  name: 'security-analyzer',

  // What to include in thin client
  thinClient: {
    include: ['public/**/*'],
    mcpEndpoint: '${SHIPYARD_SERVER_URL}/execute',
  },

  // Server deployment
  server: {
    runtime: 'node20',
    entry: 'server/src/index.ts',
    dockerfile: 'server/Dockerfile',
    env: {
      CREATOR_ANTHROPIC_KEY: { secret: true },
    },
  },

  // AWS deployment target (creator's account)
  aws: {
    region: 'us-east-1',
    ecs: {
      cpu: 512,
      memory: 1024,
      minInstances: 1,
      maxInstances: 10,
    },
  },

  // Pricing
  pricing: {
    model: 'subscription',
    tiers: [
      { name: 'starter', price: 9.99, executionsPerMonth: 100 },
      { name: 'pro', price: 29.99, executionsPerMonth: 1000 },
      { name: 'team', price: 99.99, executionsPerMonth: 5000 },
    ],
  },
};
```

## Publishing Flow

### Path 1: Shipyard Marketplace (Monetized)

```bash
# Initialize a monetized plugin
claude-shipyard init --type marketplace

# Develop the plugin locally
# - Write prompts in /plugin/commands/
# - Create agents in /plugin/agents/
# - Build server in /server/

# Validate before publishing
claude-shipyard validate

# Publish to Shipyard marketplace
claude-shipyard publish --target marketplace

# Output:
# ✓ GitHub App authorized for repo access
# ✓ Source code pulled from your repo
# ✓ Generated thin client (no prompts exposed)
# ✓ Built server Docker image
# ✓ Pushed to Shipyard ECR
# ✓ Created ECS service in Shipyard infrastructure
# ✓ Registered in marketplace manifest
# ✓ Stripe Connect configured
#
# Your plugin is live at:
#   /plugin install security-analyzer@shipyard-marketplace
#
# Creator dashboard:
#   https://shipyard.run/dashboard/security-analyzer
```

### Path 2: Self-Hosted (Open Source)

```bash
# Initialize a self-hosted plugin
claude-shipyard init --type self-hosted

# Develop the plugin locally

# Build and run container locally
claude-shipyard serve

# Output:
# ✓ Built Docker image: my-plugin:latest
# ✓ Container running at http://localhost:3000
# ✓ Generated thin client in ./dist/thin-client/
#
# Install the thin client:
#   claude plugin install ./dist/thin-client

# Or deploy to your own infrastructure
claude-shipyard build

# Output:
# ✓ Docker image: my-plugin:latest
# ✓ Thin client: ./dist/thin-client/
#
# Deploy the image to your AWS/GCP/etc and update
# the thin client's .mcp.json with your endpoint URL.
```

### GitHub App for Source Code Access (Marketplace)

When publishing to the Shipyard marketplace, creators authorize the Shipyard GitHub App to access their repository. This is required because Shipyard hosts the plugin containers.

```typescript
// GitHub App workflow
// 1. Creator runs: claude-shipyard publish --target marketplace
// 2. CLI opens browser for GitHub App authorization
// 3. Shipyard clones the repo (read-only access)
// 4. Builds container image from source
// 5. Deploys to Shipyard's ECS
// 6. Registers in marketplace

interface GitHubAppPermissions {
  contents: 'read';      // Clone repo
  metadata: 'read';      // Repo info
  // No write access needed
}
```

**Legal Requirements:**
- Creator agrees to Terms of Service granting Shipyard license to host/run code
- Source code is stored securely, not accessible to end users
- Creator retains full ownership and can unpublish at any time

### Marketplace Structure (Claude Code Native)

The Shipyard marketplace follows Claude Code's native marketplace format at `.claude-plugin/marketplace.json`:

```
https://github.com/shipyard-marketplace/registry
├── .claude-plugin/
│   └── marketplace.json        # Claude Code marketplace manifest
├── plugins/
│   ├── security-analyzer/      # Generated thin client
│   │   ├── plugin.json
│   │   ├── commands/
│   │   │   ├── analyze.md      # Stub → MCP
│   │   │   └── report.md       # Stub → MCP
│   │   ├── agents/
│   │   │   └── reviewer.md     # Stub → MCP
│   │   └── README.md
│   └── code-formatter/
│       └── ...
└── README.md
```

#### marketplace.json (Claude Code Format)

```json
{
  "name": "shipyard-marketplace",
  "owner": {
    "name": "Shipyard",
    "email": "marketplace@shipyard.run"
  },
  "metadata": {
    "description": "Monetized Claude Code plugins",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "security-analyzer",
      "source": "./plugins/security-analyzer",
      "description": "AI-powered security vulnerability analysis",
      "version": "1.2.0",
      "author": {
        "name": "Alice",
        "email": "alice@example.com"
      },
      "homepage": "https://shipyard.run/plugins/security-analyzer",
      "license": "Proprietary",
      "keywords": ["security", "vulnerabilities", "OWASP"],
      "category": "security",
      "strict": false
    },
    {
      "name": "code-formatter",
      "source": "./plugins/code-formatter",
      "description": "Intelligent code formatting and style enforcement",
      "version": "2.0.1",
      "author": {
        "name": "Bob"
      },
      "category": "developer-tools",
      "strict": false
    }
  ]
}
```

#### Internal Metadata (Shipyard Backend)

Shipyard maintains additional metadata not exposed in the Claude Code marketplace:

```typescript
// Stored in Shipyard database, not in marketplace repo
interface ShipyardPluginMetadata {
  pluginId: string;

  // Creator info
  creator: {
    id: string;
    stripeAccountId: string;
    githubRepo: string;        // Source code location
  };

  // Pricing (displayed on shipyard.run, not in thin client)
  pricing: {
    model: 'subscription' | 'usage';
    tiers: Array<{
      name: string;
      price: number;
      executionsPerMonth: number;
    }>;
  };

  // Infrastructure
  internal: {
    ecsServiceArn: string;
    endpoint: string;          // Internal ECS endpoint
    imageUri: string;          // ECR image
  };

  // Analytics
  stats: {
    installs: number;
    activeSubscriptions: number;
    totalRevenue: number;
  };
}
```

#### How Users Install

```bash
# Add Shipyard marketplace (one time)
/plugin marketplace add shipyard-marketplace/registry

# Browse available plugins
/plugin

# Install a plugin (gets the thin client)
/plugin install security-analyzer@shipyard-marketplace

# First run prompts for subscription
/project:security-analyzer analyze src/
# → "This plugin requires a subscription. Subscribe at:
#    https://shipyard.run/subscribe/security-analyzer"
```

### What Each Publish Target Does

**`claude-shipyard publish --target marketplace`**
1. **Authorizes** GitHub App for repo access
2. **Clones** source code to Shipyard build system
3. **Validates** plugin structure and configuration
4. **Generates thin client** from `public/` directory
5. **Builds Docker image** with full plugin + server
6. **Pushes to Shipyard ECR** (your infrastructure)
7. **Deploys ECS service** in Shipyard's AWS
8. **Uploads thin client** to marketplace registry repo
9. **Registers plugin** in manifest with pricing
10. **Configures Stripe Connect** for revenue splitting

**`claude-shipyard serve`** (self-hosted, local dev)
1. **Builds Docker image** locally
2. **Runs container** on localhost
3. **Generates thin client** pointing to localhost

**`claude-shipyard build`** (self-hosted, production)
1. **Builds Docker image** tagged for deployment
2. **Generates thin client** (user updates endpoint manually)
3. **Outputs deployment instructions** for user's infrastructure

## User Experience

### Installation Flow

```bash
# User browses marketplace
/plugin

# Selects a premium plugin
/plugin install security-analyzer@shipyard-marketplace

# Claude Code prompts:
# "This plugin requires a subscription. Set up at:
#  https://shipyard.dev/subscribe/security-analyzer
#
#  After subscribing, run:
#  /security-analyzer auth"

# User subscribes via Stripe checkout
# Gets API key

# Configures the plugin
/security-analyzer auth
# Enter API key: sk_live_...

# Plugin is ready
/analyze-security src/
```

### Execution Flow (Marketplace)

1. User types `/analyze-security src/auth/`
2. Thin client command tells Claude to:
   - Read files in `src/auth/`
   - Call `execute_remote` MCP tool with prompt + files
3. MCP tool POSTs to `api.shipyard.run/plugins/security-analyzer/execute`
4. **Shipyard middleware**:
   - Validates API key
   - Checks subscription active
   - Applies rate limiting
5. Request forwarded to internal ECS service
6. Container writes files to temp workspace
7. Container spawns headless Claude Code with full plugin
8. Claude Code executes the real command with real prompts
9. Response streams back via SSE
10. Shipyard middleware tracks usage for billing
11. User sees output in their terminal

### Execution Flow (Self-Hosted)

1. User types `/analyze-security src/auth/`
2. Thin client command tells Claude to:
   - Read files in `src/auth/`
   - Call `execute_remote` MCP tool with prompt + files
3. MCP tool POSTs to user's configured endpoint
4. Container spawns headless Claude Code
5. Response streams back via SSE
6. User sees output in their terminal

## Revenue Model

### Stripe Connect Integration

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│ End User    │────▶│ Shipyard        │────▶│ Creator's    │
│             │     │ Payment Gateway │     │ Stripe Acct  │
└─────────────┘     └─────────────────┘     └──────────────┘
                           │
                           │ Platform fee (20%)
                           ▼
                    ┌─────────────────┐
                    │ Shipyard's      │
                    │ Stripe Acct     │
                    └─────────────────┘
```

- Creators connect their Stripe account during onboarding
- User payments go through Shipyard
- Automatic 80/20 split (configurable)
- Monthly payouts to creators

### Pricing Strategy

Creators set their own prices. Recommended model:

| Tier | Price | Executions | Target User |
|------|-------|------------|-------------|
| Starter | $9.99/mo | 100 | Individual devs |
| Pro | $29.99/mo | 1,000 | Power users |
| Team | $99.99/mo | 5,000 | Teams |

**Cost Structure:**
- Shipyard covers infrastructure costs (ECS, API Gateway, storage)
- Claude API costs are covered by Shipyard from platform revenue
- Creators receive net revenue after platform fee

## Technical Challenges & Solutions

### 1. File Context Synchronization

**Challenge**: User's local files need to reach the container.

**Solution**: Thin client reads files and sends as JSON payload.

```typescript
// Thin client MCP tool implementation
async function executeRemote(prompt: string, paths: string[]) {
  const files = await Promise.all(
    paths.map(async (p) => ({
      path: p,
      content: await fs.readFile(p, 'utf-8'),
    }))
  );

  return fetch(serverUrl, {
    method: 'POST',
    body: JSON.stringify({ prompt, files }),
  });
}
```

### 2. Streaming MCP Responses

**Challenge**: MCP tools typically return complete responses.

**Solution**: Use SSE (Server-Sent Events) in MCP tool response.

```typescript
// MCP tool returns a stream
{
  "type": "stream",
  "url": "https://server/execute/session-123",
  "format": "sse"
}
```

### 3. Tool Permissions & Security

**Challenge**: Remote Claude Code needs tool access but must be sandboxed.

**Solution**:
- Run in isolated container with no network access except Claude API
- Whitelist specific tools per plugin
- Return file changes as diff, user approves locally

### 4. Container Cold Starts

**Challenge**: Spinning up containers per-request is slow and expensive.

**Solution**:
- Maintain warm container pool for popular plugins
- Use AWS Lambda-style scaling
- Keep minimum 1 instance for subscribed plugins

### 5. Large File Handling

**Challenge**: Sending entire codebases is expensive and slow.

**Solution**:
- Client-side file selection UI
- Gitignore-aware file filtering
- Chunked uploads for large files
- Optional: mount S3 bucket with user's repo

## Security Considerations

### Prompt Protection

- Prompts stay in Shipyard-hosted containers (not accessible to end users)
- No way for user to inspect container filesystem
- API responses only contain output, not prompts
- Source code stored in Shipyard's secure infrastructure

### User Data Protection

- Files are processed in ephemeral containers
- Workspace deleted after execution
- No persistent storage of user code
- Optional: E2E encryption of file contents

### API Key Security

- Keys bound to user accounts
- Rate limiting per key
- Anomaly detection for sharing
- Key rotation support

## Marketplace Features

### For Users

- Browse plugins by category
- Read reviews and ratings
- View pricing before install
- Free trial periods
- Team license management

### For Creators

- Analytics dashboard (installs, usage, revenue)
- User management
- Pricing experiments
- Usage alerts
- Payout history

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Thin client generation from full plugin
- [ ] Basic server template
- [ ] `claude-shipyard serve` command (local development)
- [ ] `claude-shipyard build` command (self-hosted production)
- [ ] Docker container template with headless Claude Code

### Phase 2: Shipyard Marketplace Infrastructure
- [ ] GitHub App for source code access
- [ ] Shipyard ECS deployment pipeline
- [ ] Auth/billing middleware
- [ ] Marketplace registry (GitHub repo)
- [ ] Stripe Connect integration
- [ ] `claude-shipyard publish --target marketplace` command

### Phase 3: User Experience
- [ ] Streaming response support
- [ ] File synchronization optimization
- [ ] Subscription management UI
- [ ] Creator dashboard
- [ ] Plugin installation flow

### Phase 4: Scale & Polish
- [ ] Warm container pools
- [ ] Advanced analytics
- [ ] Team/enterprise features
- [ ] Plugin versioning and updates

### Phase 5: Ecosystem Growth
- [ ] Public marketplace launch
- [ ] Creator onboarding program
- [ ] Featured plugins
- [ ] Plugin certification

## Success Metrics

### For Platform
- Number of published plugins
- Monthly active users
- Gross merchandise value (GMV)
- Creator retention rate

### For Creators
- Monthly recurring revenue
- User retention
- Average revenue per user
- Support ticket volume

### For Users
- Plugin discovery success rate
- Time to value
- Subscription retention
- NPS score

## Open Questions

1. **Pricing model**: Should we also support usage-based pricing (per execution)?
2. **Free plugins**: How do we handle free plugins that still need server infrastructure?
3. **Plugin updates**: How do we handle versioning and breaking changes?
4. **Offline support**: Any capability for degraded offline mode?
5. **Collaboration**: Can team members share a single subscription?

## Appendix: MCP Tool Schema

```typescript
interface ExecuteRemoteTool {
  name: 'execute_remote';
  description: 'Execute command on remote Claude Code instance';
  inputSchema: {
    type: 'object';
    properties: {
      prompt: {
        type: 'string';
        description: 'The full user prompt/command to execute';
      };
      files: {
        type: 'array';
        description: 'Files to include in the execution context';
        items: {
          type: 'object';
          properties: {
            path: { type: 'string' };
            content: { type: 'string' };
          };
          required: ['path', 'content'];
        };
      };
    };
    required: ['prompt'];
  };
}
```
