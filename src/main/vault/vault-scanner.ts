import { realpath, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  DocumentKind,
  VaultDocument,
  VaultScanIssue,
  VaultSnapshot,
  VaultTreeDirectory,
} from "../../shared/contracts/vault";

const IGNORED_DIRECTORY_NAMES = new Set([".git", "node_modules"]);

function documentKind(fileName: string): DocumentKind | undefined {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".md" || extension === ".markdown") {
    return "markdown";
  }
  if (extension === ".csv") {
    return "csv";
  }
  if (extension === ".txt") {
    return "text";
  }
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".xml") {
    return "xml";
  }
  if (extension === ".html" || extension === ".htm") {
    return "html";
  }
  if (
    extension === ".avif" ||
    extension === ".gif" ||
    extension === ".jpeg" ||
    extension === ".jpg" ||
    extension === ".png" ||
    extension === ".webp"
  ) {
    return "image";
  }
  return undefined;
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function relativePath(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).split(path.sep).join("/");
}

function titleFromFileName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName));
}

function isIgnoredDirectory(name: string): boolean {
  return name.startsWith(".") || IGNORED_DIRECTORY_NAMES.has(name);
}

function isIgnoredFile(name: string): boolean {
  return name.startsWith(".");
}

/**
 * Creates a rebuildable, filesystem-authoritative tree for a vault.
 *
 * All traversed paths are resolved before inclusion. Symlink targets outside
 * the selected vault are deliberately excluded instead of being followed.
 */
export async function scanVault(selectedRoot: string): Promise<VaultSnapshot> {
  const rootPath = await realpath(selectedRoot);
  const rootStats = await stat(rootPath);

  if (!rootStats.isDirectory()) {
    throw new Error("A vault root must be a directory.");
  }

  const documents: VaultDocument[] = [];
  const issues: VaultScanIssue[] = [];
  async function scanDirectory(
    logicalPath: string,
    resolvedDirectoryPath: string,
    ancestorDirectories: ReadonlySet<string>,
  ): Promise<VaultTreeDirectory> {
    const directory: VaultTreeDirectory = {
      children: [],
      kind: "directory",
      name:
        logicalPath === rootPath
          ? path.basename(rootPath)
          : path.basename(logicalPath),
      relativePath: relativePath(rootPath, logicalPath),
    };

    let entries;
    try {
      entries = await readdir(resolvedDirectoryPath, { withFileTypes: true });
    } catch {
      issues.push({
        code: "inaccessible-entry",
        relativePath: relativePath(rootPath, logicalPath),
      });
      return directory;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.isDirectory() && isIgnoredDirectory(entry.name)) {
        continue;
      }
      if (entry.isFile() && isIgnoredFile(entry.name)) {
        continue;
      }

      const entryLogicalPath = path.join(logicalPath, entry.name);
      const entryResolvedPath = path.join(resolvedDirectoryPath, entry.name);
      const entryRelativePath = relativePath(rootPath, entryLogicalPath);
      let resolvedPath = entryResolvedPath;

      if (entry.isSymbolicLink()) {
        try {
          resolvedPath = await realpath(entryResolvedPath);
        } catch {
          issues.push({
            code: "inaccessible-entry",
            relativePath: entryRelativePath,
          });
          continue;
        }

        if (!isPathInside(rootPath, resolvedPath)) {
          issues.push({
            code: "external-symlink",
            relativePath: entryRelativePath,
          });
          continue;
        }
      }

      let entryStats;
      try {
        entryStats = await stat(resolvedPath);
      } catch {
        issues.push({
          code: "inaccessible-entry",
          relativePath: entryRelativePath,
        });
        continue;
      }

      if (entryStats.isDirectory()) {
        if (isIgnoredDirectory(entry.name)) {
          continue;
        }
        if (ancestorDirectories.has(resolvedPath)) {
          issues.push({
            code: "symlink-cycle",
            relativePath: entryRelativePath,
          });
          continue;
        }
        const childAncestors = new Set(ancestorDirectories);
        childAncestors.add(resolvedPath);
        directory.children.push(
          await scanDirectory(entryLogicalPath, resolvedPath, childAncestors),
        );
        continue;
      }

      if (!entryStats.isFile() || isIgnoredFile(entry.name)) {
        continue;
      }

      const kind = documentKind(entry.name);
      if (!kind) {
        continue;
      }

      const document: VaultDocument = {
        kind,
        mtimeMs: entryStats.mtimeMs,
        name: entry.name,
        relativePath: entryRelativePath,
        size: entryStats.size,
        title: titleFromFileName(entry.name),
      };
      documents.push(document);
      directory.children.push(document);
    }

    return directory;
  }

  const tree = await scanDirectory(rootPath, rootPath, new Set([rootPath]));
  documents.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );

  return { documents, issues, rootPath, tree };
}

export function isSupportedVaultDocument(fileName: string): boolean {
  return documentKind(fileName) !== undefined;
}
