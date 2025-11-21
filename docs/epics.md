# claude-shipyard - Epic Breakdown

**Author:** BMad
**Date:** 2025-11-21
**Project Level:** 3 (Platform)
**Target Scale:** Enterprise/Marketplace

---

## Overview

This document provides the complete epic and story breakdown for claude-shipyard, decomposing the requirements from the PRD into implementable stories.

**Living Document Notice:** This is the initial version created from PRD and Architecture documents. No UX Design available - stories focus on technical implementation.

---

## Functional Requirements Inventory

| FR | Description |
|----|-------------|
| FR1 | Creators can initialize plugin projects via CLI (`init` command) |
| FR2 | Creators can run plugins locally for development (`serve` command) |
| FR3 | Creators can build Docker images for production deployment (`build` command) |
| FR4 | System generates thin clients from full plugins (stubs for commands/agents/hooks) |
| FR5 | Container runtime executes headless Claude Code with full plugin |
| FR6 | System streams responses via SSE to clients |
| FR7 | Workspace manager handles temporary file creation/cleanup |
| FR8 | MCP proxy server routes requests to plugin components |
| FR9 | Users can access plugins via web interface (browser-based chat UI) |
| FR10 | System validates plugin structure before deployment |
| FR11 | Creators can publish plugins to marketplace (`publish` command) |
| FR12 | System authenticates users via API keys |
| FR13 | System checks subscription status before execution |
| FR14 | System rate limits requests per user/plugin |
| FR15 | System tracks usage for billing |
| FR16 | Creators can connect Stripe accounts for revenue |
| FR17 | System splits revenue 80/20 (creator/platform) |
| FR18 | Users can subscribe to plugins via Stripe checkout |
| FR19 | GitHub App clones creator repos for marketplace deployment |
| FR20 | System deploys containers to ECS for marketplace plugins |

---

## FR Coverage Map

| FR | Epic(s) | Stories |
|----|---------|---------|
| FR1 | Epic 1 | 1.x |
| FR2 | Epic 2 | 2.x |
| FR3 | Epic 5 | 5.x |
| FR4 | Epic 2 | 2.x |
| FR5 | Epic 2 | 2.x |
| FR6 | Epic 2 | 2.x |
| FR7 | Epic 2 | 2.x |
| FR8 | Epic 8 | 8.x |
| FR9 | Epic 3 | 3.x |
| FR10 | Epic 1 | 1.x |
| FR11 | Epic 6 | 6.x |
| FR12 | Epic 6 | 6.x |
| FR13 | Epic 6 | 6.x |
| FR14 | Epic 6 | 6.x |
| FR15 | Epic 7 | 7.x |
| FR16 | Epic 7 | 7.x |
| FR17 | Epic 7 | 7.x |
| FR18 | Epic 7 | 7.x |
| FR19 | Epic 6 | 6.x |
| FR20 | Epic 8 | 8.x |
| FR21 | Epic 4 | 4.1, 4.4 |
| FR22 | Epic 4 | 4.2, 4.4 |
| FR23 | Epic 4 | 4.3, 4.5 |
| FR24 | Epic 4 | 4.6 |

---

## Epic 1: Foundation & CLI Core

*Completed - stories implemented*

---

## Epic 2: Container Runtime & Local Development

*Completed - stories implemented*

---

## Epic 3: Web Interface Access

*Completed - stories implemented*

---

## Epic 4: Container Configuration & Customization

**Goal:** Enable flexible container runtime configuration and static file serving

**FR Coverage:** FR21 (runtime selection), FR22 (dependencies), FR23 (static files), FR24 (static auth)

### Story 4.1: Runtime Selection in Init Command

As a **plugin creator**,
I want to select my preferred Docker runtime during initialization,
So that I can use Python, Node, or any custom image for my plugin.

**Acceptance Criteria:**

**Given** I run `claude-shipyard init`
**When** the CLI reaches runtime configuration
**Then** I see options: "Node.js (default)", "Python", "Custom Docker image"

**And** if I select "Node.js", the config sets `runtime: "node:20-slim"`
**And** if I select "Python", the config sets `runtime: "python:3.11-slim"`
**And** if I select "Custom", I'm prompted for the full image name

**And** the selection is saved to `shipyard.config.ts` under `server.runtime`

**Prerequisites:** Epic 1 (init command exists)

**Technical Notes:**
- Update `src/commands/init.ts` to add runtime prompts
- Add runtime field to `ShipyardConfig` schema in `packages/core`
- Validate custom images follow Docker image naming conventions

---

### Story 4.2: Dependency File Configuration

As a **plugin creator**,
I want to specify dependency files during initialization,
So that my Python requirements or other dependencies are installed in the container.

**Acceptance Criteria:**

**Given** I selected Python runtime
**When** the CLI asks about dependencies
**Then** I can specify path to `requirements.txt` (default: `./requirements.txt`)

**Given** I selected Node runtime
**When** the CLI asks about dependencies
**Then** it auto-detects `package.json` in plugin directory

**Given** I selected custom runtime
**When** the CLI asks about dependencies
**Then** I can specify any dependency file path and install command

**And** configuration is saved to `shipyard.config.ts` under `server.dependencies`

**Prerequisites:** Story 4.1

**Technical Notes:**
- Add dependency configuration to init flow
- Support multiple dependency files if needed
- Validate file exists before saving config

---

### Story 4.3: Static File Folder Configuration

As a **plugin creator**,
I want to specify folders to serve as static files,
So that I can serve assets, documentation, or UI files from my container.

**Acceptance Criteria:**

**Given** I run `claude-shipyard init`
**When** the CLI reaches static file configuration
**Then** I'm asked "Do you want to serve static files? (y/n)"

**Given** I answer yes
**When** prompted for folders
**Then** I can specify one or more folder paths (e.g., `./public`, `./docs`)

**And** I can specify URL paths for each folder (e.g., `/static`, `/docs`)

**And** configuration is saved to `shipyard.config.ts` under `staticFiles`

**Prerequisites:** Story 4.1

**Technical Notes:**
- Validate folders exist in project directory
- Warn if folders are empty
- Support glob patterns for file filtering (optional)

---

### Story 4.4: Dockerfile Generation with Runtime Support

As a **plugin creator**,
I want the build process to generate a Dockerfile matching my runtime,
So that my dependencies are properly installed in the container.

**Acceptance Criteria:**

**Given** config has `runtime: "python:3.11-slim"` and `dependencies.file: "requirements.txt"`
**When** I run `claude-shipyard build`
**Then** generated Dockerfile includes Python base image and pip install

**Given** config has `runtime: "node:20-slim"` and `package.json` exists
**When** I run `claude-shipyard build`
**Then** generated Dockerfile includes Node base image and npm ci

**And** Claude Code is always installed regardless of runtime

**Prerequisites:** Stories 4.1, 4.2

**Technical Notes:**
- Update `packages/deployment/src/docker/DockerBuilder.ts`
- Create template fragments for each supported runtime
- Ensure Claude Code works on all base images (may need Node.js installed)

---

### Story 4.5: Nginx Configuration for Static Files

As a **plugin creator**,
I want nginx to serve my static folders,
So that static assets are served efficiently without hitting the application server.

**Acceptance Criteria:**

**Given** config has `staticFiles` configured
**When** I run `claude-shipyard build`
**Then** an `nginx.conf` is generated with location blocks for each static folder

**And** Dockerfile includes nginx installation and configuration

**And** nginx reverse proxies non-static requests to the application

**And** container exposes port 80 (nginx) instead of 3000

**Prerequisites:** Story 4.3

**Technical Notes:**
- Generate nginx.conf dynamically from config
- Use supervisor or similar to run both nginx and app
- Consider using nginx-unprivileged for security

---

### Story 4.6: API Key Authentication for Static Files

As a **plugin creator**,
I want static file access to be protected by API key,
So that only authenticated users can access my static assets.

**Acceptance Criteria:**

**Given** static files are configured
**When** a request comes to static file URLs
**Then** nginx validates the `Authorization: Bearer <key>` header

**Given** valid API key in Authorization header
**When** requesting static file
**Then** file is served with 200 OK

**Given** missing or invalid API key
**When** requesting static file
**Then** returns 401 Unauthorized

**Given** `ANTHROPIC_API_KEY` is set in container environment
**When** auth is configured for "local" mode
**Then** that key is accepted for static file access

**Prerequisites:** Story 4.5

**Technical Notes:**
- Use nginx `auth_request` directive
- Create lightweight auth endpoint in container runtime
- Support both local API key and remote auth service
- Add `staticAuth` config option: `"local" | "shipyard" | "none"`

---

