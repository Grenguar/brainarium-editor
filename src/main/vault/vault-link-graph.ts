import type {
  VaultLinkGraph,
  VaultSnapshot,
} from "../../shared/contracts/vault";

import { readVaultDocument } from "./vault-reader";

const wikiLink = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

export async function buildVaultLinkGraph(
  snapshot: VaultSnapshot,
): Promise<VaultLinkGraph> {
  const markdown = snapshot.documents.filter(
    (document) => document.kind === "markdown",
  );
  const lookup = new Map<string, string>();
  for (const document of markdown) {
    lookup.set(document.title.toLocaleLowerCase(), document.relativePath);
    lookup.set(
      document.relativePath
        .replace(/\.(?:md|markdown)$/i, "")
        .toLocaleLowerCase(),
      document.relativePath,
    );
  }
  const edges = new Set<string>();
  await Promise.all(
    markdown.map(async (document) => {
      const content = await readVaultDocument(snapshot, document.relativePath);
      for (const match of content.text.matchAll(wikiLink)) {
        const target = lookup.get(match[1].trim().toLocaleLowerCase());
        if (target && target !== document.relativePath)
          edges.add(`${document.relativePath}\u0000${target}`);
      }
    }),
  );
  return {
    edges: [...edges].map((edge) => {
      const [source, target] = edge.split("\u0000");
      return { source, target };
    }),
    nodes: markdown.map(({ relativePath, title }) => ({ relativePath, title })),
  };
}
