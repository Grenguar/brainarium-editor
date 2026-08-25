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
  private refreshTimer: NodeJS.Timeout | undefined;
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

  private async refresh(rootPath: string, generation: number): Promise<void> {
    if (generation !== this.generation) return;
    try {
      const snapshot = await this.scan(rootPath);
      if (
        generation === this.generation &&
        this.lastFingerprint !== snapshotFingerprint(snapshot)
      ) {
        this.lastFingerprint = snapshotFingerprint(snapshot);
        await this.onSnapshot(snapshot);
      }
    } catch {
      // A transient external rename or permissions change should not tear down
      // the active workspace. The next native event/reconciliation retries it.
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
