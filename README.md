# Brainarium

Brainarium is a local-first Electron/Rust editor for folder-backed knowledge
vaults. It reads Markdown, CSV, plain text, JSON, XML, and HTML without moving
the selected folder or introducing a proprietary storage format.

## Run the app

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites, tests, packaging, and
the independent Rust MCP. Start with [the documentation overview](docs/README.md)
for the product and technical contracts.
