# @shipyard/cli

CLI tool for deploying Claude Code projects as containers.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'shipyard' command available globally
```

## Commands

### `shipyard init`

Initialize a new Shipyard project in the current directory.

```bash
cd my-claude-project
shipyard init
```

Creates:
- `shipyard.config.ts` - Project configuration
- Updates `.gitignore` with `.shipyard/`

### `shipyard build`

Build a Docker image for your project.

```bash
shipyard build
shipyard build -t my-plugin:latest
shipyard build --push --registry docker.io/myuser
```

Options:
- `-t, --tag <tag>` - Image tag (default: `<name>:<version>` from config)
- `--push` - Push to registry after building
- `--registry <registry>` - Container registry URL

Creates:
- `.shipyard/Dockerfile` - Generated Dockerfile

## Configuration

### `shipyard.config.ts`

```typescript
export default {
  name: 'my-plugin',
  version: '0.1.0',
  description: 'A Claude Code plugin',

  // Files to include in the container
  include: [
    '**/*',
    '!node_modules/**',
    '!.git/**',
    '!dist/**',
    '!.shipyard/**',
  ],

  // Runtime configuration
  runtime: {
    port: 3000,
    timeout: 120000, // 2 minutes
  },
};
```

## Prerequisites

- Docker installed and running
- `@shipyard/container-runtime` installed as a dependency

## Workflow

1. Create your Claude Code project with commands, agents, or hooks
2. Run `shipyard init` to create configuration
3. Run `shipyard build` to create Docker image
4. Run the container:

```bash
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=xxx my-plugin:latest
```

5. Call your plugin:

```bash
curl http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"prompt": "your prompt here"}'
```
