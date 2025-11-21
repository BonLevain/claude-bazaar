# @shipyard/web-interface

Browser-based chat interface for Claude Shipyard projects.

## Features

- Clean chat UI with markdown rendering
- Project selector for multiple running containers
- File upload for context
- Slash command autocomplete
- Static file browser
- API key management in settings

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Architecture

The web interface is bundled into the CLI package and served via the `shipyard serve` command. It connects directly to project containers using the URLs provided via `--projects` flag.

### Runtime Configuration

When served via CLI, configuration is injected at runtime:

```javascript
window.__SHIPYARD_CONFIG__ = {
  projects: ['http://localhost:3000']
};
```

The `ProjectService` reads this config and fetches project info from each container's `/app/info` endpoint.

## Components

- **ProjectSelector** - Dropdown to switch between connected projects
- **ProjectService** - Manages project discovery and status checking
- **ProjectContext** - React context providing `apiCall()` and project state

## API Endpoints

The interface expects these endpoints from project containers:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/app/info` | GET | Project name, description, version |
| `/commands` | GET | Available slash commands |
| `/execute` | POST | Execute a prompt |
| `/static/files` | GET | List static files |
| `/filesystem` | GET | Download static files |

## Build Output

Production build outputs to `dist/` and is copied to `cli/web-ui/` during the CLI bundle process.
