import GithubSlugger from "github-slugger";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, type ReactNode } from "react";

import type { VaultDocument } from "../../shared/contracts/vault";
import { LocalImage } from "./local-image";
import {
  resolveMarkdownLink,
  resolveWikiLink,
  type MarkdownLinkResolution,
} from "./link-resolver";
import { remarkWikiLinks } from "./remark-wiki-links";
import { brainariumSanitizeSchema } from "./sanitize-schema";

type DocumentNavigator = (relativePath: string, fragment?: string) => void;

type LeadingFrontmatter = {
  body: string;
  source: string;
};

function leadingFrontmatter(source: string): LeadingFrontmatter | undefined {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/.exec(source);
  if (!match) return undefined;
  return { body: source.slice(match[0].length), source: match[0] };
}

function nodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(nodeText).join("");
  if (value && typeof value === "object" && "props" in value) {
    return nodeText(
      (value as { props?: { children?: ReactNode } }).props?.children,
    );
  }
  return "";
}

function safeHref(value: string | undefined): string | undefined {
  if (
    !value ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return undefined;
  }
  if (value.startsWith("brainarium-wiki:") || value.startsWith("#"))
    return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    return undefined;
  }
  return value;
}

function safeImageSource(value: string | undefined): string | undefined {
  if (!value || value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return undefined;
  }
  return value;
}

type HastNode = {
  children?: HastNode[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
  value?: string;
};

/** Highlights rendered text only; the Markdown source is never changed. */
function rehypeFindHighlights(query: string, activeMatch: number) {
  const needle = query.toLocaleLowerCase();
  return () => (tree: HastNode) => {
    if (!needle) return;
    let matchIndex = 0;
    const visit = (node: HastNode): void => {
      if (!node.children) return;
      const children: HastNode[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !child.value) {
          visit(child);
          children.push(child);
          continue;
        }
        const lower = child.value.toLocaleLowerCase();
        let from = 0;
        let found = lower.indexOf(needle, from);
        if (found < 0) {
          children.push(child);
          continue;
        }
        while (found >= 0) {
          if (found > from) {
            children.push({
              type: "text",
              value: child.value.slice(from, found),
            });
          }
          const currentMatch = matchIndex++;
          children.push({
            type: "element",
            tagName: "mark",
            properties: {
              className: ["find-highlight"],
              dataFindActive: currentMatch === activeMatch ? "true" : "false",
              dataFindIndex: String(currentMatch),
            },
            children: [
              {
                type: "text",
                value: child.value.slice(found, found + query.length),
              },
            ],
          });
          from = found + query.length;
          found = lower.indexOf(needle, from);
        }
        if (from < child.value.length) {
          children.push({ type: "text", value: child.value.slice(from) });
        }
      }
      node.children = children;
    };
    visit(tree);
  };
}

function describeResolution(resolution: MarkdownLinkResolution): string {
  if (resolution.status === "missing") return "This note is not in the vault.";
  if (resolution.status === "ambiguous") {
    return `Several notes match: ${resolution.candidates.join(", ")}.`;
  }
  return "";
}

function BrokenLink({
  children,
  resolution,
}: {
  children: ReactNode;
  resolution: MarkdownLinkResolution;
}): React.JSX.Element {
  return (
    <span
      aria-label={`Unresolved link: ${describeResolution(resolution)}`}
      className={`wiki-link wiki-link-${resolution.status}`}
      role="status"
      title={describeResolution(resolution)}
    >
      {children}
    </span>
  );
}

export const MarkdownReading = ({
  activeFindMatch = -1,
  documents,
  findQuery = "",
  onOpenDocument,
  onOpenExternal,
  source,
  sourceRelativePath,
}: {
  activeFindMatch?: number;
  documents: readonly VaultDocument[];
  findQuery?: string;
  onOpenDocument: DocumentNavigator;
  onOpenExternal: (target: string) => void;
  source: string;
  sourceRelativePath: string;
}): React.JSX.Element => {
  const frontmatter = useMemo(() => leadingFrontmatter(source), [source]);
  const slugger = useMemo(() => new GithubSlugger(), [source]);

  useEffect(() => {
    if (activeFindMatch < 0) return;
    document
      .querySelector<HTMLElement>(`mark[data-find-index="${activeFindMatch}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeFindMatch, findQuery]);

  const components = useMemo<Components>(() => {
    const heading = (Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") => {
      return ({ children }: { children?: ReactNode }) => (
        <Tag id={slugger.slug(nodeText(children))}>{children}</Tag>
      );
    };
    return {
      a: ({ children, href }) => {
        if (href?.startsWith("brainarium-wiki:")) {
          let target: string;
          try {
            target = decodeURIComponent(href.slice("brainarium-wiki:".length));
          } catch {
            return (
              <BrokenLink resolution={{ status: "missing" }}>
                {children}
              </BrokenLink>
            );
          }
          const resolution = resolveWikiLink(
            documents,
            sourceRelativePath,
            target,
          );
          return resolution.status === "resolved" ? (
            <button
              className="wiki-link"
              type="button"
              onClick={() =>
                onOpenDocument(resolution.relativePath, resolution.fragment)
              }
            >
              {children}
            </button>
          ) : (
            <BrokenLink resolution={resolution}>{children}</BrokenLink>
          );
        }
        if (href && /^https?:\/\//i.test(href)) {
          return (
            <button
              className="markdown-external-link"
              type="button"
              onClick={() => onOpenExternal(href)}
            >
              {children}
              <span aria-hidden="true"> ↗</span>
            </button>
          );
        }
        const resolution = resolveMarkdownLink(
          documents,
          sourceRelativePath,
          href ?? "",
        );
        return resolution.status === "resolved" ? (
          <button
            className="markdown-local-link"
            type="button"
            onClick={() =>
              onOpenDocument(resolution.relativePath, resolution.fragment)
            }
          >
            {children}
          </button>
        ) : (
          <BrokenLink resolution={resolution}>{children}</BrokenLink>
        );
      },
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      h4: heading("h4"),
      h5: heading("h5"),
      h6: heading("h6"),
      img: ({ alt, src, title }) => (
        <LocalImage
          alt={alt}
          sourceDocumentPath={sourceRelativePath}
          sourcePath={src}
          title={title}
        />
      ),
      input: ({ checked, type }) =>
        type === "checkbox" ? (
          <input checked={Boolean(checked)} disabled readOnly type="checkbox" />
        ) : null,
    };
  }, [documents, onOpenDocument, onOpenExternal, slugger, sourceRelativePath]);

  return (
    <article className="markdown-reading">
      {frontmatter && (
        <details className="markdown-properties">
          <summary>Properties</summary>
          <pre>
            <code>{frontmatter.source}</code>
          </pre>
        </details>
      )}
      <ReactMarkdown
        components={components}
        rehypePlugins={[
          rehypeRaw,
          rehypeFindHighlights(findQuery, activeFindMatch),
          [rehypeSanitize, brainariumSanitizeSchema],
        ]}
        remarkPlugins={[remarkFrontmatter, remarkGfm, remarkWikiLinks]}
        urlTransform={(value, key) =>
          key === "href"
            ? safeHref(value)
            : key === "src"
              ? safeImageSource(value)
              : undefined
        }
      >
        {frontmatter?.body ?? source}
      </ReactMarkdown>
    </article>
  );
};
