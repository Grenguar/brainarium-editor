import type {
  VaultSearchResult,
  VaultSnapshot,
} from "../../shared/contracts/vault";

import { readVaultDocument } from "./vault-reader";

export async function searchVault(
  snapshot: VaultSnapshot,
  query: string,
): Promise<VaultSearchResult[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const results = await Promise.all(
    snapshot.documents.map(async (document) => {
      const content = await readVaultDocument(snapshot, document.relativePath);
      const haystack = content.text.toLocaleLowerCase();
      const first = haystack.indexOf(normalizedQuery);
      if (first === -1) return undefined;
      let matches = 0;
      let from = first;
      while (from !== -1) {
        matches += 1;
        from = haystack.indexOf(normalizedQuery, from + normalizedQuery.length);
      }
      const start = Math.max(0, first - 72);
      const end = Math.min(content.text.length, first + query.length + 128);
      return {
        kind: document.kind,
        matches,
        relativePath: document.relativePath,
        snippet: content.text.slice(start, end).replace(/\s+/g, " "),
        title: document.title,
      };
    }),
  );
  return results
    .filter((result): result is VaultSearchResult => Boolean(result))
    .sort(
      (left, right) =>
        right.matches - left.matches ||
        left.relativePath.localeCompare(right.relativePath),
    )
    .slice(0, 50);
}
