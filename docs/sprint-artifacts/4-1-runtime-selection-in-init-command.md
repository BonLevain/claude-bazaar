# Story 4.1: Runtime Selection in Init Command

Status: review

## Story

As a **plugin creator**,
I want to select my preferred Docker runtime during initialization,
so that I can use Python, Node, or any custom image for my plugin.

## Acceptance Criteria

1. **AC1**: When running `claude-bazaar init`, CLI presents runtime options: "Node.js (default)", "Python", "Custom Docker image"
2. **AC2**: Selecting "Node.js" sets config `runtime: "node:20-slim"`
3. **AC3**: Selecting "Python" sets config `runtime: "python:3.11-slim"`
4. **AC4**: Selecting "Custom" prompts for full Docker image name (e.g., `mcr.microsoft.com/dotnet/sdk:8.0`)
5. **AC5**: Custom image names are validated against Docker image naming conventions
6. **AC6**: Selection is saved to `bazaar.config.ts` under `server.runtime`

## Tasks / Subtasks

- [ ] Task 1: Add runtime field to BazaarConfig schema (AC: 6)
  - [ ] 1.1: Update `packages/core/src/config/ConfigSchema.ts` with runtime field
  - [ ] 1.2: Add TypeScript types for runtime configuration
  - [ ] 1.3: Set default value to `node:20-slim`

- [ ] Task 2: Create runtime selection UI component (AC: 1)
  - [ ] 2.1: Create `RuntimeSelector.tsx` in `src/ui/`
  - [ ] 2.2: Add three options: Node.js, Python, Custom
  - [ ] 2.3: Handle custom input with text field

- [ ] Task 3: Add Docker image name validation (AC: 5)
  - [ ] 3.1: Create validation function for Docker image naming
  - [ ] 3.2: Regex pattern: `^[a-z0-9]+([._-][a-z0-9]+)*(/[a-z0-9]+([._-][a-z0-9]+)*)*(:[\w][\w.-]{0,127})?$`
  - [ ] 3.3: Show error message for invalid names

- [ ] Task 4: Integrate runtime prompts into init command (AC: 1, 2, 3, 4)
  - [ ] 4.1: Update `src/commands/init.ts` to include runtime prompts
  - [ ] 4.2: Map UI selection to config values
  - [ ] 4.3: Handle user selection flow

- [ ] Task 5: Save runtime to config file (AC: 6)
  - [ ] 5.1: Update config generation in init command
  - [ ] 5.2: Ensure `server.runtime` is written to `bazaar.config.ts`

- [ ] Task 6: Write tests (All ACs)
  - [ ] 6.1: Unit test for Docker image name validation
  - [ ] 6.2: Integration test for init command with runtime selection
  - [ ] 6.3: Test all three runtime options produce correct config

## Dev Notes

### Architecture Patterns

- Use Ink (React-based terminal UI) for runtime selection component
- Follow existing UI patterns in `src/ui/` (SelectList, TextInput)
- Config schema uses Zod for validation [Source: CLAUDE.md#Technology-Stack]

### Source Tree Components

```
packages/
├── cli/
│   └── src/
│       ├── commands/
│       │   └── init.ts          # MODIFY: Add runtime prompts
│       └── ui/
│           └── RuntimeSelector.tsx  # NEW: Runtime selection component
└── core/
    └── src/
        └── config/
            └── ConfigSchema.ts  # MODIFY: Add runtime field
```

### Testing Standards

- Use Vitest for tests [Source: CLAUDE.md#Testing-Strategy]
- Focus on integration tests for init command flow
- Unit tests for validation functions

### Project Structure Notes

- Follows monorepo pattern with `packages/` directory
- CLI package handles user interaction
- Core package handles shared types and validation

### References

- [Source: CLAUDE.md#CLI-Commands] - Init command specification
- [Source: CLAUDE.md#Configuration] - Config file structure
- [Source: CLAUDE.md#UI-Components] - Ink UI patterns
- [Source: docs/epics.md#Story-4.1] - Original story requirements

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

- **MODIFIED**: `packages/cli/src/types.ts` - Added `image` field to RuntimeConfig, added RUNTIME_PRESETS
- **MODIFIED**: `packages/cli/src/commands/init.ts` - Added runtime selection prompts, Docker image validation

## Change Log

- 2025-11-21: Story drafted from epics.md requirements
