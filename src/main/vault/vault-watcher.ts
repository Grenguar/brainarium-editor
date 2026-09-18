import { watch, type FSWatcher } from "node:fs";

import type { VaultSnapshot } from "../../shared/contracts/vault";

import { scanVault } from "./vault-scanner";

type Scan = (rootPath: string) => Promise<VaultSnapshot>;
type OnSnapshot = (snapshot: VaultSnapshot) => Promise<void> | void;

type VaultWatcherOptions = {
  debounceMs?: number;
  reconcileMs?: number;
};

/**
 * Keeps the active vault snapshot current when another local tool changes a
 * file. Native events provide the fast path; periodic reconciliation keeps
 * networked or noisy filesystems from leaving Brainarium stale.
 */
export class VaultWatcher {
  private generation = 0;
  private lastFingerprint: string | undefined;
  private reconcileTimer: NodeJS.Timeout | undefined;
  private refreshPending = false;
  private refreshTimer: NodeJS.Timeout | undefined;
  private refreshingGeneration: number | undefined;
  private watcher: FSWatcher | undefined;

  constructor(
    private readonly onSnapshot: OnSnapshot,
    private readonly scan: Scan = scanVault,
    private readonly options: VaultWatcherOptions = {},
  ) {}

  start(snapshot: VaultSnapshot): void {
    this.stop();
    const generation = this.generation;
    const rootPath = snapshot.rootPath;
    this.lastFingerprint = snapshotFingerprint(snapshot);
    const schedule = (fileName?: string | Buffer | null): void => {
      if (isDerivedGraphPath(fileName)) return;
      this.scheduleRefresh(rootPath, generation);
    };

    try {
      this.watcher = watch(
        rootPath,
        { recursive: true },
        (_event, fileName) => {
          schedule(fileName);
        },
      );
      this.watcher.on("error", () => schedule());
    } catch {
      // Periodic reconciliation remains active when a filesystem rejects a
      // native recursive watch (for example, some network volumes).
    }

    this.reconcileTimer = setInterval(
      () => this.scheduleRefresh(rootPath, generation),
      this.options.reconcileMs ?? 3_000,
    );
  }

  stop(): void {
    this.generation += 1;
    this.watcher?.close();
    this.watcher = undefined;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.refreshPending = false;
    this.lastFingerprint = undefined;
    this.refreshTimer = undefined;
    this.reconcileTimer = undefined;
  }

  private scheduleRefresh(rootPath: string, generation: number): void {
    if (generation !== this.generation) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh(rootPath, generation);
    }, this.options.debounceMs ?? 350);
  }

  /**
   * Handling a snapshot can outlast the reconciliation interval on a large
   * vault, because it re-reads every changed note. Overlapping passes are
   * collapsed into a single follow-up rather than stacked, so a vault under
   * steady external edits cannot build an unbounded backlog of scans.
   */
  private async refresh(rootPath: string, generation: number): Promise<void> {
    if (generation !== this.generation) return;
    if (this.refreshingGeneration === generation) {
      this.refreshPending = true;
      return;
    }

    this.refreshingGeneration = generation;
    try {
      do {
        this.refreshPending = false;
        try {
          const snapshot = await this.scan(rootPath);
          if (generation !== this.generation) return;
          const fingerprint = snapshotFingerprint(snapshot);
          if (this.lastFingerprint === fingerprint) continue;
          this.lastFingerprint = fingerprint;
          await this.onSnapshot(snapshot);
        } catch {
          // A transient external rename or permissions change should not tear
          // down the active workspace. The next native event or reconciliation
          // retries it.
        }
      } while (this.refreshPending && generation === this.generation);
    } finally {
      if (this.refreshingGeneration === generation) {
        this.refreshingGeneration = undefined;
      }
    }
  }
}

export function isDerivedGraphPath(fileName?: string | Buffer | null): boolean {
  if (!fileName) return false;
  const relativePath = fileName.toString().replaceAll("\\", "/");
  return (
    relativePath === ".brainarium" || relativePath.startsWith(".brainarium/")
  );
}

function snapshotFingerprint(snapshot: VaultSnapshot): string {
  return JSON.stringify({
    documents: snapshot.documents.map((document) => [
      document.relativePath,
      document.mtimeMs,
      document.size,
    ]),
    issues: snapshot.issues,
  });
}
