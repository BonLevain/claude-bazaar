<div align="center">

# Claude Bazaar

### 🚀 Share and Monetize your Claude Code Projects 💰

⚠️ **PRE-ALPHA SOFTWARE** ⚠️

This project is in early development and intended for testing purposes only. Use caution when running in production environments.

</div>

---

You built something cool with Claude Code. Now everyone's asking: "Can I use that?"

**That's why we built Bazaar.**

One command to package, ship, and monitize your project with a slick web interface. Done. Your coworker, your subscribers, your investor, your mom—anyone can use it. No terminal required on their end.

And yeah, you can charge for it too. But we'll get to that.

---

## Who Is This For?

- **Creators** like YouTubers and influencers building useful projects their subscribers want to pay to use
- **Founders** who built a prototype in Claude Code and want to share it with investors or early users
- **Enterprise teams** who created internal tools and need to distribute them to colleagues
- **Developers** who want to monetize their Claude Code creations without building infrastructure
- **Anyone** who wants to turn their Claude Code project into a product

---

## Quick Start

### 1. Install Claude Bazaar

```bash
npm install -g @claude-bazaar/cli
```

### 2. Initialize Your Project

Navigate to your Claude Code project directory and run:

```bash
claude-bazaar init
```

This creates a `claude-bazaar.config.json` file with your project settings.

### 3. Build Your Container

```bash
claude-bazaar build
```

This packages your project into a Docker container with everything it needs to run.

### 4. Run Your Project

```bash
claude-bazaar run
```

Your project is now running on in a container at `http://localhost:3000`.

### 5. Launch the Web Interface

```bash
claude-bazaar serve
```

Open `http://localhost:5173` in your browser. You now have a beautiful chat interface connected to your project!

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Claude    │     │   Docker        │     │   Web           │
│  Code Project   │ ──► │   Container     │ ◄── │   Interface     │
│                 │     │   (Port 3000)   │     │   (Port 5173)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Your Project** - The Claude Code project you've already built (with `CLAUDE.md`, commands, etc.)
2. **Container** - A self-contained package with Claude Code CLI, your project files, and a runtime server
3. **Web Interface** - A polished chat UI that connects to your container

---

## Configuration

Your `claude-bazaar.config.json` file controls how your project is packaged:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "description": "A helpful assistant built with Claude Code",
  "include": ["."],
  "runtime": {
    "port": 3000,
    "timeout": 120000,
    "image": "nikolaik/python-nodejs:python3.11-nodejs20"
  },
  "dependencies": {
    "python": "./requirements.txt",
    "node": "./package.json"
  },
  "staticFiles": [
    {
      "folder": "./outputs",
      "urlPath": "/files"
    }
  ]
}
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `name` | Your project name (used for Docker image tagging) |
| `version` | Semantic version of your project |
| `description` | Brief description shown in the web interface |
| `include` | Files/folders to include in the container |
| `runtime.port` | Port the container listens on (default: 3000) |
| `runtime.timeout` | Max execution time in ms (default: 120000) |
| `runtime.image` | Base Docker image |
| `dependencies.python` | Path to requirements.txt for Python deps |
| `dependencies.node` | Path to package.json for Node.js deps |
| `staticFiles` | Folders to serve as downloadable files |

---

## CLI Commands

### `claude-bazaar init`

Interactive setup that creates your configuration file.

### `claude-bazaar build`

Build a Docker image from your project.

```bash
claude-bazaar build                    # Use config defaults
claude-bazaar build -t myapp:v1        # Custom tag
claude-bazaar build --push --registry  # Push to registry
```

### `claude-bazaar run`

Run your containerized project.

```bash
claude-bazaar run                      # Default port from config
claude-bazaar run -p 3001              # Custom port
claude-bazaar run -d                   # Run in background
```

### `claude-bazaar serve`

Start the web interface.

```bash
claude-bazaar serve                                    # Default: localhost:3000
claude-bazaar serve --projects http://localhost:3001   # Custom project URL
claude-bazaar serve -p 8080                            # Custom UI port
```

#### Multiple Projects

Connect to multiple running projects:

```bash
claude-bazaar serve --projects http://localhost:3000,http://localhost:3001
```

The web interface will show a dropdown to switch between them.

---

## Environment Variables

When your project runs inside the container, these environment variables are available:

| Variable | Description |
|----------|-------------|
| `PORT` | Port the server listens on |
| `TIMEOUT` | Max execution time in milliseconds |
| `PLUGIN_DIR` | Path to your project files inside the container |

---

## Authentication

The web interface supports API key authentication. Users enter their Anthropic API key in Settings, and it's passed to Claude Code when executing commands.

For production deployments, you can also set `ANTHROPIC_API_KEY` as an environment variable in your container.

---

## Permissions

The container runtime runs Claude Code with `--dangerously-skip-permissions`, giving it full access to all tools (Bash, Read, Write, Edit, etc.) without requiring user approval. This is appropriate for containerized environments where Claude operates autonomously.

**Security Note:** Because Claude has full tool permissions inside the container, ensure your container is properly isolated and only trusted prompts are executed.

**Future Work:** We plan to implement sandboxing for multi-tenant environments, providing stronger isolation between user sessions.

--

## Roadmap

[] Chat History
[] Sandboxing
[] User Authentication
[] Monetization
[] Cloud deployment cli cmds

---

## Troubleshooting

### Container won't start

- Check Docker is running: `docker ps`
- Check port isn't in use: `lsof -i :3000`
- View logs: `docker logs <container-id>`

### Web interface can't connect

- Ensure the container is running on the expected port
- Check browser console for CORS errors
- Verify the project URL in `--projects` flag

### Build fails

- Ensure all files in `include` exist
- Check Docker has enough disk space
- Verify base image is accessible

---

## Contributing

We welcome contributions! Here's how to get started:

### Setup

```bash
# Clone the repository
git clone https://github.com/BonLevain/claude-bazaar.git
cd claude-bazaar

# Install dependencies for all packages
cd packages/cli && npm install
cd ../web-interface && npm install
cd ../container-runtime && npm install

# Build everything
cd ../cli
npm run build
npm run bundle
```

### Development

```bash
# Link CLI for local testing
cd packages/cli
npm link

# Run web interface in dev mode
cd ../web-interface
VITE_BAZAAR_PROJECTS="http://localhost:3000" npm run dev
```

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run builds to verify: `npm run build`
5. Submit a pull request

---

## Releasing

### Version Scheme

We use semantic versioning with pre-release tags:
- **Alpha**: `0.1.0-alpha.1` → `0.1.0-alpha.2` (current stage)
- **Beta**: `0.1.0-beta.1` → `0.1.0-beta.2`
- **Stable**: `0.1.0` → `0.1.1` → `0.2.0`

### Manual Release Process

1. **Update versions** in all package.json files:
   - `packages/cli/package.json`
   - `packages/container-runtime/package.json`
   - `packages/web-interface/package.json`

2. **Commit version bump**:
   ```bash
   git add -A
   git commit -m "chore: bump version to 0.1.0-alpha.2"
   ```

3. **Create and push tag**:
   ```bash
   git tag v0.1.0-alpha.2
   git push origin main --tags
   ```

4. **GitHub Actions** will automatically:
   - Build all packages
   - Publish `@claude-bazaar/cli` to npm
   - Create a GitHub Release

### Manual npm Publish (if needed)

```bash
cd packages/cli
npm run build
npm run bundle
npm publish --access public
```

### Required Secrets

Add these to your GitHub repository secrets:
- `NPM_TOKEN`: npm access token with publish permissions

---

## License

Business Source License 1.1 (BSL)

You can use Claude Bazaar to build and deploy your own projects—that's the whole point! The license only restricts building a competing hosted marketplace or adding your own monetization features to offer a competing commercial service.

See [LICENSE.md](LICENSE.md) for details.

---

## Learn More

Claude Bazaar builds on Claude Code's powerful plugin system. To learn more about what you can build:

- [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins)
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)



---

**Built with love for the Claude Code community.**
