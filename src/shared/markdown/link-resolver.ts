import type { VaultDocument } from "../../shared/contracts/vault";

export type MarkdownLinkResolution =
  | { fragment?: string; relativePath: string; status: "resolved" }
  | { status: "missing" }
  | { candidates: string[]; status: "ambiguous" };

type ParsedTarget = {
  fragment?: string;
  path: string;
};

function markdownDocuments(
  documents: readonly VaultDocument[],
): VaultDocument[] {
  return documents.filter((document) => document.kind === "markdown");
}

function normalizePath(value: string): string | undefined {
  const pieces: string[] = [];
  for (const rawPiece of value.replaceAll("\\", "/").split("/")) {
    if (!rawPiece || rawPiece === ".") continue;
    if (rawPiece === "..") {
      if (pieces.length === 0) return undefined;
      pieces.pop();
      continue;
    }
    pieces.push(rawPiece);
  }
  return pieces.join("/");
}

function splitTarget(target: string): ParsedTarget | undefined {
  const hashIndex = target.indexOf("#");
  const rawPath = (
    hashIndex === -1 ? target : target.slice(0, hashIndex)
  ).trim();
  const rawFragment =
    hashIndex === -1 ? undefined : target.slice(hashIndex + 1);
  let decodedPath: string;
  let decodedFragment: string | undefined;
  try {
    decodedPath = decodeURIComponent(rawPath);
    decodedFragment = rawFragment ? decodeURIComponent(rawFragment) : undefined;
  } catch {
    return undefined;
  }
  return {
    fragment: decodedFragment || undefined,
    path: decodedPath.replace(/^\/+/, ""),
  };
}

function withMarkdownExtensions(value: string): string[] {
  if (/\.(?:md|markdown)$/i.test(value)) return [value];
  return [`${value}.md`, `${value}.markdown`];
}

function sourceDirectory(relativePath: string): string {
  const slash = relativePath.lastIndexOf("/");
  return slash === -1 ? "" : relativePath.slice(0, slash);
}

function exactCandidates(
  sourceRelativePath: string,
  targetPath: string,
): string[] {
  const candidates = new Set<string>();
  if (targetPath) {
    for (const candidate of withMarkdownExtensions(targetPath)) {
      const relative = normalizePath(
        [sourceDirectory(sourceRelativePath), candidate]
          .filter(Boolean)
          .join("/"),
      );
      if (relative) candidates.add(relative);
      const vaultRelative = normalizePath(candidate);
      if (vaultRelative) candidates.add(vaultRelative);
    }
  }
  return [...candidates];
}

function resolved(
  document: VaultDocument,
  fragment: string | undefined,
): MarkdownLinkResolution {
  return {
    fragment,
    relativePath: document.relativePath,
    status: "resolved",
  };
}

/**
 * Resolves ordinary Markdown file links only by their explicit relative or
 * vault-relative path. It intentionally has no title fallback.
 */
export function resolveMarkdownLink(
  documents: readonly VaultDocument[],
  sourceRelativePath: string,
  target: string,
): MarkdownLinkResolution {
  const parsed = splitTarget(target);
  if (!parsed) return { status: "missing" };
  if (!parsed.path && parsed.fragment) {
    return {
      fragment: parsed.fragment,
      relativePath: sourceRelativePath,
      status: "resolved",
    };
  }
  const candidates = exactCandidates(sourceRelativePath, parsed.path);
  const document = markdownDocuments(documents).find((candidate) =>
    candidates.includes(candidate.relativePath),
  );
  return document ? resolved(document, parsed.fragment) : { status: "missing" };
}

/**
 * Resolves a wiki-link in a deterministic order. Exact path checks retain
 * case; only the final basename/title fallback is case-folded and it must be
 * unique. Frontmatter aliases are deliberately outside this MVP rule.
 */
export function resolveWikiLink(
  documents: readonly VaultDocument[],
  sourceRelativePath: string,
  target: string,
): MarkdownLinkResolution {
  const parsed = splitTarget(target);
  if (!parsed || !parsed.path) return { status: "missing" };
  const notes = markdownDocuments(documents);
  const exact = notes.find((candidate) =>
    exactCandidates(sourceRelativePath, parsed.path).includes(
      candidate.relativePath,
    ),
  );
  if (exact) return resolved(exact, parsed.fragment);

  const normalizedTarget = parsed.path
    .replace(/\.(?:md|markdown)$/i, "")
    .toLocaleLowerCase();
  const matches = notes.filter((candidate) => {
    const filePath = candidate.relativePath
      .replace(/\.(?:md|markdown)$/i, "")
      .toLocaleLowerCase();
    const basename = filePath.slice(filePath.lastIndexOf("/") + 1);
    return (
      candidate.title.toLocaleLowerCase() === normalizedTarget ||
      basename === normalizedTarget ||
      filePath === normalizedTarget
    );
  });
  if (matches.length === 1) return resolved(matches[0], parsed.fragment);
  if (matches.length > 1) {
    return {
      candidates: matches.map((candidate) => candidate.relativePath).sort(),
      status: "ambiguous",
    };
  }
  return { status: "missing" };
}
