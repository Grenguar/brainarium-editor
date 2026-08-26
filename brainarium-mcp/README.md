# Brainarium MCP

`brainarium-mcp` is a local, stdio Model Context Protocol server written in Rust. One process serves exactly one configured Brainarium vault. It exposes raw source operations for Brainarium's supported text formats only:

- Markdown (`.md`)
- CSV (`.csv`)
- Plain text (`.txt`)
- JSON (`.json`)
- XML (`.xml`)
- HTML (`.html`)

The server never renders, reformats, or interprets document contents. `write_file` replaces the raw UTF-8 source atomically and is disabled until explicitly enabled.

It does **not** require Brainarium/Electron to be running. The MCP reads and writes its explicitly configured vault directly and rebuilds the local Markdown graph cache after a successful Markdown write.

## Safety boundary

- `BRAINARIUM_VAULT` is canonicalized at startup and is the only accessible root.
- Tool paths must be clean, non-hidden relative paths. Absolute paths, `..`, hidden paths (including `.brainarium`), and all symlinks are rejected.
- File listing follows neither symlinks nor hidden directories.
- Only the six supported text extensions can be read or written.
- The maximum source size defaults to 5 MiB and is capped at 64 MiB.
- `create_directory` and `write_file` are disabled unless `BRAINARIUM_MCP_ALLOW_WRITE=true`. `create_directory` creates a requested, non-hidden relative folder tree idempotently. `write_file` can create a new supported file in missing parent folders only when its `createParents` argument is `true`; otherwise it explains that the parent is absent. Replacing an existing file still requires the SHA-256 `version` returned by `read_file`, so stale Claude/Desktop/Code context fails rather than overwriting newer source. Markdown writes rebuild Brainarium's local `.brainarium/graph-v1.json` cache; the receipt reports whether that rebuild completed.
- `vault_graph` and `file_connections` return resolved Markdown graph data built directly from source. They do not read or mutate `.brainarium/graph-v1.json`.

The current tool set is intentionally small:

| Tool | Purpose |
| --- | --- |
| `vault_status` | Confirm the vault boundary, supported extensions, source limit, and write state. |
| `list_files` | List visible supported files, optionally under a vault-relative folder. |
| `read_file` | Read exact UTF-8 source for one supported file. |
| `create_directory` | Idempotently create a validated non-hidden vault-relative folder tree when write access is enabled. |
| `write_file` | Atomically create or replace one supported file; `createParents: true` creates missing validated parents. |
| `vault_graph` | Read the deterministic, source-derived global Markdown graph. |
| `file_connections` | Read the resolved incoming and outgoing graph links for one Markdown file. |

No delete, rename, shell, network, or arbitrary filesystem tool is included.

## Configure one vault

Copy the values from `.env.example` into the MCP host configuration; do not load the example file automatically. The important setting is the absolute path of the same folder selected in Brainarium:

```sh
export BRAINARIUM_VAULT="/absolute/path/to/vault"
export BRAINARIUM_MCP_ALLOW_WRITE=false
```

Each Claude Desktop or Claude Code configuration should start a separate process for the vault it is permitted to access. Changing the selected Brainarium vault requires changing or restarting that MCP process; it is deliberately not a broad home-directory server.

## Run directly with Cargo

```sh
cd brainarium-mcp
cargo run --release
```

The server uses stdin/stdout for MCP JSON-RPC. Keep diagnostic output on stderr only.

## Run through uv

The MCP implementation remains the Rust binary. `uv` only provides a portable launcher that `exec`s the compiled binary (or `cargo run --release` when it has not been built yet):

```sh
cd brainarium-mcp
uv run brainarium-mcp
```

Set `BRAINARIUM_MCP_BINARY=/absolute/path/to/brainarium-mcp` to make the launcher exec an externally built release binary.

## Run in Docker

Build the local image once. Any MCP client below starts it as its stdio child
process; Brainarium itself does not need to be running.

```sh
docker build -f brainarium-mcp/Dockerfile -t brainarium-mcp:local .
```

Use a read-only mount by default. It is a second safety boundary in addition to
the server's disabled `write_file` tool:

```sh
docker run --rm -i \
  --mount "type=bind,src=/absolute/path/to/vault,dst=/vault,readonly" \
  -e BRAINARIUM_VAULT=/vault \
  -e BRAINARIUM_MCP_ALLOW_WRITE=false \
  brainarium-mcp:local
```

For local development, Compose uses the same read-only default:

```sh
export BRAINARIUM_VAULT_HOST="/absolute/path/to/vault"
docker compose -f brainarium-mcp/compose.yaml run --rm brainarium-mcp
```

To deliberately enable writes in development, use both an explicit `true` and
the write override. This is the only Compose invocation that creates a writable
bind mount:

```sh
export BRAINARIUM_VAULT_HOST="/absolute/path/to/vault"
docker compose \
  -f brainarium-mcp/compose.yaml \
  -f brainarium-mcp/compose.write.yaml \
  run --rm brainarium-mcp
```

## Docker MCP configuration

Each configuration starts exactly one container for exactly one vault. Build
the image first, then copy an example and replace the absolute host path. The
examples are read-only (`BRAINARIUM_MCP_ALLOW_WRITE=false` and `:ro`) so a
client cannot alter a vault until you deliberately change **both** values.

| Client | Read-only Docker example | Install / verify |
| --- | --- | --- |
| Claude Desktop | [`config/claude-desktop.docker.example.json`](config/claude-desktop.docker.example.json) | Copy the `brainarium-vault` entry into the Claude Desktop MCP configuration, restart Claude Desktop, then use `vault_status`. |
| Claude Code | [`config/claude-code.docker.example.json`](config/claude-code.docker.example.json) | `claude mcp add --transport stdio --scope user brainarium-vault -- docker run --rm -i -e BRAINARIUM_VAULT=/vault -e BRAINARIUM_MCP_ALLOW_WRITE=false -v /absolute/path/to/vault:/vault:ro brainarium-mcp:local`, then `claude mcp get brainarium-vault`. |
| Codex | [`config/codex.docker.example.toml`](config/codex.docker.example.toml) | Copy the table into `~/.codex/config.toml`, restart Codex, then use `codex mcp get brainarium_vault`. Alternatively run `codex mcp add brainarium-vault -- docker run --rm -i -e BRAINARIUM_VAULT=/vault -e BRAINARIUM_MCP_ALLOW_WRITE=false -v /absolute/path/to/vault:/vault:ro brainarium-mcp:local`. |
| Other stdio MCP clients | [`config/docker-mcp.example.json`](config/docker-mcp.example.json) | Use its `command` and `args` as the client's stdio server entry, then ask it to call `vault_status`. |

`claude mcp add` treats everything after `--` as the local server command;
the command above deliberately puts Docker and all Docker flags after that
separator. Claude Code's own MCP reference documents this local-stdio form and
the `claude mcp get` health check.

For a native (non-Docker) Claude Desktop setup, use
[`config/claude-desktop.example.json`](config/claude-desktop.example.json). It
starts the Rust server through `uv` and remains read-only until you explicitly
set `BRAINARIUM_MCP_ALLOW_WRITE=true`.

## Write access

For a Docker MCP entry, change `BRAINARIUM_MCP_ALLOW_WRITE` to `true` **and**
the bind mount suffix from `:ro` to `:rw`, then restart the client. Keep the
host path fixed to the exact vault chosen in Brainarium. `write_file` still
requires the `version` returned by `read_file` when replacing an existing file;
a stale agent context cannot overwrite newer source. Create a folder with
`create_directory`, or send `createParents: true` when creating one new nested
file. A Markdown write rebuilds the vault's derived graph cache, and
Brainarium's watcher shows that source change when it is open. `vault_graph`
and `file_connections` remain read-only source-derived queries.

## Validation

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release
uv run brainarium-mcp
cd ..
docker build -f brainarium-mcp/Dockerfile -t brainarium-mcp:local .
```

The first four commands are automated Rust checks. The last two start a stdio server, so an MCP host or a JSON-RPC smoke client should be connected before treating them as end-to-end validation.
