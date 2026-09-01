import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  DocumentSaveInput,
  DocumentSaveResult,
  VaultDocumentContent,
  VaultSnapshot,
} from "../../shared/contracts/vault";

const saveQueues = new Map<string, Promise<void>>();

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export async function readVaultDocument(
  snapshot: VaultSnapshot,
  relativePath: string,
): Promise<VaultDocumentContent> {
  const { document, resolvedPath } = await resolveDocument(
    snapshot,
    relativePath,
  );
  if (document.kind === "image" || document.kind === "pdf") {
    throw new Error(
      "Binary documents must be read through their dedicated reader.",
    );
  }

  const bytes = await readFile(resolvedPath);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Brainarium only opens UTF-8 documents.");
  }
  return {
    kind: document.kind,
    relativePath: document.relativePath,
    text,
    title: document.title,
    version: versionFor(bytes),
  };
}

export async function saveVaultDocument(
  snapshot: VaultSnapshot,
  input: DocumentSaveInput,
): Promise<DocumentSaveResult> {
  const saveKey = `${snapshot.rootPath}\u0000${input.relativePath}`;
  return serializeSave(saveKey, () => saveVaultDocumentOnce(snapshot, input));
}

async function saveVaultDocumentOnce(
  snapshot: VaultSnapshot,
  input: DocumentSaveInput,
): Promise<DocumentSaveResult> {
  let resolved: Awaited<ReturnType<typeof resolveDocument>>;
  try {
    resolved = await resolveDocument(snapshot, input.relativePath);
  } catch (error) {
    if (isMissingError(error)) return missing(input.relativePath);
    throw error;
  }
  if (resolved.document.kind !== "markdown") {
    throw new Error("Only Markdown documents can be edited in Brainarium.");
  }

  const initialBytes = await readBytesOrMissing(resolved.resolvedPath);
  if (!initialBytes) return missing(input.relativePath);
  if (versionFor(initialBytes) !== input.baseVersion) {
    return conflict(resolved.document, initialBytes, input.baseVersion);
  }

  const temporaryPath = path.join(
    path.dirname(resolved.resolvedPath),
    `.${path.basename(resolved.resolvedPath)}.${randomUUID()}.tmp`,
  );
  let temporaryFileCreated = false;
  try {
    await writeFile(temporaryPath, input.text, "utf8");
    temporaryFileCreated = true;

    // Re-read immediately before the replacement. This closes the practical
    // race between the optimistic check above and our atomic rename; a later
    // writer gets a typed conflict rather than an invisible overwrite.
    const finalBytes = await readBytesOrMissing(resolved.resolvedPath);
    if (!finalBytes) return missing(input.relativePath);
    if (versionFor(finalBytes) !== input.baseVersion) {
      return conflict(resolved.document, finalBytes, input.baseVersion);
    }

    await rename(temporaryPath, resolved.resolvedPath);
    temporaryFileCreated = false;
    return {
      document: await readVaultDocument(snapshot, input.relativePath),
      status: "saved",
    };
  } finally {
    if (temporaryFileCreated) {
      await unlinkIfPresent(temporaryPath);
    }
  }
}

async function resolveDocument(snapshot: VaultSnapshot, relativePath: string) {
  const document = snapshot.documents.find(
    (candidate) => candidate.relativePath === relativePath,
  );
  if (!document)
    throw new Error("That document is not part of the active vault.");
  const rootPath = await realpath(snapshot.rootPath);
  const resolvedPath = await realpath(
    path.join(rootPath, document.relativePath),
  );
  if (!isPathInside(rootPath, resolvedPath))
    throw new Error("That document now resolves outside the active vault.");
  return { document, resolvedPath };
}

async function readBytesOrMissing(
  resolvedPath: string,
): Promise<Buffer | undefined> {
  try {
    return await readFile(resolvedPath);
  } catch (error) {
    if (isMissingError(error)) return undefined;
    throw error;
  }
}

async function unlinkIfPresent(temporaryPath: string): Promise<void> {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (!isMissingError(error)) throw error;
  }
}

function conflict(
  document: VaultSnapshot["documents"][number],
  diskBytes: Buffer,
  requestedBaseVersion: string,
): DocumentSaveResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(diskBytes);
  } catch {
    throw new Error("Brainarium only opens UTF-8 documents.");
  }
  return {
    disk: {
      kind: document.kind,
      relativePath: document.relativePath,
      text,
      title: document.title,
      version: versionFor(diskBytes),
    },
    relativePath: document.relativePath,
    requestedBaseVersion,
    status: "conflict",
  };
}

function missing(relativePath: string): DocumentSaveResult {
  return { relativePath, status: "missing" };
}

function isMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

async function serializeSave<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = saveQueues.get(key) ?? Promise.resolve();
  let releaseCurrent: (() => void) | undefined;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  saveQueues.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    releaseCurrent?.();
    if (saveQueues.get(key) === tail) saveQueues.delete(key);
  }
}

function versionFor(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
