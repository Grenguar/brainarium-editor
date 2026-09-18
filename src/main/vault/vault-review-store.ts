import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DocumentReviewState,
  MarkdownChangeReview,
  VaultDocument,
  VaultSnapshot,
} from "../../shared/contracts/vault";

const MAX_SNAPSHOT_BYTES = 1_000_000;
const STORE_VERSION = 1;

type StoredContent = {
  capturedAt: number;
  /** Stat identity of the bytes this was captured from, when it is known. */
  mtimeMs?: number;
  sha256: string;
  size?: number;
  text?: string;
};

type StoredFileReview = {
  current: StoredContent;
  lastReviewed: StoredContent;
};

type StoredVaultReview = {
  files: Record<string, StoredFileReview>;
};

type StoredReviewData = {
  vaults: Record<string, StoredVaultReview>;
  version: number;
};

const emptyStore = (): StoredReviewData => ({
  vaults: {},
  version: STORE_VERSION,
});

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Persists a bounded last-reviewed baseline outside the vault. It never writes
 * into the selected folder, so MCP clients and Git do not see review state.
 */
export class VaultReviewStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly storagePath: string) {}

  async reconcile(snapshot: VaultSnapshot): Promise<DocumentReviewState[]> {
    return this.exclusive(() => this.reconcileUnlocked(snapshot));
  }

  async states(vaultPath: string): Promise<DocumentReviewState[]> {
    return this.exclusive(async () => {
      const store = await this.read();
      return reviewStates(store.vaults[vaultPath]);
    });
  }

  async review(
    vaultPath: string,
    relativePath: string,
  ): Promise<MarkdownChangeReview | undefined> {
    return this.exclusive(async () => {
      const store = await this.read();
      const file = store.vaults[vaultPath]?.files[relativePath];
      if (!file || file.current.sha256 === file.lastReviewed.sha256)
        return undefined;
      return {
        changed: true,
        changedAt: file.current.capturedAt,
        currentText: currentTextOf(file),
        previousText: file.lastReviewed.text,
        relativePath,
      };
    });
  }

  async markReviewed(
    vaultPath: string,
    relativePath: string,
  ): Promise<DocumentReviewState[]> {
    return this.exclusive(async () => {
      const store = await this.read();
      const vault = store.vaults[vaultPath];
      const file = vault?.files[relativePath];
      if (vault && file) {
        vault.files[relativePath] = dedupedText({
          current: file.current,
          lastReviewed: file.current,
        });
      }
      await this.write(store);
      return reviewStates(vault);
    });
  }

  /**
   * Clears every changed marker for a vault in one write. Only the App Support
   * baseline moves: files on disk and any unsaved editor draft are untouched.
   */
  async markAllReviewed(vaultPath: string): Promise<DocumentReviewState[]> {
    return this.exclusive(async () => {
      const store = await this.read();
      const vault = store.vaults[vaultPath];
      if (!vault) return [];
      for (const [relativePath, file] of Object.entries(vault.files)) {
        vault.files[relativePath] = dedupedText({
          current: file.current,
          lastReviewed: file.current,
        });
      }
      await this.write(store);
      return reviewStates(vault);
    });
  }

  async recordReviewedText(
    vaultPath: string,
    relativePath: string,
    text: string,
  ): Promise<void> {
    return this.exclusive(async () => {
      const store = await this.read();
      const vault = (store.vaults[vaultPath] ??= { files: {} });
      const content = captured(Buffer.from(text, "utf8"));
      vault.files[relativePath] = dedupedText({
        current: content,
        lastReviewed: content,
      });
      await this.write(store);
    });
  }

  private async reconcileUnlocked(
    snapshot: VaultSnapshot,
  ): Promise<DocumentReviewState[]> {
    const store = await this.read();
    const vault = (store.vaults[snapshot.rootPath] ??= { files: {} });
    const markdown = snapshot.documents.filter(
      (document) => document.kind === "markdown",
    );
    const visiblePaths = new Set(
      markdown.map((document) => document.relativePath),
    );

    for (const relativePath of Object.keys(vault.files)) {
      if (!visiblePaths.has(relativePath)) delete vault.files[relativePath];
    }

    for (const document of markdown) {
      const existing = vault.files[document.relativePath];
      // Re-reading and hashing every note dominates the cost of opening a large
      // vault. The scanner has already stat-ed each file, and a baseline
      // captured from that same mtime and size cannot have gone stale.
      if (existing && isCapturedFrom(existing.current, document)) continue;

      const content = await this.capture(
        path.join(snapshot.rootPath, document.relativePath),
        document,
      );
      if (!content) continue;
      if (!existing) {
        vault.files[document.relativePath] = dedupedText({
          current: content,
          lastReviewed: content,
        });
      } else if (existing.current.sha256 !== content.sha256) {
        existing.current = content;
      } else {
        // Same bytes behind a new mtime — a touch, or a store written before
        // stat identity was recorded. Adopt it so the next open can skip the
        // read without changing what counts as reviewed.
        vault.files[document.relativePath] = dedupedText({
          current: {
            ...existing.current,
            mtimeMs: document.mtimeMs,
            size: document.size,
          },
          lastReviewed: existing.lastReviewed,
        });
      }
    }

    await this.write(store);
    return reviewStates(vault);
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async capture(
    filePath: string,
    document?: VaultDocument,
  ): Promise<StoredContent | undefined> {
    try {
      return captured(await readFile(filePath), document);
    } catch {
      return undefined;
    }
  }

  private async read(): Promise<StoredReviewData> {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.storagePath, "utf8"),
      );
      return isStoredReviewData(parsed) ? parsed : emptyStore();
    } catch {
      return emptyStore();
    }
  }

  private async write(data: StoredReviewData): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const temporary = `${this.storagePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(data), "utf8");
      await rename(temporary, this.storagePath);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

function captured(bytes: Buffer, document?: VaultDocument): StoredContent {
  const now = Date.now();
  return {
    capturedAt: now,
    mtimeMs: document?.mtimeMs,
    sha256: sha256(bytes),
    size: document?.size,
    text:
      bytes.byteLength <= MAX_SNAPSHOT_BYTES
        ? new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        : undefined,
  };
}

/**
 * True when a stored baseline was captured from exactly the bytes the scanner
 * just saw. A store written before stat identity was recorded has no mtime and
 * is always re-read once, which rebuilds it in place.
 */
function isCapturedFrom(
  content: StoredContent,
  document: VaultDocument,
): boolean {
  return content.mtimeMs === document.mtimeMs && content.size === document.size;
}

/**
 * Holds one copy of the text while both sides share the same bytes. Storing it
 * on each side doubled the store for vaults where almost nothing has changed.
 */
function dedupedText(file: StoredFileReview): StoredFileReview {
  if (file.current.sha256 !== file.lastReviewed.sha256) return file;
  const current = { ...file.current };
  delete current.text;
  return { current, lastReviewed: file.lastReviewed };
}

/** The current text, which `dedupedText` may have left on the baseline. */
function currentTextOf(file: StoredFileReview): string | undefined {
  if (file.current.text !== undefined) return file.current.text;
  return file.current.sha256 === file.lastReviewed.sha256
    ? file.lastReviewed.text
    : undefined;
}

function reviewStates(
  vault: StoredVaultReview | undefined,
): DocumentReviewState[] {
  if (!vault) return [];
  return Object.entries(vault.files)
    .map(([relativePath, file]) => ({
      changed: file.current.sha256 !== file.lastReviewed.sha256,
      changedAt: file.current.capturedAt,
      relativePath,
    }))
    .filter((state) => state.changed)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isStoredReviewData(value: unknown): value is StoredReviewData {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.version === STORE_VERSION && isRecord(record.vaults);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
