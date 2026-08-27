import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DocumentReviewState,
  MarkdownChangeReview,
  VaultSnapshot,
} from "../../shared/contracts/vault";

const MAX_SNAPSHOT_BYTES = 1_000_000;
const STORE_VERSION = 1;

type StoredContent = {
  capturedAt: number;
  sha256: string;
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
  constructor(private readonly storagePath: string) {}

  async reconcile(snapshot: VaultSnapshot): Promise<DocumentReviewState[]> {
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
      const content = await this.capture(
        path.join(snapshot.rootPath, document.relativePath),
      );
      if (!content) continue;
      const existing = vault.files[document.relativePath];
      if (!existing) {
        vault.files[document.relativePath] = {
          current: content,
          lastReviewed: content,
        };
      } else if (existing.current.sha256 !== content.sha256) {
        existing.current = content;
      }
    }

    await this.write(store);
    return reviewStates(vault);
  }

  async states(vaultPath: string): Promise<DocumentReviewState[]> {
    const store = await this.read();
    return reviewStates(store.vaults[vaultPath]);
  }

  async review(
    vaultPath: string,
    relativePath: string,
  ): Promise<MarkdownChangeReview | undefined> {
    const store = await this.read();
    const file = store.vaults[vaultPath]?.files[relativePath];
    if (!file || file.current.sha256 === file.lastReviewed.sha256)
      return undefined;
    return {
      changed: true,
      changedAt: file.current.capturedAt,
      currentText: file.current.text,
      previousText: file.lastReviewed.text,
      relativePath,
    };
  }

  async markReviewed(
    vaultPath: string,
    relativePath: string,
  ): Promise<DocumentReviewState[]> {
    const store = await this.read();
    const vault = store.vaults[vaultPath];
    const file = vault?.files[relativePath];
    if (file) file.lastReviewed = file.current;
    await this.write(store);
    return reviewStates(vault);
  }

  async recordReviewedText(
    vaultPath: string,
    relativePath: string,
    text: string,
  ): Promise<void> {
    const store = await this.read();
    const vault = (store.vaults[vaultPath] ??= { files: {} });
    const content = captured(Buffer.from(text, "utf8"));
    vault.files[relativePath] = { current: content, lastReviewed: content };
    await this.write(store);
  }

  private async capture(filePath: string): Promise<StoredContent | undefined> {
    try {
      return captured(await readFile(filePath));
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

function captured(bytes: Buffer): StoredContent {
  const now = Date.now();
  return {
    capturedAt: now,
    sha256: sha256(bytes),
    text:
      bytes.byteLength <= MAX_SNAPSHOT_BYTES
        ? new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        : undefined,
  };
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
