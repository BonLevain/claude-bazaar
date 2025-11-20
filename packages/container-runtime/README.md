# @shipyard/container-runtime

HTTP server runtime for headless Claude Code containers.

## Installation

```bash
npm install
npm run build
```

## Usage

### Running locally

```bash
PORT=3000 node dist/index.js
```

### Environment variables

- `PORT` - Server port (default: 3000)
- `TIMEOUT` - Execution timeout in ms (default: 120000)
- `PLUGIN_DIR` - Path to plugin files (default: /app/plugin)
- `WORKSPACE_DIR` - Temp workspace directory (default: /tmp/shipyard)
- `ANTHROPIC_API_KEY` - Required for Claude Code

## API

### GET /health

Health check endpoint.

### POST /execute

Execute a prompt and return the result.

```bash
curl http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Read test.js and explain it",
    "files": [{"path": "test.js", "content": "console.log(\"hello\")"}]
  }'
```

### POST /execute/stream

Execute with Server-Sent Events streaming.

```bash
curl -N http://localhost:3000/execute/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'
```

## Docker

```bash
docker build -t shipyard-runtime .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=xxx shipyard-runtime
```
