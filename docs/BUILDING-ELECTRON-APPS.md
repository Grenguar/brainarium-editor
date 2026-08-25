# Building and running Electron apps

Brainarium uses Electron Forge, React, TypeScript, and a small Rust sidecar.
This guide covers both running Brainarium and creating a separate Electron app.

## Run Brainarium from this checkout

Install Node 22 and Rust stable, then run:

```sh
npm ci
npm run dev
```

Forge starts the Electron main process, sandboxed renderer, and preload bridge.
It also builds Brainarium's Rust graph indexer before development or packaging.
Quit the app or press `Ctrl+C` in the terminal to stop it.

Run the mandatory quality gate before sharing a change:

```sh
npm run quality
```

## Package Brainarium for the current platform

Build on the operating system you are targeting:

```sh
npm run make
```

The resulting native installers appear below `out/make/`:

| Host platform | Local artifacts |
| --- | --- |
| macOS | unsigned DMG and ZIP |
| Windows x64 | Squirrel Setup `.exe` and `.nupkg` |
| Debian/Ubuntu x64 | `.deb` |
| Fedora/RHEL/openSUSE-style x64 | `.rpm` |

Local macOS builds are intentionally unsigned. The tagged GitHub release
workflow performs signing and notarization; see [RELEASING.md](RELEASING.md).

## Create your own Electron Forge app

Use Forge's TypeScript/Webpack starter for an independent app:

```sh
npx create-electron-app@latest my-electron-app --template=webpack-typescript
cd my-electron-app
npm start
```

The new app has three deliberate layers:

1. **Main** owns windows, native dialogs, filesystem access, and process work.
2. **Preload** exposes a small typed API with `contextBridge`.
3. **Renderer** is the web UI and must not receive Node or arbitrary filesystem
   access.

Keep `contextIsolation: true`, `nodeIntegration: false`, and a sandboxed
renderer. Validate inputs in the main process even when the UI is trusted.
For installers, add the Forge makers needed by your platform, run `npm run make`
on that platform, and verify the generated installer on a clean user account.

Brainarium is a useful reference for the minimal boundaries:

- [`src/main/index.ts`](../src/main/index.ts) creates the sandboxed window and
  handles privileged IPC.
- [`src/preload/index.ts`](../src/preload/index.ts) defines the narrow bridge.
- [`src/renderer/index.tsx`](../src/renderer/index.tsx) is the React UI.
- [`forge.config.js`](../forge.config.js) defines native makers and macOS
  release signing.
