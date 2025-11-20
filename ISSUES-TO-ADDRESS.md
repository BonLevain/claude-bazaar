# Issues to Address

Deferred issues to tackle in future iterations.

## File Writing Control in Containers

### Problem
When Claude Code runs in the container, it can write files to the filesystem. This creates several concerns:
1. **No isolation between users** - Different users/sessions may overwrite each other's files
2. **Uncontrolled write locations** - Files can be written anywhere Claude has permission
3. **No cleanup strategy** - Written files persist indefinitely

### Requirements

#### Per-User Workspace Isolation
- Each user/session must have their own isolated workspace directory
- Sessions should map to specific workspace folders (e.g., `/workspaces/{sessionId}/`)
- Prevent any writes outside the user's designated workspace

#### Controlled Output Folder
- All file writes must go to a specific, configurable directory within the workspace
- Claude Code should be configured to use this directory as its working directory
- Consider using chroot or similar sandboxing for enforcement

#### Configurable Behavior (Future)
Plugin creators should be able to configure write behavior:
- **Per-user isolation** (default) - Each user gets isolated workspace
- **Shared workspace** - All users share a workspace (for collaborative plugins)
- **Read-only** - No file writes allowed, return diffs only

### Implementation Considerations

1. **Session-to-Workspace Mapping**
   - SessionManager already creates workspaces, need to make them persistent per user
   - Add user/session validation to prevent unauthorized access
   - Implement secure mapping between authenticated users and workspace directories

2. **Workspace Lifecycle**
   - Define when workspaces are created/deleted
   - Consider storage limits per user
   - Implement cleanup policies (e.g., delete after 30 days inactive)

3. **Claude Code Configuration**
   - May need to pass `--cwd` or configure working directory
   - Investigate if Claude Code respects working directory restrictions
   - Consider Docker volume mounts for isolation

4. **Security**
   - Validate all file paths to prevent directory traversal
   - Consider running Claude Code with reduced permissions
   - Audit file operations for security review

### Priority
Medium - Current implementation works for single-user/demo scenarios but needs addressing before multi-user production use.

---

## Interactive Slash Commands Don't Work in Web UI

### Problem
Some Claude Code slash commands are interactive and require terminal UI (dropdowns, selections, confirmations). When run in headless mode via `-p`, they return empty results.

**Examples:**
- `/model` - Shows dropdown to select model, returns empty in headless mode
- `/clear` - Clears conversation, no output
- `/compact` - Interactive compaction, may not work properly

The web UI shows "Command completed with no output" for these commands.

### Considerations
1. **Which commands should be exposed?** - Not all commands make sense in a web context
2. **Filter command list** - CommandDiscovery could filter out interactive-only commands
3. **Alternative implementations** - Some commands could have web-specific versions (e.g., model selector as a settings dropdown)
4. **Documentation** - Clearly indicate which commands work in web interface

### Possible Solutions
- Maintain a whitelist/blacklist of commands for web interface
- Add metadata to commands indicating if they're web-compatible
- Implement web-native alternatives for common interactive commands
- Show helpful message when user tries an unsupported command

### Priority
Low - Cosmetic issue, doesn't break core functionality.

---

## Future Issues

(Add new issues below as they arise)
