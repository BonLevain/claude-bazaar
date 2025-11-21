# @bazaar/cli

CLI tool for deploying Claude Code projects as containers.

## Installation

```bash
npm install
npm run build
npm link  # Makes 'bazaar' command available globally
```

## Commands

### `bazaar init`

Initialize a new Bazaar project in the current directory.

```bash
cd my-claude-project
bazaar init
```

Creates:
- `bazaar.config.ts` - Project configuration
- Updates `.gitignore` with `.bazaar/`

### `bazaar build`

Build a Docker image for your project.

```bash
bazaar build
bazaar build -t my-plugin:latest
bazaar build --push --registry docker.io/myuser
```

Options:
- `-t, --tag <tag>` - Image tag (default: `<name>:<version>` from config)
- `--push` - Push to registry after building
- `--registry <registry>` - Container registry URL

Creates:
- `.bazaar/Dockerfile` - Generated Dockerfile

## Configuration

### `bazaar.config.ts`

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
    '!.bazaar/**',
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
- `@bazaar/container-runtime` installed as a dependency

## Workflow

1. Create your Claude Code project with commands, agents, or hooks
2. Run `bazaar init` to create configuration
3. Run `bazaar build` to create Docker image
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
