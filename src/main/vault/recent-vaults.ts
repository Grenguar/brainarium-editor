import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RecentVault } from "../../shared/contracts/vault";

type StoredRecentVault = RecentVault & { path: string };

const MAX_RECENT_VAULTS = 8;

export class RecentVaultStore {
  constructor(private readonly storagePath: string) {}

  async list(): Promise<RecentVault[]> {
    return (await this.read()).map(({ id, lastOpenedAt, name }) => ({
      id,
      lastOpenedAt,
      name,
    }));
  }

  async pathFor(id: string): Promise<string | undefined> {
    return (await this.read()).find((recent) => recent.id === id)?.path;
  }

  async remember(vaultPath: string): Promise<void> {
    const existing = await this.read();
    const next: StoredRecentVault = {
      id: createHash("sha256").update(vaultPath).digest("hex"),
      lastOpenedAt: new Date().toISOString(),
      name: path.basename(vaultPath),
      path: vaultPath,
    };
    const remaining = existing.filter((recent) => recent.id !== next.id);
    await this.write([next, ...remaining].slice(0, MAX_RECENT_VAULTS));
  }

  private async read(): Promise<StoredRecentVault[]> {
    try {
      const raw = await readFile(this.storagePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isStoredRecentVault);
    } catch {
      return [];
    }
  }

  private async write(recents: StoredRecentVault[]): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const temporaryPath = `${this.storagePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(recents), "utf8");
    await rename(temporaryPath, this.storagePath);
  }
}

function isStoredRecentVault(value: unknown): value is StoredRecentVault {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return ["id", "lastOpenedAt", "name", "path"].every(
    (key) => typeof record[key] === "string",
  );
}
