import { findAndReplace } from "mdast-util-find-and-replace";
import type { PhrasingContent, Root } from "mdast";

const WIKI_LINK_PATTERN = /(?<!\\)\[\[([^\]\n]+)\]\]/g;

/**
 * Turns wiki-link text nodes into ordinary AST links. `findAndReplace` skips
 * fenced/inline code and existing links, so code samples retain literal
 * [[syntax]] and we never nest anchors.
 */
export function remarkWikiLinks() {
  return (tree: Root): void => {
    findAndReplace(
      tree,
      [
        WIKI_LINK_PATTERN,
        (match: string): PhrasingContent | false => {
          const content = match.slice(2, -2);
          const separator = content.indexOf("|");
          const target = (
            separator === -1 ? content : content.slice(0, separator)
          ).trim();
          const label = (
            separator === -1 ? target : content.slice(separator + 1)
          ).trim();
          if (!target) return false;
          return {
            children: [{ type: "text", value: label || target }],
            type: "link",
            url: `brainarium-wiki:${encodeURIComponent(target)}`,
          };
        },
      ],
      { ignore: ["code", "inlineCode", "link", "linkReference"] },
    );
  };
}
