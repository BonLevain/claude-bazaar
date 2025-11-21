# Claude Bazaar - Code Architecture

This document defines the separation between open-source and closed-source components, shared code patterns, and implementation details for execution.

## Repository Structure

### Two Repositories

```
claude-bazaar/                    # Open Source (MIT)
├── packages/
│   ├── cli/                        # Main CLI tool
│   ├── core/                       # Shared core logic
│   ├── container-runtime/          # Docker/headless Claude Code server
│   ├── thin-client-generator/      # Generates thin clients
│   └── deployment/                 # Deployment utilities (Docker, optional K8s)
├── templates/
│   └── plugin-server/              # Starter server template
└── docs/

bazaar-platform/                  # Closed Source (Proprietary)
├── packages/
│   ├── api-gateway/                # Bazaar auth/billing middleware
│   ├── marketplace-service/        # Bazaar registry management
│   ├── billing-service/            # Stripe Connect integration
│   └── orchestration/              # Bazaar's ECS/infra orchestration
├── infrastructure/
│   └── terraform/                  # Bazaar's AWS infrastructure
└── dashboard/                      # Creator/admin dashboard
```

## Open Source Components

### 1. CLI (`packages/cli`)

The main `claude-bazaar` command-line tool.

```typescript
// packages/cli/src/index.ts
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { serveCommand } from './commands/serve';
import { buildCommand } from './commands/build';
import { publishCommand } from './commands/publish';

const program = new Command()
  .name('claude-bazaar')
  .description('Deploy Claude Code plugins as services')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(serveCommand);
program.addCommand(buildCommand);
program.addCommand(publishCommand);

program.parse();
```

#### Commands

| Command | Description | Open Source | Marketplace |
|---------|-------------|-------------|-------------|
| `init` | Initialize plugin project | ✓ | ✓ |
| `serve` | Run locally for development | ✓ | ✓ |
| `build` | Build for production deployment | ✓ | ✓ |
| `publish` | Publish to marketplace | - | ✓ (calls API) |
| `validate` | Validate plugin structure | ✓ | ✓ |

### 2. Core Library (`packages/core`)

Shared logic used by both open-source and closed-source components.

```
packages/core/
├── src/
│   ├── plugin/
│   │   ├── PluginManifest.ts       # Parse plugin.json
│   │   ├── PluginDiscovery.ts      # Find commands/agents/hooks
│   │   └── PluginValidator.ts      # Validate structure
│   ├── thin-client/
│   │   ├── ThinClientGenerator.ts  # Generate stubs
│   │   └── StubTemplates.ts        # Command/agent stub templates
│   ├── mcp/
│   │   ├── MCPProxyServer.ts       # Container-side MCP server
│   │   └── MCPToolRegistry.ts      # Tool discovery/namespacing
│   ├── config/
│   │   ├── BazaarConfig.ts       # bazaar.config.ts parser
│   │   └── ConfigSchema.ts         # Zod schemas
│   └── types/
│       └── index.ts
├── package.json
└── tsconfig.json
```

### 3. Container Runtime (`packages/container-runtime`)

The server that runs inside Docker containers.

```
packages/container-runtime/
├── src/
│   ├── server.ts                   # Express/Fastify HTTP server
│   ├── ClaudeCodeRunner.ts         # Spawn headless Claude Code
│   ├── WorkspaceManager.ts         # Temp file management
│   ├── StreamHandler.ts            # SSE streaming
│   └── MCPProxy.ts                 # MCP proxy implementation
├── Dockerfile
└── package.json
```

### 4. Thin Client Generator (`packages/thin-client-generator`)

Generates thin clients from full plugins.

### 5. Deployment Utilities (`packages/deployment`)

Open source deployment helpers for self-hosted users.

```
packages/deployment/
├── src/
│   ├── docker/
│   │   ├── DockerBuilder.ts        # Build Docker images
│   │   ├── DockerRunner.ts         # Run containers locally
│   │   └── ComposeGenerator.ts     # Generate docker-compose.yml
│   ├── kubernetes/
│   │   ├── ManifestGenerator.ts    # Generate K8s manifests
│   │   └── HelmChartGenerator.ts   # Generate Helm charts
│   └── registry/
│       └── RegistryPusher.ts       # Push to any container registry
├── templates/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── k8s/
└── package.json
```

```typescript
// packages/deployment/src/docker/DockerBuilder.ts
export class DockerBuilder {
  async build(pluginPath: string, options: BuildOptions): Promise<string> {
    const dockerfile = options.dockerfile ||
      path.join(__dirname, '../templates/Dockerfile');

    const imageTag = `${options.name}:${options.version || 'latest'}`;

    await execa('docker', [
      'build',
      '-t', imageTag,
      '-f', dockerfile,
      pluginPath,
    ]);

    return imageTag;
  }

  async push(imageTag: string, registry: string): Promise<string> {
    const remoteTag = `${registry}/${imageTag}`;
    await execa('docker', ['tag', imageTag, remoteTag]);
    await execa('docker', ['push', remoteTag]);
    return remoteTag;
  }
}

// packages/deployment/src/kubernetes/ManifestGenerator.ts
export class ManifestGenerator {
  generate(plugin: Plugin, options: K8sOptions): string {
    return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${plugin.name}
spec:
  replicas: ${options.replicas || 1}
  selector:
    matchLabels:
      app: ${plugin.name}
  template:
    metadata:
      labels:
        app: ${plugin.name}
    spec:
      containers:
      - name: ${plugin.name}
        image: ${options.image}
        ports:
        - containerPort: 3000
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: ${plugin.name}-secrets
              key: anthropic-api-key
---
apiVersion: v1
kind: Service
metadata:
  name: ${plugin.name}
spec:
  selector:
    app: ${plugin.name}
  ports:
  - port: 80
    targetPort: 3000
`;
  }
}
```

This allows self-hosted users to:
- Build Docker images
- Run locally with `docker-compose`
- Deploy to their own Kubernetes cluster
- Push to any container registry (Docker Hub, GCR, ECR, etc.)

```typescript
// packages/thin-client-generator/src/ThinClientGenerator.ts
import { PluginManifest, PluginDiscovery } from '@claude-bazaar/core';

export class ThinClientGenerator {
  constructor(
    private pluginPath: string,
    private options: GeneratorOptions
  ) {}

  async generate(): Promise<ThinClient> {
    const manifest = await PluginManifest.load(this.pluginPath);
    const discovery = new PluginDiscovery(this.pluginPath);

    const commands = await discovery.discoverCommands();
    const agents = await discovery.discoverAgents();
    const hooks = manifest.hooks;
    const mcpServers = manifest.mcpServers;

    return {
      manifest: this.generateThinManifest(manifest),
      commands: commands.map(cmd => this.generateCommandStub(cmd)),
      agents: agents.map(agent => this.generateAgentStub(agent)),
      hooks: this.generateHookProxies(hooks),
      mcpConfig: this.generateMCPConfig(mcpServers),
    };
  }

  private generateCommandStub(command: Command): GeneratedFile {
    return {
      path: `commands/${command.name}.md`,
      content: `---
description: ${command.description}
mcp: bazaar-proxy
tool: execute_command
args:
  command: ${command.name}
  plugin: ${this.options.pluginName}
---
Execute the ${command.name} command remotely.
`,
    };
  }

  private generateAgentStub(agent: Agent): GeneratedFile {
    return {
      path: `agents/${agent.name}.md`,
      content: `---
mcp: bazaar-proxy
tool: invoke_agent
args:
  agent: ${agent.name}
  plugin: ${this.options.pluginName}
---
${agent.description || `Invoke the ${agent.name} agent.`}
`,
    };
  }

  private generateHookProxies(hooks: Hooks): HookConfig {
    const proxied: HookConfig = {};

    for (const [event, handlers] of Object.entries(hooks)) {
      proxied[event] = handlers.map(h => ({
        matcher: h.matcher,
        hooks: [{
          type: 'mcp',
          server: 'bazaar-proxy',
          tool: 'execute_hook',
          args: {
            hook: event,
            plugin: this.options.pluginName,
            matcher: h.matcher,
          },
        }],
      }));
    }

    return proxied;
  }

  private generateMCPConfig(mcpServers: MCPServers): MCPConfig {
    return {
      mcpServers: {
        'bazaar-proxy': {
          type: 'http',
          url: this.options.endpoint,
          headers: {
            Authorization: `Bearer \${${this.options.apiKeyEnvVar}}`,
          },
        },
      },
    };
  }
}
```

## Closed Source Components (bazaar-platform)

### 1. API Gateway (`packages/api-gateway`)

Auth/billing middleware that sits in front of plugin containers.

```typescript
// packages/api-gateway/src/middleware/auth.ts
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers.authorization?.split(' ')[1];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const user = await validateApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.user = user;
  next();
}

// packages/api-gateway/src/middleware/subscription.ts
export async function subscriptionMiddleware(req: Request, res: Response, next: NextFunction) {
  const { pluginId } = req.params;
  const subscription = await getSubscription(req.user.id, pluginId);

  if (!subscription?.active) {
    return res.status(403).json({
      error: 'Subscription required',
      subscribeUrl: `https://bazaar.run/subscribe/${pluginId}`,
    });
  }

  if (await isRateLimited(req.user.id, pluginId, subscription.tier)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  req.subscription = subscription;
  next();
}

// packages/api-gateway/src/routes/plugin.ts
router.all(
  '/plugins/:pluginId/*',
  authMiddleware,
  subscriptionMiddleware,
  usageTrackingMiddleware,
  proxyToContainer
);
```

### 2. Marketplace Service (`packages/marketplace-service`)

Manages the plugin registry and marketplace repo.

```typescript
// packages/marketplace-service/src/MarketplaceService.ts
export class MarketplaceService {
  constructor(
    private github: GitHubClient,
    private db: Database,
    private ecr: ECRClient,
    private ecs: ECSClient
  ) {}

  async publishPlugin(creatorId: string, githubRepo: string): Promise<PublishResult> {
    // 1. Clone creator's repo
    const source = await this.github.cloneRepo(githubRepo);

    // 2. Validate plugin structure
    const plugin = await PluginManifest.load(source.path);
    await PluginValidator.validate(plugin);

    // 3. Generate thin client
    const generator = new ThinClientGenerator(source.path, {
      pluginName: plugin.name,
      endpoint: `https://api.bazaar.run/plugins/${plugin.name}/mcp`,
      apiKeyEnvVar: 'BAZAAR_API_KEY',
    });
    const thinClient = await generator.generate();

    // 4. Build and push Docker image
    const imageUri = await this.buildAndPushImage(source.path, plugin.name);

    // 5. Deploy ECS service
    const serviceArn = await this.deployECSService(plugin.name, imageUri);

    // 6. Update marketplace repo
    await this.updateMarketplaceRepo(plugin, thinClient);

    // 7. Store metadata in database
    await this.db.plugins.create({
      id: plugin.name,
      creatorId,
      githubRepo,
      imageUri,
      serviceArn,
      internalEndpoint: `http://${plugin.name}.bazaar.internal:3000`,
    });

    return {
      pluginId: plugin.name,
      marketplaceUrl: `https://github.com/bazaar-marketplace/registry`,
      dashboardUrl: `https://bazaar.run/dashboard/${plugin.name}`,
    };
  }

  private async updateMarketplaceRepo(plugin: PluginManifest, thinClient: ThinClient) {
    // Clone marketplace repo
    const repo = await this.github.cloneRepo('bazaar-marketplace/registry');

    // Write thin client files
    const pluginDir = `${repo.path}/plugins/${plugin.name}`;
    await fs.mkdir(pluginDir, { recursive: true });

    await fs.writeFile(
      `${pluginDir}/plugin.json`,
      JSON.stringify(thinClient.manifest, null, 2)
    );

    for (const cmd of thinClient.commands) {
      await fs.writeFile(`${pluginDir}/${cmd.path}`, cmd.content);
    }

    for (const agent of thinClient.agents) {
      await fs.writeFile(`${pluginDir}/${agent.path}`, agent.content);
    }

    // Update marketplace.json
    const marketplace = await this.loadMarketplaceJson(repo.path);
    marketplace.plugins.push({
      name: plugin.name,
      source: `./plugins/${plugin.name}`,
      description: plugin.description,
      version: plugin.version,
      author: plugin.author,
      category: plugin.category,
      strict: false,
    });
    await this.saveMarketplaceJson(repo.path, marketplace);

    // Commit and push
    await this.github.commitAndPush(repo, `Add ${plugin.name} plugin`);
  }
}
```

### 3. Billing Service (`packages/billing-service`)

Stripe Connect integration for revenue splitting.

```typescript
// packages/billing-service/src/BillingService.ts
export class BillingService {
  constructor(private stripe: Stripe) {}

  async createCreatorAccount(creatorId: string, email: string): Promise<string> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    return account.id;
  }

  async createSubscription(
    userId: string,
    pluginId: string,
    tierId: string
  ): Promise<Subscription> {
    const plugin = await this.db.plugins.get(pluginId);
    const tier = plugin.pricing.tiers.find(t => t.name === tierId);

    const subscription = await this.stripe.subscriptions.create({
      customer: userId,
      items: [{ price: tier.stripePriceId }],
      application_fee_percent: 20, // Bazaar takes 20%
      transfer_data: {
        destination: plugin.creator.stripeAccountId,
      },
    });

    return subscription;
  }

  async trackUsage(userId: string, pluginId: string, tokens: number) {
    await this.stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity: tokens,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      }
    );
  }
}
```

### 4. Orchestration Service (`packages/orchestration`)

**Bazaar-specific** ECS orchestration for marketplace plugin containers. This is NOT needed by self-hosted users (they use the open-source `packages/deployment` instead).

```typescript
// packages/orchestration/src/OrchestrationService.ts
export class OrchestrationService {
  constructor(
    private ecs: ECSClient,
    private ecr: ECRClient,
    private serviceMesh: ServiceMeshClient
  ) {}

  async deployPlugin(pluginId: string, imageUri: string): Promise<string> {
    // Create task definition
    const taskDef = await this.ecs.registerTaskDefinition({
      family: `bazaar-plugin-${pluginId}`,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '512',
      memory: '1024',
      containerDefinitions: [{
        name: pluginId,
        image: imageUri,
        portMappings: [{ containerPort: 3000 }],
        environment: [
          { name: 'PLUGIN_ID', value: pluginId },
        ],
        secrets: [
          { name: 'ANTHROPIC_API_KEY', valueFrom: 'arn:aws:secretsmanager:...' },
        ],
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': `/bazaar/plugins/${pluginId}`,
            'awslogs-region': 'us-east-1',
            'awslogs-stream-prefix': 'ecs',
          },
        },
      }],
    });

    // Create service
    const service = await this.ecs.createService({
      cluster: 'bazaar-plugins',
      serviceName: pluginId,
      taskDefinition: taskDef.taskDefinitionArn,
      desiredCount: 1,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ['subnet-xxx'],
          securityGroups: ['sg-xxx'],
          assignPublicIp: 'DISABLED',
        },
      },
      serviceRegistries: [{
        registryArn: 'arn:aws:servicediscovery:...',
        containerName: pluginId,
        containerPort: 3000,
      }],
    });

    return service.serviceArn;
  }
}
```

## Architectural Patterns

### 1. Strategy Pattern - Deployment Targets

```typescript
// packages/core/src/deployment/DeploymentStrategy.ts
export interface DeploymentStrategy {
  name: string;
  build(plugin: Plugin): Promise<BuildArtifact>;
  deploy(artifact: BuildArtifact): Promise<DeploymentResult>;
  generateThinClient(plugin: Plugin): Promise<ThinClient>;
}

// packages/core/src/deployment/LocalStrategy.ts
export class LocalDeploymentStrategy implements DeploymentStrategy {
  name = 'local';

  async build(plugin: Plugin): Promise<BuildArtifact> {
    // Build Docker image locally
    await docker.build({
      context: plugin.path,
      tag: `${plugin.name}:latest`,
    });
    return { imageTag: `${plugin.name}:latest` };
  }

  async deploy(artifact: BuildArtifact): Promise<DeploymentResult> {
    // Run container locally
    const container = await docker.run({
      image: artifact.imageTag,
      ports: { '3000/tcp': '3000' },
    });
    return { endpoint: 'http://localhost:3000' };
  }

  async generateThinClient(plugin: Plugin): Promise<ThinClient> {
    const generator = new ThinClientGenerator(plugin.path, {
      pluginName: plugin.name,
      endpoint: 'http://localhost:3000/mcp',
      apiKeyEnvVar: 'LOCAL_API_KEY',
    });
    return generator.generate();
  }
}

// packages/core/src/deployment/SelfHostedStrategy.ts
export class SelfHostedDeploymentStrategy implements DeploymentStrategy {
  name = 'self-hosted';

  async build(plugin: Plugin): Promise<BuildArtifact> {
    // Build production image
    await docker.build({
      context: plugin.path,
      tag: `${plugin.name}:${plugin.version}`,
    });
    return { imageTag: `${plugin.name}:${plugin.version}` };
  }

  async deploy(artifact: BuildArtifact): Promise<DeploymentResult> {
    // Don't deploy - user handles this
    return {
      imageTag: artifact.imageTag,
      instructions: 'Push to your registry and deploy to your infrastructure',
    };
  }

  async generateThinClient(plugin: Plugin): Promise<ThinClient> {
    const generator = new ThinClientGenerator(plugin.path, {
      pluginName: plugin.name,
      endpoint: '${YOUR_ENDPOINT}/mcp', // Placeholder
      apiKeyEnvVar: 'API_KEY',
    });
    return generator.generate();
  }
}

// In closed source repo:
// packages/deployment-service/src/MarketplaceStrategy.ts
export class MarketplaceDeploymentStrategy implements DeploymentStrategy {
  name = 'marketplace';

  constructor(
    private ecr: ECRClient,
    private ecs: ECSClient,
    private marketplace: MarketplaceService
  ) {}

  async build(plugin: Plugin): Promise<BuildArtifact> {
    // Build and push to Bazaar ECR
    const imageUri = await this.ecr.buildAndPush(plugin);
    return { imageUri };
  }

  async deploy(artifact: BuildArtifact): Promise<DeploymentResult> {
    // Deploy to Bazaar ECS
    const serviceArn = await this.ecs.deployService(artifact.imageUri);
    return { serviceArn, endpoint: `http://${plugin.name}.bazaar.internal:3000` };
  }

  async generateThinClient(plugin: Plugin): Promise<ThinClient> {
    const generator = new ThinClientGenerator(plugin.path, {
      pluginName: plugin.name,
      endpoint: `https://api.bazaar.run/plugins/${plugin.name}/mcp`,
      apiKeyEnvVar: 'BAZAAR_API_KEY',
    });
    return generator.generate();
  }
}
```

### 2. Factory Pattern - Strategy Selection

```typescript
// packages/core/src/deployment/StrategyFactory.ts
export class DeploymentStrategyFactory {
  private strategies: Map<string, DeploymentStrategy> = new Map();

  register(strategy: DeploymentStrategy) {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): DeploymentStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Unknown deployment strategy: ${name}`);
    }
    return strategy;
  }
}

// packages/cli/src/commands/build.ts
export const buildCommand = new Command('build')
  .description('Build plugin for deployment')
  .option('--target <target>', 'Deployment target', 'self-hosted')
  .action(async (options) => {
    const factory = new DeploymentStrategyFactory();
    factory.register(new LocalDeploymentStrategy());
    factory.register(new SelfHostedDeploymentStrategy());

    // Marketplace strategy is only available when API is configured
    if (config.bazaarApiKey) {
      factory.register(new MarketplaceDeploymentStrategy(config));
    }

    const strategy = factory.get(options.target);
    const plugin = await PluginManifest.load(process.cwd());

    const artifact = await strategy.build(plugin);
    const thinClient = await strategy.generateThinClient(plugin);

    console.log(`Built: ${artifact.imageTag}`);
    console.log(`Thin client: ./dist/thin-client/`);
  });
```

### 3. Proxy Pattern - MCP Server

```typescript
// packages/core/src/mcp/MCPProxyServer.ts
export class MCPProxyServer {
  private tools: Map<string, MCPTool> = new Map();
  private plugin: Plugin;

  constructor(pluginPath: string) {
    this.plugin = PluginManifest.loadSync(pluginPath);
    this.registerBuiltinTools();
    this.registerPluginMCPTools();
  }

  private registerBuiltinTools() {
    // Core proxy tools
    this.tools.set('execute_command', {
      description: 'Execute a plugin command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          context: { type: 'object' },
          files: { type: 'array' },
        },
        required: ['command'],
      },
      handler: this.executeCommand.bind(this),
    });

    this.tools.set('invoke_agent', {
      description: 'Invoke a plugin agent',
      inputSchema: {
        type: 'object',
        properties: {
          agent: { type: 'string' },
          task: { type: 'string' },
          context: { type: 'object' },
          files: { type: 'array' },
        },
        required: ['agent', 'task'],
      },
      handler: this.invokeAgent.bind(this),
    });

    this.tools.set('execute_hook', {
      description: 'Execute a plugin hook',
      inputSchema: {
        type: 'object',
        properties: {
          hook: { type: 'string' },
          event: { type: 'object' },
        },
        required: ['hook', 'event'],
      },
      handler: this.executeHook.bind(this),
    });
  }

  private registerPluginMCPTools() {
    // Load and namespace tools from plugin's MCP servers
    for (const [serverName, serverConfig] of Object.entries(this.plugin.mcpServers || {})) {
      const server = this.startMCPServer(serverConfig);

      for (const [toolName, tool] of server.tools.entries()) {
        // Namespace: database_query, api_fetch, etc.
        this.tools.set(`${serverName}_${toolName}`, tool);
      }
    }
  }

  async executeCommand({ command, context, files }): Promise<MCPResponse> {
    const commandPath = path.join(this.plugin.path, 'commands', `${command}.md`);
    const prompt = await fs.readFile(commandPath, 'utf-8');

    const workspace = await this.createWorkspace(files);

    const result = await this.runClaudeCode(prompt, {
      cwd: workspace,
      context,
    });

    await this.cleanupWorkspace(workspace);

    return result;
  }

  async invokeAgent({ agent, task, context, files }): Promise<MCPResponse> {
    const agentPath = path.join(this.plugin.path, 'agents', `${agent}.md`);
    const agentPrompt = await fs.readFile(agentPath, 'utf-8');

    const workspace = await this.createWorkspace(files);

    const result = await this.runClaudeCodeAgent(agentPrompt, task, {
      cwd: workspace,
      context,
    });

    await this.cleanupWorkspace(workspace);

    return result;
  }

  private async runClaudeCode(prompt: string, options: RunOptions): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', [
        '--print',
        '--output-format', 'stream-json',
        '--max-turns', '50',
        prompt,
      ], {
        cwd: options.cwd,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        },
      });

      let output = '';

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve({ content: output });
        } else {
          reject(new Error(`Claude Code exited with code ${code}`));
        }
      });
    });
  }
}
```

### 4. Builder Pattern - Configuration

```typescript
// packages/core/src/config/ConfigBuilder.ts
export class BazaarConfigBuilder {
  private config: Partial<BazaarConfig> = {};

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  description(description: string): this {
    this.config.description = description;
    return this;
  }

  thinClient(options: ThinClientOptions): this {
    this.config.thinClient = options;
    return this;
  }

  server(options: ServerOptions): this {
    this.config.server = options;
    return this;
  }

  pricing(pricing: PricingConfig): this {
    this.config.pricing = pricing;
    return this;
  }

  aws(options: AWSOptions): this {
    this.config.aws = options;
    return this;
  }

  build(): BazaarConfig {
    // Validate required fields
    if (!this.config.name) {
      throw new Error('Plugin name is required');
    }

    return this.config as BazaarConfig;
  }
}

// Usage
const config = new BazaarConfigBuilder()
  .name('security-analyzer')
  .description('AI security analysis')
  .server({
    runtime: 'node20',
    entry: 'server/src/index.ts',
  })
  .pricing({
    model: 'subscription',
    tiers: [
      { name: 'starter', price: 9.99, executions: 100 },
    ],
  })
  .build();
```

## Implementation Phases

### Phase 1: Core Open Source (Weeks 1-3)

**Goal**: Working `serve` command for local development

```bash
# End result
claude-bazaar init
claude-bazaar serve
# → Container running at http://localhost:3000
# → Thin client at ./dist/thin-client/
claude plugin install ./dist/thin-client
/project:my-plugin analyze
```

**Tasks**:

1. **Core package** (`packages/core`)
   - [ ] `PluginManifest` - parse plugin.json
   - [ ] `PluginDiscovery` - find commands/agents/hooks
   - [ ] `PluginValidator` - validate structure

2. **Thin client generator** (`packages/thin-client-generator`)
   - [ ] `ThinClientGenerator` class
   - [ ] Command stub generation
   - [ ] Agent stub generation
   - [ ] Hook proxy configuration
   - [ ] MCP config generation

3. **Container runtime** (`packages/container-runtime`)
   - [ ] Express HTTP server
   - [ ] `MCPProxyServer` with core tools
   - [ ] `ClaudeCodeRunner` - spawn headless Claude Code
   - [ ] `WorkspaceManager` - temp file handling
   - [ ] Dockerfile

4. **CLI** (`packages/cli`)
   - [ ] `init` command - scaffold project
   - [ ] `serve` command - build & run locally
   - [ ] `validate` command

### Phase 2: Production Build (Weeks 4-5)

**Goal**: `build` command for self-hosted deployment

```bash
claude-bazaar build
# → Docker image: my-plugin:1.0.0
# → Thin client: ./dist/thin-client/
docker push my-registry/my-plugin:1.0.0
```

**Tasks**:

1. **Deployment strategies**
   - [ ] `LocalDeploymentStrategy`
   - [ ] `SelfHostedDeploymentStrategy`
   - [ ] `StrategyFactory`

2. **CLI**
   - [ ] `build` command with `--target` option

3. **Documentation**
   - [ ] Self-hosted deployment guide
   - [ ] AWS/GCP/Azure examples

### Phase 3: Marketplace Backend (Weeks 6-9)

**Goal**: Closed-source platform for monetization

**Tasks**:

1. **API Gateway** (`packages/api-gateway`)
   - [ ] Auth middleware (API key validation)
   - [ ] Subscription middleware
   - [ ] Rate limiting
   - [ ] Usage tracking
   - [ ] Proxy to containers

2. **Marketplace Service** (`packages/marketplace-service`)
   - [ ] GitHub App OAuth flow
   - [ ] Clone creator repos
   - [ ] Build Docker images
   - [ ] Update marketplace repo
   - [ ] Plugin metadata database

3. **Deployment Service** (`packages/deployment-service`)
   - [ ] ECS service creation
   - [ ] ECR image management
   - [ ] Service discovery
   - [ ] Auto-scaling

4. **Billing Service** (`packages/billing-service`)
   - [ ] Stripe Connect onboarding
   - [ ] Subscription management
   - [ ] Usage-based billing
   - [ ] Revenue splitting (80/20)
   - [ ] Payout processing

5. **CLI integration**
   - [ ] `publish --target marketplace` command
   - [ ] GitHub App authorization flow

### Phase 4: Dashboard & UX (Weeks 10-12)

**Goal**: Creator and user dashboards

**Tasks**:

1. **Creator dashboard**
   - [ ] Plugin analytics (installs, usage, revenue)
   - [ ] Subscription management
   - [ ] Pricing configuration
   - [ ] Payout history

2. **User experience**
   - [ ] Subscription checkout flow
   - [ ] API key management
   - [ ] Usage dashboard

3. **Marketplace website**
   - [ ] Plugin discovery/search
   - [ ] Plugin detail pages
   - [ ] Reviews/ratings

## Shared Dependencies

### NPM Packages (Both Repos)

```json
{
  "dependencies": {
    "zod": "^3.22.0",           // Schema validation
    "commander": "^11.0.0",      // CLI framework
    "dockerode": "^4.0.0",       // Docker API
    "fast-glob": "^3.3.0",       // File discovery
    "yaml": "^2.3.0"             // YAML parsing
  }
}
```

### Closed Source Additional

```json
{
  "dependencies": {
    "stripe": "^14.0.0",         // Payments
    "@aws-sdk/client-ecs": "^3.0.0",
    "@aws-sdk/client-ecr": "^3.0.0",
    "@octokit/rest": "^20.0.0",  // GitHub API
    "prisma": "^5.0.0"           // Database
  }
}
```

## Testing Strategy

### Open Source Tests

```typescript
// packages/core/tests/ThinClientGenerator.test.ts
describe('ThinClientGenerator', () => {
  it('generates command stubs', async () => {
    const generator = new ThinClientGenerator('./fixtures/sample-plugin', {
      pluginName: 'test-plugin',
      endpoint: 'http://localhost:3000/mcp',
      apiKeyEnvVar: 'API_KEY',
    });

    const thinClient = await generator.generate();

    expect(thinClient.commands).toHaveLength(2);
    expect(thinClient.commands[0].content).toContain('mcp: bazaar-proxy');
    expect(thinClient.commands[0].content).toContain('tool: execute_command');
  });

  it('generates agent stubs', async () => {
    // ...
  });

  it('generates hook proxies', async () => {
    // ...
  });
});

// packages/container-runtime/tests/MCPProxyServer.test.ts
describe('MCPProxyServer', () => {
  it('executes commands via Claude Code', async () => {
    // ...
  });

  it('namespaces plugin MCP tools', async () => {
    // ...
  });
});
```

### Closed Source Tests

```typescript
// packages/marketplace-service/tests/MarketplaceService.test.ts
describe('MarketplaceService', () => {
  it('publishes plugin to marketplace', async () => {
    // ...
  });

  it('updates marketplace.json correctly', async () => {
    // ...
  });
});

// packages/api-gateway/tests/middleware.test.ts
describe('API Gateway Middleware', () => {
  it('rejects invalid API keys', async () => {
    // ...
  });

  it('enforces rate limits', async () => {
    // ...
  });
});
```

## Environment Variables

### Open Source

```bash
# .env (local development)
ANTHROPIC_API_KEY=sk-ant-...     # For headless Claude Code
LOCAL_API_KEY=local-dev-key      # Optional local auth
```

### Closed Source (Platform)

```bash
# Platform services
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# AWS
AWS_REGION=us-east-1
ECS_CLUSTER_ARN=arn:aws:ecs:...
ECR_REGISTRY=123456789.dkr.ecr.us-east-1.amazonaws.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GitHub App
GITHUB_APP_ID=12345
GITHUB_APP_PRIVATE_KEY=...
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...

# Anthropic (for marketplace containers)
ANTHROPIC_API_KEY=sk-ant-...
```

## Security Considerations

### Open Source

- No secrets in generated thin clients
- API keys via environment variables only
- Workspace cleanup after execution
- Container isolation

### Closed Source

- API key hashing (never store plaintext)
- Rate limiting per user/plugin
- Request logging and anomaly detection
- Encrypted secrets in AWS Secrets Manager
- VPC isolation for plugin containers
- No public IPs on containers
