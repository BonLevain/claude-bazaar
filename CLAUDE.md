# Claude Shipyard

A CLI tool for sharing and monetizing Claude Code projects with authentication, user management, and payment workflows.

## Project Overview

Claude Shipyard enables non-technical Claude Code users to deploy their projects as accessible API/websocket services. The CLI generates deployment configurations (GitHub Actions) that ship Claude Code projects to cloud platforms with built-in auth and billing infrastructure.

### Core Value Proposition
- **Creators**: Package and monetize Claude Code projects without DevOps knowledge
- **Consumers**: Access Claude Code projects via API/websocket endpoints with subscription-based billing

## Architecture

### CLI Tool (This Repository)
- Generates deployment artifacts (GitHub Actions workflow)
- Collects configuration via interactive prompts
- Manages platform-specific deployment strategies

### Deployment Flow
1. User runs `claude-shipyard init` in project root
2. CLI generates `.claude-shipyard/config.ts` and `.github/workflows/shipyard-deploy.yml`
3. User commits and pushes to GitHub
4. GitHub Action deploys to AWS ECS
5. Service runs API/websocket server that triggers Claude Code and returns results

### Future Components (Separate Services)
- Authentication & user management API
- Billing/subscription management (Stripe)
- Marketplace/discovery

## Technology Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Package Manager**: npm
- **Testing**: Vitest (integration tests on main flows)
- **Distribution**: npm package (`claude-shipyard`)
- **CLI UI**: Ink (React-based terminal UI)

### Deployment Platform (Initial)
- **CI/CD**: GitHub Actions
- **Container Orchestration**: AWS ECS
- **Future**: Additional platforms via strategy pattern

## Development Principles

### Code Organization
- **DRY** (Don't Repeat Yourself): Extract common logic into reusable modules
- **YAGNI** (You Aren't Gonna Need It): Only implement features when needed, not speculatively
- **OOP in TypeScript**: Use classes, interfaces, and design patterns appropriately

### Design Patterns

#### Strategy Pattern (Required)
Use for platform-specific implementations:
```typescript
// Deployment strategies
interface DeploymentStrategy {
  generateWorkflow(): string;
  getRequiredSecrets(): string[];
  promptForConfig(): Promise<PlatformConfig>;
}

class AWSDeploymentStrategy implements DeploymentStrategy { }
class GCPDeploymentStrategy implements DeploymentStrategy { }  // Future
class AzureDeploymentStrategy implements DeploymentStrategy { } // Future
```

#### Other Patterns to Consider
- **Factory**: For creating strategy instances
- **Builder**: For complex configuration objects
- **Template Method**: For shared deployment workflow steps

### Code Style
- Prefer composition over inheritance
- Use dependency injection for testability
- Keep functions small and single-purpose
- Use meaningful, descriptive names
- No abbreviations unless universally understood

## Project Structure

```
claude-shipyard/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   └── init.ts           # Init command implementation
│   ├── ui/                   # Ink UI components (React TSX)
│   │   ├── index.ts          # UI exports
│   │   ├── SelectList.tsx    # Selectable bulleted list
│   │   ├── TextInput.tsx     # Text input prompt
│   │   └── PasswordInput.tsx # Masked password input
│   ├── strategies/
│   │   ├── DeploymentStrategy.ts  # Strategy interface
│   │   └── aws/
│   │       └── AWSDeploymentStrategy.ts
│   ├── config/
│   │   └── ConfigManager.ts  # Config file management
│   └── types/
│       └── index.ts          # Shared type definitions
├── templates/
├── tests/
│   └── integration/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── CLAUDE.md
```

### UI Components (`src/ui/`)

All terminal UI elements are built with Ink (React for CLI). Keep UI logic separate from business logic.

- **SelectList**: Arrow-key navigable bulleted list for choices
- **TextInput**: Single-line text input with validation
- **PasswordInput**: Masked input for secrets

Usage:
```typescript
import { selectList, textInput, passwordInput } from './ui/index.js';

// Select from list
const choice = await selectList('Pick one:', [
  { label: 'Option A', value: 'a' },
  { label: 'Option B', value: 'b' }
]);

// Text input with validation
const name = await textInput('Project name:', {
  defaultValue: 'my-project',
  validate: (v) => v.length > 0 ? true : 'Required'
});

// Password input
const secret = await passwordInput('API key:');
```

## CLI Commands

### `claude-shipyard init`
Interactive initialization that generates all deployment artifacts.

**Prompts for:**
- Project name
- Deployment trigger (push to main / manual)
- Platform selection (AWS initially)
- Platform-specific config (AWS region, etc.)
- AWS credentials (stored as GitHub secrets)

**Generates:**
- `.claude-shipyard/config.ts` - Project configuration (committed to repo)
- `.github/workflows/shipyard-deploy.yml` - Deployment workflow

### `claude-shipyard --help`
Display help information.

## Configuration

### Project Config (`.claude-shipyard/config.ts`)
```typescript
export default {
  projectName: 'my-claude-project',
  deployment: {
    trigger: 'push' | 'manual',
    platform: 'aws',
    aws: {
      region: 'us-east-1',
      // Other AWS-specific config
    }
  }
};
```

### Environment Variables (Injected at Runtime)
Convention for auth/billing env vars:
```
SHIPYARD_AUTH_ENDPOINT=https://auth.claude-shipyard.com
SHIPYARD_AUTH_API_KEY=xxx
SHIPYARD_BILLING_ENDPOINT=https://billing.claude-shipyard.com
SHIPYARD_BILLING_API_KEY=xxx
SHIPYARD_USER_ID=xxx
SHIPYARD_SUBSCRIPTION_TIER=xxx
```

### GitHub Secrets (Set via CLI)
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
ANTHROPIC_API_KEY (user's Claude Code auth)
```

## Testing Strategy

- **Integration tests only** on main flows
- Test runner: Vitest
- Focus on:
  - Init command generates correct files
  - Strategy pattern produces valid platform configs
  - Generated GitHub Action is valid YAML

## Versioning

Semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes to CLI interface or config format
- **MINOR**: New features, new platform support
- **PATCH**: Bug fixes

## Future Roadmap

### Phase 1 (Current)
- [x] Basic CLI structure
- [ ] Init command with interactive prompts
- [ ] AWS ECS deployment strategy
- [ ] GitHub Actions workflow generation

### Phase 2
- [ ] Additional cloud platforms (GCP, Azure)
- [ ] Project validation before deployment

### Phase 3
- [ ] Authentication integration
- [ ] Billing/subscription integration
- [ ] Marketplace API integration

## Development Setup

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build
npm run build

# Test
npm run test

# Link locally for testing
npm link
```

## Contributing

1. Follow the development principles outlined above
2. Write integration tests for new features
3. Use conventional commits
4. Update this CLAUDE.md if adding new patterns or architecture decisions
