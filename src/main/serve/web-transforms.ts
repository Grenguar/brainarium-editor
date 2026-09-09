import GithubSlugger from "github-slugger";

import type { VaultDocument } from "../../shared/contracts/vault";
import {
  resolveMarkdownLink,
  resolveWikiLink,
} from "../../shared/markdown/link-resolver";
import type { HastNode, HastTransform } from "../export/export-html";
import { visitElements } from "../export/export-html";

const WIKI_PREFIX = "brainarium-wiki:";

/** Encodes each segment so spaces and punctuation survive, keeping the slashes. */
export const documentUrl = (
  relativePath: string,
  fragment?: string,
): string => {
  const path = relativePath.split("/").map(encodeURIComponent).join("/");
  return `/n/${path}${fragment ? `#${encodeURIComponent(fragment)}` : ""}`;
};

export const assetUrl = (relativePath: string): string =>
  `/asset/${relativePath.split("/").map(encodeURIComponent).join("/")}`;

const textOf = (node: HastNode): string =>
  node.type === "text"
    ? (node.value ?? "")
    : (node.children ?? []).map(textOf).join("");

const asInertSpan = (node: HastNode, reason: string): void => {
  node.tagName = "span";
  node.properties = {
    className: ["wiki-link", "wiki-link-missing"],
    title: reason,
  };
};

/**
 * Turns in-app links into real URLs.
 *
 * The reading view resolves `brainarium-wiki:` hrefs itself inside a React
 * component; a served page has no such hook, so resolution happens here and the
 * href becomes a route. Unresolved links become inert spans rather than dead
 * anchors, matching what the desktop reader shows. External links are left for
 * the sanitizer to vet.
 */
export const rewriteLinks =
  (
    documents: readonly VaultDocument[],
    sourceRelativePath: string,
  ): HastTransform =>
  (tree) => {
    visitElements(tree, "a", (node) => {
      const href = node.properties?.href;
      if (typeof href !== "string") return;

      if (/^https?:\/\//i.test(href)) {
        node.properties = {
          ...node.properties,
          rel: "noreferrer noopener",
          target: "_blank",
        };
        return;
      }

      const isWiki = href.startsWith(WIKI_PREFIX);
      let target = href;
      if (isWiki) {
        try {
          target = decodeURIComponent(href.slice(WIKI_PREFIX.length));
        } catch {
          asInertSpan(node, "This link could not be read.");
          return;
        }
      } else if (href.startsWith("#")) {
        return;
      }

      const resolution = isWiki
        ? resolveWikiLink(documents, sourceRelativePath, target)
        : resolveMarkdownLink(documents, sourceRelativePath, target);

      if (resolution.status === "resolved") {
        node.properties = {
          ...node.properties,
          href: documentUrl(resolution.relativePath, resolution.fragment),
        };
        return;
      }
      asInertSpan(
        node,
        resolution.status === "ambiguous"
          ? `Several notes match: ${resolution.candidates.join(", ")}.`
          : "This note is not in the vault.",
      );
    });
  };

/**
 * Gives headings the same slug ids the reading view assigns, so `#fragment`
 * links resolve to the same anchors on both surfaces.
 */
export const addHeadingIds = (): HastTransform => (tree) => {
  const slugger = new GithubSlugger();
  const headings = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
  // Document order, one pass: the slugger's duplicate counter must see headings
  // in the same sequence the reading view does, or the ids diverge and every
  // fragment link into a repeated heading lands on the wrong one.
  const walk = (node: HastNode): void => {
    if (node.type === "element" && node.tagName && headings.has(node.tagName)) {
      node.properties = { ...node.properties, id: slugger.slug(textOf(node)) };
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
};
