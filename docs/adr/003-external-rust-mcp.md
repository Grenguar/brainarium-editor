# ADR-003: Separate, capability-scoped Brainarium MCP

Status: accepted, 2026-08-25.

## Context

The vault owner wants Claude Desktop and Claude Code to read and, when explicitly authorized, write the same folder that Brainarium opens. The Electron renderer cannot become a general filesystem API, and the built-in Codex flow remains proposal-only.

## Decision

Ship `brainarium-mcp` as an independent Rust stdio process. Its external launch configuration uses `BRAINARIUM_VAULT` to name one active vault and `BRAINARIUM_MCP_ALLOW_WRITE=true` to grant direct write authority. Changing the selected vault means starting a new process with a new explicit configuration. The MCP does not accept arbitrary vault roots from clients and does not expose configuration mutation as a tool.

The service accepts only normalized relative paths to supported, non-hidden UTF-8 documents. Reads return a SHA-256 version. Existing-file writes require that version, recheck it under a vault capability, write a same-directory temporary file, and atomically rename it. Markdown writes rebuild the shared Rust graph cache. The initial tool surface omits delete, rename, shell, network, direct cache mutation, and arbitrary-root operations.

## Consequences

- Claude Desktop and Claude Code can share a generic local vault connector without Electron running.
- Direct MCP write authority is a deliberate opt-in, separate from Brainarium's proposal-only built-in Codex policy.
- Vault configuration is central rather than proprietary content inside each vault; Docker is an isolated fixed-vault launch mode, while native/uv launches are the mode that can follow a changed selected vault.
- The server must maintain strict path, symlink, size, rate, and stdout/stderr protocol boundaries, plus direct protocol and conflict tests.
