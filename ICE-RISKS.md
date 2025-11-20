# ICE Risk Analysis

Risk assessment for Claude Shipyard open-source headless Claude Code deployment.

**ICE Score** = Impact × Certainty × Ease-to-mitigate (higher = more critical to address)

## Risk Rankings

| Rank | Risk | Impact | Certainty | Ease | ICE Score | Status |
|------|------|--------|-----------|------|-----------|--------|
| 1 | Over-engineering Before Validation | 8 | 9 | 7 | 504 | Mitigated |
| 2 | Thin Client Generation Accuracy | 8 | 7 | 5 | 280 | Deferred |
| 3 | Container Runtime Stability | 9 | 7 | 4 | 252 | In Progress |
| 4 | MCP Proxy Complexity | 9 | 8 | 3 | 216 | Deferred |
| 5 | Claude Code API Stability | 7 | 6 | 2 | 84 | Monitoring |

## Risk Details

### 1. Over-engineering Before Validation (ICE: 504)

**Risk**: Building marketplace, billing, and thin client infrastructure before validating core value proposition.

**Impact**: 8 - Wasted development time, delayed time-to-value
**Certainty**: 9 - Very likely without discipline
**Ease**: 7 - Easy to mitigate by cutting scope

**Mitigation**:
- ✅ Created stripped-down MVP plan (IMPLEMENTATION-PLAN-1.md)
- ✅ Deferred thin clients, MCP proxy, marketplace to later phases
- Focus on: container runtime → CLI build → direct HTTP calls

### 2. Thin Client Generation Accuracy (ICE: 280)

**Risk**: Generated thin clients don't perfectly mirror original plugin interface, breaking UX.

**Impact**: 8 - Core "native feel" promise broken
**Certainty**: 7 - Likely given complexity of Claude Code features
**Ease**: 5 - Moderate; requires thorough testing

**Mitigation** (deferred):
- Test with diverse real-world plugins
- Build comprehensive stub generation for commands/agents/hooks
- Create validation suite comparing original vs thin client behavior

### 3. Container Runtime Stability (ICE: 252)

**Risk**: Headless Claude Code in Docker is flaky, unreliable, or has edge cases.

**Impact**: 9 - Core value prop fails if this doesn't work
**Certainty**: 7 - Likely some issues will arise
**Ease**: 4 - Hard; depends on Claude Code internals

**Mitigation** (in progress):
- ✅ Built basic container runtime with proper error handling
- ✅ Added timeout management and cleanup
- TODO: Test with various prompt types and file operations
- TODO: Monitor Claude Code CLI updates for breaking changes

### 4. MCP Proxy Complexity (ICE: 216)

**Risk**: Proxying commands/agents/hooks through single MCP endpoint is technically difficult and may not feel native.

**Impact**: 9 - Entire marketplace UX depends on this
**Certainty**: 8 - High; this is uncharted territory
**Ease**: 3 - Hard; complex architecture

**Mitigation** (deferred):
- Prototype with simple commands first
- Gradually add agents, hooks, MCP server proxying
- User testing to validate "native feel"

### 5. Claude Code API Stability (ICE: 84)

**Risk**: Anthropic changes Claude Code CLI internals, breaking container runtime.

**Impact**: 7 - Would require updates but not architectural changes
**Certainty**: 6 - Possible; Claude Code is evolving
**Ease**: 2 - Hard; outside our control

**Mitigation**:
- Pin Claude Code version in Dockerfile
- Monitor Claude Code releases and changelogs
- Abstract Claude Code interaction in `ClaudeExecutor` class for easier updates

## Decision: MVP Approach

Based on ICE analysis, the fastest path to value is:

1. **Container Runtime only** - Docker image running Claude Code with HTTP API
2. **Simple CLI** - `shipyard build` → Docker image
3. **Skip thin clients** - Users call containers directly via HTTP

This validates the core proposition (can we run Claude Code headless and call it remotely?) before investing in marketplace infrastructure.

## Review Schedule

- **Weekly**: Review container runtime stability issues
- **Monthly**: Reassess deferred risks as MVP matures
- **Per Release**: Update this document with new risks and mitigations
