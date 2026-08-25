# Brainarium MCP

`brainarium-mcp` is a local, stdio Model Context Protocol server written in Rust. One process serves exactly one configured Brainarium vault. It exposes raw source operations for Brainarium's supported text formats only:

- Markdown (`.md`)
- CSV (`.csv`)
- Plain text (`.txt`)
- JSON (`.json`)
- XML (`.xml`)
- HTML (`.html`)

The server never renders, reformats, or interprets document contents. `write_file` replaces the raw UTF-8 source atomically and is disabled until explicitly enabled.

## Safety boundary

- `BRAINARIUM_VAULT` is canonicalized at startup and is the only accessible root.
- Tool paths must be clean, non-hidden relative paths. Absolute paths, `..`, hidden paths (including `.brainarium`), and all symlinks are rejected.
- File listing follows neither symlinks nor hidden directories.
- Only the six supported text extensions can be read or written.
- The maximum source size defaults to 5 MiB and is capped at 64 MiB.
- `write_file` is disabled unless `BRAINARIUM_MCP_ALLOW_WRITE=true`; it never creates directories and only creates/replaces one supported file in an existing vault directory. Replacing an existing file requires the SHA-256 `version` returned by `read_file`, so a stale Claude/Desktop/Code context fails rather than overwriting newer source. Markdown writes rebuild Brainarium's local `.brainarium/graph-v1.json` cache; the receipt reports whether that rebuild completed.

The current tool set is intentionally small:

| Tool | Purpose |
| --- | --- |
| `vault_status` | Confirm the vault boundary, supported extensions, source limit, and write state. |
| `list_files` | List visible supported files, optionally under a vault-relative folder. |
| `read_file` | Read exact UTF-8 source for one supported file. |
| `write_file` | Atomically create or replace one supported file when write access is enabled. |

No delete, rename, shell, network, or arbitrary filesystem tool is included.

## Configure one vault

Copy the values from `.env.example` into the MCP host configuration; do not load the example file automatically. The important setting is the absolute path of the same folder selected in Brainarium:

```sh
export BRAINARIUM_VAULT="/absolute/path/to/vault"
export BRAINARIUM_MCP_ALLOW_WRITE=true
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

Build a local image and run it as a stdio child process:

```sh
docker build -f brainarium-mcp/Dockerfile -t brainarium-mcp:local .
docker run --rm -i \
  -e BRAINARIUM_VAULT=/vault \
  -e BRAINARIUM_MCP_ALLOW_WRITE=true \
  -v "/absolute/path/to/vault:/vault:rw" \
  brainarium-mcp:local
```

For local development, `compose.yaml` binds a single host vault at `/vault`:

```sh
export BRAINARIUM_VAULT_HOST="/absolute/path/to/vault"
export BRAINARIUM_MCP_ALLOW_WRITE=true
docker compose -f brainarium-mcp/compose.yaml run --rm brainarium-mcp
```

## Claude configuration examples

`config/claude-desktop.example.json` starts the `uv` launcher. `config/docker-mcp.example.json` starts an image with an explicit single-vault bind mount. Copy the relevant `mcpServers.brainarium-vault` entry into the host's MCP configuration, then replace every placeholder path. The two configuration examples make no assumptions about a particular vault name.

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
