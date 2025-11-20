# @shipyard/web-interface

Browser-based chat interface for Shipyard plugins.

## Features

- Chat-style UI with streaming responses
- File upload for context
- Markdown rendering
- Connects to container-runtime `/execute` endpoint

## Development

```bash
# Install dependencies
npm install

# Start dev server (assumes container-runtime running on port 3000)
npm run dev

# Build for production
npm run build
```

## Usage

1. Start your container-runtime on port 3000
2. Run `npm run dev`
3. Open http://localhost:5173

The Vite dev server proxies `/api/*` requests to `http://localhost:3000`.

## Environment

For production, configure the API endpoint via environment variables or update the fetch URL in `App.tsx`.
