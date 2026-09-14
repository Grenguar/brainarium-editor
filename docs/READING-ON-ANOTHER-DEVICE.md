# Reading a vault on another device

Status: guide, 2026-09-09.

Brainarium can serve the vault you already have open as read-only web pages, so you can read your notes on a tablet or phone. There is no account, no cloud storage, and nothing is uploaded: the pages are rendered by the app on your computer and read directly by the other device.

This is reading only. You cannot edit, search, or run anything from the other device, and the routes to do so do not exist.

## What you need

- Brainarium running on your computer, with a vault open. The computer must stay awake — if it sleeps, reading stops.
- [Tailscale](https://tailscale.com) installed and signed in on **both** devices, on the same tailnet.

## Setup

**1. Start serving.** In Brainarium's sidebar, choose **Read on another device**. A six-character pairing code appears, along with the loopback port the app is listening on.

**2. Publish the port to your tailnet.** Brainarium binds `127.0.0.1` and nothing else, so the port is not reachable from another machine until you publish it. In a terminal on the same computer:

```bash
tailscale serve --bg <port>
```

Tailscale prints an `https://<machine>.<tailnet>.ts.net/` address and terminates TLS for you.

**3. Open that address** on the tablet and enter the pairing code once. The device is remembered afterwards.

To stop publishing:

```bash
tailscale serve --https=443 off
```

and choose **Stop sharing** in Brainarium.

## Why it works this way

Binding only to loopback means the app never opens a socket that anything outside your computer can reach, whatever network you are on. Publishing is a separate, deliberate act, taken outside the app, using a tool that already knows who your devices are. Brainarium never configures Tailscale and never asks for your credentials.

The pairing code sits beneath that, not instead of it. Tailscale decides which _devices_ can reach the port; the code decides who can read the vault. It also means another process on your own computer cannot read the vault just by finding the port.

## Limits worth knowing

- **No offline reading.** The pages are rendered on demand by your computer. With no connection, or with the computer asleep, there is nothing to read. Reading on a plane needs the files on the device, which is a different product.
- **The pairing code changes every time you start serving.** Stopping and restarting means pairing again.
- **Very large text files are refused** with a message rather than served, to keep a single request from consuming the app's memory.
- **HTML files in your vault are shown as source**, not rendered, exactly as they are on the desktop.
- **Serving follows the open vault.** Switch vaults and the served content switches with it; close the vault and the pages report that none is open.
