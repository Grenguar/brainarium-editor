import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  VaultDocumentContent,
  VaultSnapshot,
} from "../../shared/contracts/vault";

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
  input: { baseVersion: string; relativePath: string; text: string },
): Promise<VaultDocumentContent> {
  const { resolvedPath } = await resolveDocument(snapshot, input.relativePath);
  const currentBytes = await readFile(resolvedPath);
  if (versionFor(currentBytes) !== input.baseVersion) {
    throw new Error(
      "This file changed outside Brainarium. Reopen it before saving.",
    );
  }
  const temporaryPath = path.join(
    path.dirname(resolvedPath),
    `.${path.basename(resolvedPath)}.${randomUUID()}.tmp`,
  );
  await writeFile(temporaryPath, input.text, "utf8");
  await rename(temporaryPath, resolvedPath);
  return readVaultDocument(snapshot, input.relativePath);
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

function versionFor(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
