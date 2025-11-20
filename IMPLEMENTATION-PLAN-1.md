# Implementation Plan Phase 1: Headless Claude Code MVP

## Goal
Fastest path to deploy and share headless Claude Code containers (open source).

**Out of Scope:** Marketplace, monetization, thin clients, MCP proxy layer, agents/hooks proxying.

---

## MVP User Journey

### Creator Flow
```bash
cd my-claude-project
shipyard init              # Creates shipyard.config.ts
shipyard build             # Builds Docker image
docker push myregistry/my-plugin:latest
```

### Consumer Flow
```bash
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=xxx myregistry/my-plugin:latest

# Call the plugin
curl http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze this code", "files": [{"path": "src/index.ts", "content": "..."}]}'
```

---

## Architecture (Minimal)

```
┌─────────────────┐     ┌──────────────────────────────┐
│   CLI Tool      │     │   Container Runtime          │
│                 │     │                              │
│ • init          │     │ • HTTP Server (Express)      │
│ • build         │     │ • Claude Code subprocess     │
│                 │     │ • File system sandbox        │
└─────────────────┘     └──────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Container Runtime (Priority: CRITICAL)
**Estimated effort: Core of MVP**

Create `packages/container-runtime/`:

```typescript
// src/server.ts
import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '10mb' }));

interface ExecuteRequest {
  prompt: string;
  files?: Array<{ path: string; content: string }>;
}

interface ExecuteResponse {
  success: boolean;
  output: string;
  error?: string;
}

app.post('/execute', async (req, res) => {
  const { prompt, files } = req.body as ExecuteRequest;

  // Create temp workspace
  const workDir = `/tmp/workspace-${Date.now()}`;
  await fs.mkdir(workDir, { recursive: true });

  try {
    // Write provided files to workspace
    if (files) {
      for (const file of files) {
        const filePath = path.join(workDir, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
      }
    }

    // Copy plugin files to workspace
    await copyPluginFiles(workDir);

    // Execute Claude Code
    const output = await executeClaudeCode(workDir, prompt);

    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({
      success: false,
      output: '',
      error: error.message
    });
  } finally {
    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true });
  }
});

async function executeClaudeCode(workDir: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['-p', prompt, '--output-format', 'json'], {
      cwd: workDir,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      },
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => { stdout += data; });
    claude.stderr.on('data', (data) => { stderr += data; });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Exit code: ${code}`));
      }
    });
  });
}

async function copyPluginFiles(workDir: string): Promise<void> {
  // Copy from /app/plugin (where Dockerfile puts creator's files)
  const pluginDir = '/app/plugin';
  // Use recursive copy
  await fs.cp(pluginDir, workDir, { recursive: true });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shipyard runtime listening on port ${PORT}`);
});
```

**Dockerfile template:**
```dockerfile
FROM node:20-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install runtime dependencies
WORKDIR /app/runtime
COPY packages/container-runtime/package*.json ./
RUN npm install --production

COPY packages/container-runtime/dist ./dist

# Copy plugin files
WORKDIR /app/plugin
COPY . .

WORKDIR /app/runtime
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Task 2: CLI - Init Command
**Estimated effort: Small**

Create `packages/cli/src/commands/init.ts`:

```typescript
import { promises as fs } from 'fs';
import path from 'path';

export async function init(projectDir: string = process.cwd()): Promise<void> {
  const configPath = path.join(projectDir, 'shipyard.config.ts');

  // Check if already initialized
  if (await fileExists(configPath)) {
    console.log('Already initialized (shipyard.config.ts exists)');
    return;
  }

  // Get project name from directory
  const projectName = path.basename(projectDir);

  const config = `export default {
  name: '${projectName}',
  version: '0.1.0',
  description: 'A Claude Code plugin',

  // Files to include in the container (glob patterns)
  include: [
    '**/*',
    '!node_modules/**',
    '!.git/**',
    '!dist/**',
  ],

  // Runtime configuration
  runtime: {
    port: 3000,
    timeout: 120000, // 2 minutes
  },
};
`;

  await fs.writeFile(configPath, config);
  console.log(`Created shipyard.config.ts`);

  // Add to .gitignore if needed
  await ensureGitignore(projectDir);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureGitignore(projectDir: string): Promise<void> {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const ignoreEntries = [
    '# Shipyard',
    '.shipyard/',
  ].join('\n');

  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.includes('.shipyard/')) {
      await fs.appendFile(gitignorePath, `\n${ignoreEntries}\n`);
    }
  } catch {
    // No .gitignore, create one
    await fs.writeFile(gitignorePath, `${ignoreEntries}\n`);
  }
}
```

### Task 3: CLI - Build Command
**Estimated effort: Medium**

Create `packages/cli/src/commands/build.ts`:

```typescript
import { execa } from 'execa';
import { promises as fs } from 'fs';
import path from 'path';

interface BuildOptions {
  tag?: string;
  push?: boolean;
  registry?: string;
}

export async function build(
  projectDir: string = process.cwd(),
  options: BuildOptions = {}
): Promise<string> {
  // Load config
  const config = await loadConfig(projectDir);

  // Generate Dockerfile
  const dockerfilePath = await generateDockerfile(projectDir, config);

  // Build image
  const tag = options.tag || `${config.name}:${config.version}`;

  console.log(`Building ${tag}...`);

  await execa('docker', [
    'build',
    '-t', tag,
    '-f', dockerfilePath,
    projectDir,
  ], { stdio: 'inherit' });

  console.log(`\nBuilt: ${tag}`);

  // Push if requested
  if (options.push && options.registry) {
    const remoteTag = `${options.registry}/${tag}`;
    await execa('docker', ['tag', tag, remoteTag]);
    await execa('docker', ['push', remoteTag], { stdio: 'inherit' });
    console.log(`Pushed: ${remoteTag}`);
    return remoteTag;
  }

  return tag;
}

async function loadConfig(projectDir: string): Promise<any> {
  const configPath = path.join(projectDir, 'shipyard.config.ts');

  // For MVP, just read and eval (proper implementation would use ts-node or esbuild)
  const content = await fs.readFile(configPath, 'utf-8');
  const match = content.match(/export default ({[\s\S]*});/);
  if (!match) throw new Error('Invalid config format');

  return eval(`(${match[1]})`);
}

async function generateDockerfile(projectDir: string, config: any): Promise<string> {
  const dockerfile = `FROM node:20-slim

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create runtime directory
WORKDIR /app/runtime

# Copy runtime (would be published to npm in real implementation)
# For now, assume it's built locally
COPY node_modules/@shipyard/container-runtime/dist ./dist
COPY node_modules/@shipyard/container-runtime/package.json ./

# Copy plugin files
WORKDIR /app/plugin
COPY . .

# Back to runtime
WORKDIR /app/runtime
EXPOSE ${config.runtime?.port || 3000}

ENV PORT=${config.runtime?.port || 3000}
ENV TIMEOUT=${config.runtime?.timeout || 120000}

CMD ["node", "dist/server.js"]
`;

  const dockerfilePath = path.join(projectDir, '.shipyard', 'Dockerfile');
  await fs.mkdir(path.dirname(dockerfilePath), { recursive: true });
  await fs.writeFile(dockerfilePath, dockerfile);

  return dockerfilePath;
}
```

### Task 4: CLI Entry Point
**Estimated effort: Small**

Create `packages/cli/src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './commands/init.js';
import { build } from './commands/build.js';

const program = new Command();

program
  .name('shipyard')
  .description('Deploy Claude Code projects as containers')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new Shipyard project')
  .action(async () => {
    await init();
  });

program
  .command('build')
  .description('Build Docker image')
  .option('-t, --tag <tag>', 'Image tag')
  .option('--push', 'Push to registry')
  .option('--registry <registry>', 'Container registry')
  .action(async (options) => {
    await build(process.cwd(), options);
  });

program.parse();
```

---

## Project Structure

```
claude-shipyard/
├── packages/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── commands/
│   │   │       ├── init.ts
│   │   │       └── build.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── container-runtime/
│       ├── src/
│       │   └── server.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
├── package.json           # Workspace root
├── tsconfig.base.json
└── IMPLEMENTATION-PLAN-1.md
```

---

## Dependencies

### `packages/cli/package.json`
```json
{
  "name": "@shipyard/cli",
  "version": "0.1.0",
  "bin": {
    "shipyard": "./dist/index.js"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "execa": "^8.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### `packages/container-runtime/package.json`
```json
{
  "name": "@shipyard/container-runtime",
  "version": "0.1.0",
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Testing Checklist

### Manual Testing (MVP)

1. **Container Runtime**
   - [ ] Starts and listens on port 3000
   - [ ] Accepts POST /execute with prompt
   - [ ] Writes files to temp workspace
   - [ ] Executes Claude Code successfully
   - [ ] Returns output as JSON
   - [ ] Cleans up temp workspace
   - [ ] Handles errors gracefully

2. **CLI Init**
   - [ ] Creates shipyard.config.ts
   - [ ] Doesn't overwrite existing config
   - [ ] Updates .gitignore

3. **CLI Build**
   - [ ] Generates Dockerfile
   - [ ] Builds Docker image
   - [ ] Tags correctly
   - [ ] Push works (optional)

4. **End-to-End**
   - [ ] `shipyard init` in sample project
   - [ ] `shipyard build` produces runnable image
   - [ ] Container responds to HTTP requests
   - [ ] Claude Code executes prompts correctly

---

## Success Criteria

1. Creator can containerize a Claude Code project in < 5 minutes
2. Consumer can run the container and call it via HTTP
3. Claude Code executes with full capabilities inside container
4. Works with any Claude Code project (no special structure required)

---

## Next Steps After MVP

Once this works reliably:

1. **Add WebSocket support** - For streaming responses
2. **Add health checks** - `/health` endpoint for orchestration
3. **Add thin client generation** - MCP proxy layer for "native feel"
4. **Add GitHub Actions workflow generation** - `shipyard deploy`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Claude Code CLI not available in container | Test early; may need to bundle differently |
| File system permissions in Docker | Run as non-root, test permission scenarios |
| Timeout handling | Implement proper process killing and cleanup |
| Memory limits | Document resource requirements, add config options |
