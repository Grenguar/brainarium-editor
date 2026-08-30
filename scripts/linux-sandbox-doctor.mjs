#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export function isRootSetuidSandboxHelper(stats) {
  return stats.uid === 0 && (stats.mode & 0o7777) === 0o4755;
}

export function diagnoseLinuxSandbox({
  platform,
  sandboxHelper,
  userNamespacesAvailable,
}) {
  if (platform !== "linux") {
    return {
      exitCode: 0,
      lines: ["Linux sandbox preflight is not applicable on this platform."],
    };
  }

  if (userNamespacesAvailable) {
    return {
      exitCode: 0,
      lines: [
        "Linux sandbox preflight passed: unprivileged user namespaces are available.",
        "Electron can use its namespace sandbox during development.",
      ],
    };
  }

  if (sandboxHelper?.isRootSetuid) {
    return {
      exitCode: 0,
      lines: [
        "Linux sandbox preflight passed: chrome-sandbox is root-owned and mode 4755.",
        "Electron can use its setuid sandbox helper.",
      ],
    };
  }

  const helperDescription = sandboxHelper?.path
    ? `Found ${sandboxHelper.path}, but it is not root-owned mode 4755.`
    : "No chrome-sandbox helper was found beside the Electron executable.";
  return {
    exitCode: 1,
    lines: [
      "Linux sandbox preflight failed: Electron has no safe sandbox route available.",
      helperDescription,
      "Do not use --no-sandbox and do not change node_modules permissions.",
      "Ask the system administrator to enable the distribution's supported unprivileged user-namespace policy, or install Brainarium from its Debian/RPM package. Package installation, not this development command, owns the setuid helper metadata.",
    ],
  };
}

function electronSandboxHelper() {
  const electronExecutable = require("electron");
  const helperPath = path.join(
    path.dirname(electronExecutable),
    "chrome-sandbox",
  );
  if (!existsSync(helperPath)) return undefined;

  const stats = statSync(helperPath);
  return {
    isRootSetuid: isRootSetuidSandboxHelper(stats),
    path: helperPath,
  };
}

function userNamespacesAvailable() {
  try {
    execFileSync("unshare", ["--user", "--map-root-user", "true"], {
      stdio: "ignore",
      timeout: 3_000,
    });
    return true;
  } catch {
    return false;
  }
}

export function runLinuxSandboxDoctor() {
  const report = diagnoseLinuxSandbox({
    platform: process.platform,
    sandboxHelper:
      process.platform === "linux" ? electronSandboxHelper() : undefined,
    userNamespacesAvailable:
      process.platform === "linux" && userNamespacesAvailable(),
  });
  process.stdout.write(`${report.lines.join("\n")}\n`);
  return report.exitCode;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = runLinuxSandboxDoctor();
}
