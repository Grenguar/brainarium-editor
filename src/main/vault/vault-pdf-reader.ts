import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type {
  VaultDocumentContent,
  VaultPdfContent,
  VaultSnapshot,
} from "../../shared/contracts/vault";

// The in-app reader receives a complete blob rather than an arbitrary path.
// This ceiling covers the supplied academic-paper library while keeping a
// malformed or unexpectedly huge file from exhausting renderer memory.
const MAX_PDF_BYTES = 64 * 1024 * 1024;

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function isPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

/**
 * Reads a scanned PDF only after re-checking its canonical active-vault path,
 * size, and signature. It deliberately exposes bytes, never a filesystem URL.
 */
export async function readVaultPdfDocument(
  snapshot: VaultSnapshot,
  relativePath: string,
): Promise<VaultDocumentContent> {
  const document = snapshot.documents.find(
    (candidate) =>
      candidate.kind === "pdf" && candidate.relativePath === relativePath,
  );
  if (!document) throw new Error("That PDF is not part of the active vault.");

  const rootPath = await realpath(snapshot.rootPath);
  const resolvedPath = await realpath(
    path.join(rootPath, document.relativePath),
  );
  const resolvedRelativePath = path.relative(rootPath, resolvedPath);
  if (
    !isPathInside(rootPath, resolvedPath) ||
    resolvedRelativePath.split(path.sep)[0] === ".brainarium"
  ) {
    throw new Error("That PDF is outside the visible vault.");
  }

  const fileStats = await stat(resolvedPath);
  if (!fileStats.isFile() || fileStats.size > MAX_PDF_BYTES) {
    throw new Error("That PDF is unavailable or too large to render.");
  }
  const bytes = await readFile(resolvedPath);
  if (!isPdf(bytes)) throw new Error("That file does not match its PDF type.");

  const pdf: VaultPdfContent = {
    bytes: new Uint8Array(bytes),
    mimeType: "application/pdf",
  };
  return {
    kind: "pdf",
    pdf,
    relativePath: document.relativePath,
    text: "",
    title: document.title,
    version: createHash("sha256").update(bytes).digest("hex"),
  };
}
