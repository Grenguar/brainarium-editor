import { readFile, realpath } from "node:fs/promises";
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
  const document = snapshot.documents.find(
    (candidate) => candidate.relativePath === relativePath,
  );
  if (!document) {
    throw new Error("That document is not part of the active vault.");
  }
  const rootPath = await realpath(snapshot.rootPath);
  const resolvedPath = await realpath(
    path.join(rootPath, document.relativePath),
  );
  if (!isPathInside(rootPath, resolvedPath)) {
    throw new Error("That document now resolves outside the active vault.");
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
  };
}
