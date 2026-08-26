import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { VaultSessionState } from "../../shared/contracts/vault";

const MAX_SCROLL_POSITIONS = 2_000;
const MAX_SCROLL_OFFSET = 10_000_000;

type StoredVaultSession = VaultSessionState & {
  vaultPath?: string;
};

/**
 * A deliberately small app-support store. It is never placed in the vault,
 * so reopening a folder does not create files, Git changes, or sync noise.
 */
export class VaultSessionStore {
  constructor(private readonly storagePath: string) {}

  async restore(): Promise<StoredVaultSession> {
    return this.read();
  }

  async rememberVault(vaultPath: string): Promise<void> {
    const current = await this.read();
    if (current.vaultPath === vaultPath) return;
    await this.write({ scrollPositions: {}, vaultPath });
  }

  async rememberSession(
    vaultPath: string,
    session: VaultSessionState,
  ): Promise<void> {
    const current = await this.read();
    // A stale renderer must never overwrite state for a vault selected later.
    if (current.vaultPath !== vaultPath) return;
    await this.write({ ...session, vaultPath });
  }

  async clear(): Promise<void> {
    await this.write({ scrollPositions: {} });
  }

  private async read(): Promise<StoredVaultSession> {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.storagePath, "utf8"),
      );
      return isStoredVaultSession(parsed)
        ? {
            activeDocumentPath: parsed.activeDocumentPath,
            scrollPositions: parsed.scrollPositions,
            vaultPath: parsed.vaultPath,
          }
        : { scrollPositions: {} };
    } catch {
      return { scrollPositions: {} };
    }
  }

  private async write(session: StoredVaultSession): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const temporaryPath = `${this.storagePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(session), "utf8");
    await rename(temporaryPath, this.storagePath);
  }
}

function isStoredVaultSession(value: unknown): value is StoredVaultSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    (record.vaultPath !== undefined && typeof record.vaultPath !== "string") ||
    (record.activeDocumentPath !== undefined &&
      typeof record.activeDocumentPath !== "string") ||
    !isScrollPositions(record.scrollPositions)
  ) {
    return false;
  }
  return true;
}

function isScrollPositions(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    entries.length <= MAX_SCROLL_POSITIONS &&
    entries.every(
      ([relativePath, offset]) =>
        relativePath.length > 0 &&
        relativePath.length <= 4_096 &&
        typeof offset === "number" &&
        Number.isFinite(offset) &&
        offset >= 0 &&
        offset <= MAX_SCROLL_OFFSET,
    )
  );
}
