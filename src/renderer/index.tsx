import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type {
  RecentVault,
  VaultDocumentContent,
  VaultLinkGraph,
  VaultSearchResult,
  VaultSnapshot,
  VaultTreeNode,
} from "../shared/contracts/vault";

import { CsvPreview } from "./csv-preview";

import "./styles.css";

const TreeNode = ({
  node,
  onSelect,
}: {
  node: VaultTreeNode;
  onSelect: (relativePath: string) => void;
}): React.JSX.Element => {
  const [isOpen, setIsOpen] = useState(node.relativePath === "");
  if (node.kind !== "directory") {
    const icon =
      node.kind === "csv"
        ? "▦"
        : node.kind === "json"
          ? "{}"
          : node.kind === "xml" || node.kind === "html"
            ? "<>"
            : "⌁";
    return (
      <li>
        <button
          className="tree-file"
          type="button"
          onClick={() => onSelect(node.relativePath)}
        >
          <span aria-hidden="true">{icon}</span>
          {node.name}
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        className="tree-directory"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span aria-hidden="true">{isOpen ? "⌄" : "›"}</span>
        {node.name || "Vault"}
      </button>
      {isOpen && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.relativePath}
              node={child}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const renderInline = (
  text: string,
  onWikiLink?: (target: string) => void,
): ReactNode[] => {
  const parts = text.split(
    /(\[\[[^\]]+\]\]|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g,
  );
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const [target, alias] = part.slice(2, -2).split("|");
      const label = alias || target;
      return (
        <button
          className="wiki-link"
          key={index}
          type="button"
          onClick={() => onWikiLink?.(target.split("#")[0].trim())}
        >
          {label}
        </button>
      );
    }
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
    if (link) {
      const isExternal = /^https?:\/\//.test(link[2]);
      return isExternal ? (
        <a key={index} href={link[2]} rel="noreferrer" target="_blank">
          {link[1]}
        </a>
      ) : (
        <span key={index}>{link[1]}</span>
      );
    }
    return part;
  });
};

const MarkdownReading = ({
  source,
  onWikiLink,
}: {
  onWikiLink: (target: string) => void;
  source: string;
}): React.JSX.Element => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let cursor = 0;
  if (lines[0] === "---") {
    const closing = lines.indexOf("---", 1);
    if (closing > 0) cursor = closing + 1;
  }
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) {
      cursor += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !lines[cursor].startsWith("```"))
        code.push(lines[cursor++]);
      cursor += 1;
      blocks.push(
        <pre className="reading-code" key={cursor}>
          <code data-language={language}>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(
        <Tag key={cursor}>{renderInline(heading[2], onWikiLink)}</Tag>,
      );
      cursor += 1;
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (cursor < lines.length && /^[-*+]\s+/.test(lines[cursor]))
        items.push(lines[cursor++].replace(/^[-*+]\s+/, ""));
      blocks.push(
        <ul key={cursor}>
          {items.map((item, index) => (
            <li key={index}>{renderInline(item, onWikiLink)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote key={cursor}>
          {renderInline(line.replace(/^>\s?/, ""), onWikiLink)}
        </blockquote>,
      );
      cursor += 1;
      continue;
    }
    if (
      line.includes("|") &&
      cursor + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
        lines[cursor + 1],
      )
    ) {
      const tableLines = [line];
      cursor += 2;
      while (cursor < lines.length && lines[cursor].includes("|"))
        tableLines.push(lines[cursor++]);
      const cells = (tableLine: string) =>
        tableLine
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());
      const [header, ...rows] = tableLines.map(cells);
      blocks.push(
        <div className="reading-table-wrap" key={cursor}>
          <table>
            <thead>
              <tr>
                {header.map((cell, index) => (
                  <th key={index}>{renderInline(cell, onWikiLink)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((_cell, cellIndex) => (
                    <td key={cellIndex}>
                      {renderInline(row[cellIndex] ?? "", onWikiLink)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (
      cursor < lines.length &&
      lines[cursor].trim() &&
      !/^(#{1,3}\s|```|[-*+]\s|>\s?)/.test(lines[cursor])
    )
      paragraph.push(lines[cursor++]);
    blocks.push(
      <p key={cursor}>{renderInline(paragraph.join(" "), onWikiLink)}</p>,
    );
  }
  return <article className="markdown-reading">{blocks}</article>;
};

const LinkGraphPreview = ({
  graph,
  onOpenDocument,
}: {
  graph: VaultLinkGraph;
  onOpenDocument: (relativePath: string) => void;
}): React.JSX.Element => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(graph.nodes.length)));
  const rows = Math.max(1, Math.ceil(graph.nodes.length / columns));
  const positions = new Map(
    graph.nodes.map((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = ((column + 0.5) / columns) * 1000;
      const y = ((row + 0.5) / rows) * 600;
      return [
        node.relativePath,
        { left: (x / 1000) * 100, top: (y / 600) * 100, x, y },
      ];
    }),
  );
  const connected = new Set(
    graph.edges.flatMap((edge) => [edge.source, edge.target]),
  );

  return (
    <figure className="vault-graph">
      <div className="vault-graph-canvas">
        <svg
          aria-hidden="true"
          className="vault-graph-lines"
          viewBox="0 0 1000 600"
        >
          {graph.edges.map((edge) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                x2={target.x}
                y1={source.y}
                y2={target.y}
              />
            );
          })}
        </svg>
        {graph.nodes.map((node) => {
          const position = positions.get(node.relativePath);
          if (!position) return null;
          return (
            <button
              className={
                connected.has(node.relativePath)
                  ? "graph-node linked"
                  : "graph-node"
              }
              key={node.relativePath}
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
              title={`Open ${node.relativePath}`}
              type="button"
              onClick={() => onOpenDocument(node.relativePath)}
            >
              <span aria-hidden="true" />
              <span>{node.title}</span>
            </button>
          );
        })}
      </div>
      <figcaption>
        {graph.edges.length === 0
          ? "No resolved wiki-links yet. Add [[a-note]] links to connect notes."
          : "Each line is a resolved wiki-link. Select a note to open it."}
      </figcaption>
    </figure>
  );
};

const findPositions = (text: string, query: string): number[] => {
  if (!query) return [];
  const positions: number[] = [];
  const needle = query.toLocaleLowerCase();
  const haystack = text.toLocaleLowerCase();
  let from = 0;
  while (from < haystack.length) {
    const found = haystack.indexOf(needle, from);
    if (found === -1) break;
    positions.push(found);
    from = found + Math.max(needle.length, 1);
  }
  return positions;
};

const EyeIcon = (): React.JSX.Element => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
    <path
      d="M2.5 12s3.4-5.5 9.5-5.5S21.5 12 21.5 12 18.1 17.5 12 17.5 2.5 12 2.5 12Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <circle cx="12" cy="12" fill="currentColor" r="2.3" />
  </svg>
);

const App = (): React.JSX.Element => {
  const [snapshot, setSnapshot] = useState<VaultSnapshot>();
  const [document, setDocument] = useState<VaultDocumentContent>();
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "editor">("preview");
  const [editorText, setEditorText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isBuildingGraph, setIsBuildingGraph] = useState(false);
  const [isLoadingLinkGraph, setIsLoadingLinkGraph] = useState(false);
  const [linkGraph, setLinkGraph] = useState<VaultLinkGraph>();
  const [graphStatus, setGraphStatus] = useState<string>();
  const [workspaceView, setWorkspaceView] = useState<"document" | "graph">(
    "document",
  );
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [vaultSearchResults, setVaultSearchResults] = useState<
    VaultSearchResult[]
  >([]);
  const [isVaultSearchOpen, setIsVaultSearchOpen] = useState(false);
  const [error, setError] = useState<string>();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const findPositionsInDocument = document
    ? findPositions(editorText, findQuery)
    : [];

  const refreshRecents = async (): Promise<void> => {
    setRecentVaults(await window.brainarium.listRecentVaults());
  };

  useEffect(() => {
    void refreshRecents();
  }, []);

  const chooseVault = async (): Promise<void> => {
    setIsChoosing(true);
    setError(undefined);
    try {
      const result = await window.brainarium.chooseVault();
      if (!result.cancelled) {
        setSnapshot(result.snapshot);
        setDocument(undefined);
        setEditorText("");
        setCopied(false);
        setFindQuery("");
        setLinkGraph(undefined);
        setWorkspaceView("document");
        await refreshRecents();
      }
    } catch {
      setError(
        "Brainarium could not open that folder. Check its permissions and try again.",
      );
    } finally {
      setIsChoosing(false);
    }
  };

  const openRecentVault = async (id: string): Promise<void> => {
    setError(undefined);
    try {
      setSnapshot(await window.brainarium.openRecentVault(id));
      setDocument(undefined);
      setEditorText("");
      setCopied(false);
      setFindQuery("");
      setLinkGraph(undefined);
      setWorkspaceView("document");
      await refreshRecents();
    } catch {
      setError("That vault is unavailable. Choose another folder to continue.");
    }
  };

  const readDocument = async (relativePath: string): Promise<void> => {
    setError(undefined);
    try {
      const nextDocument = await window.brainarium.readDocument(relativePath);
      setDocument(nextDocument);
      setEditorText(nextDocument.text);
      setCopied(false);
      setFindQuery("");
      setFindIndex(0);
      setWorkspaceView("document");
    } catch {
      setError(
        "Brainarium could not read that file. It may have changed outside the vault.",
      );
    }
  };

  const saveDocument = async (): Promise<void> => {
    if (!document || document.kind !== "markdown") return;
    setIsSaving(true);
    setError(undefined);
    try {
      const saved = await window.brainarium.saveDocument({
        baseVersion: document.version,
        relativePath: document.relativePath,
        text: editorText,
      });
      setDocument(saved);
      setEditorText(saved.text);
      setLinkGraph(undefined);
    } catch {
      setError(
        "Brainarium could not save this file. It may have changed outside the app.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const buildGraph = async (): Promise<void> => {
    setIsBuildingGraph(true);
    setGraphStatus(undefined);
    try {
      const graph = await window.brainarium.buildGraph();
      setGraphStatus(
        graph.nodeCount > 0
          ? `Graphify analysed ${graph.nodeCount} code nodes without an LLM.`
          : "Graphify completed, but found no code nodes in this text vault.",
      );
    } catch {
      setGraphStatus(
        "Graphify is unavailable. Install graphify-rs or set BRAINARIUM_GRAPHIFY_BIN, then try again.",
      );
    } finally {
      setIsBuildingGraph(false);
    }
  };

  const openLinkGraph = async (): Promise<void> => {
    setIsLoadingLinkGraph(true);
    setError(undefined);
    try {
      setLinkGraph(await window.brainarium.buildVaultLinkGraph());
      setWorkspaceView("graph");
    } catch {
      setError("Brainarium could not build the vault link graph.");
    } finally {
      setIsLoadingLinkGraph(false);
    }
  };

  const openWikiLink = (target: string): void => {
    if (!snapshot) return;
    const normalized = target.toLocaleLowerCase();
    const resolved = snapshot.documents.find(
      (candidate) =>
        candidate.kind === "markdown" &&
        (candidate.title.toLocaleLowerCase() === normalized ||
          candidate.relativePath
            .replace(/\.(?:md|markdown)$/i, "")
            .toLocaleLowerCase() === normalized),
    );
    if (resolved) {
      void readDocument(resolved.relativePath);
    } else {
      setError(`No Markdown note named “${target}” exists in this vault.`);
    }
  };

  const copyDocumentContent = async (): Promise<void> => {
    if (!document) {
      return;
    }
    setIsCopying(true);
    try {
      await window.brainarium.copyDocumentContent(document.relativePath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Brainarium could not copy that file. Try opening it again.");
    } finally {
      setIsCopying(false);
    }
  };

  const moveFind = (direction: 1 | -1): void => {
    if (findPositionsInDocument.length === 0) return;
    const nextIndex =
      (findIndex + direction + findPositionsInDocument.length) %
      findPositionsInDocument.length;
    setFindIndex(nextIndex);
    setViewMode("editor");
    window.setTimeout(() => {
      const from = findPositionsInDocument[nextIndex];
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(from, from + findQuery.length);
    }, 0);
  };

  const searchVault = async (): Promise<void> => {
    if (!vaultSearchQuery.trim()) {
      setVaultSearchResults([]);
      return;
    }
    try {
      setVaultSearchResults(
        await window.brainarium.searchVault(vaultSearchQuery),
      );
    } catch {
      setError("Brainarium could not search this vault.");
    }
  };

  if (snapshot) {
    return (
      <main className="vault-shell">
        <aside className="vault-sidebar">
          <div className="vault-sidebar-heading">
            <p className="eyebrow">OPEN VAULT</p>
            <h1>{snapshot.tree.name}</h1>
            <p>{snapshot.documents.length} readable documents</p>
            <div className="vault-actions">
              <button
                className="vault-action-primary"
                type="button"
                onClick={() => void chooseVault()}
                disabled={isChoosing}
              >
                Open another vault
              </button>
              <button
                className="vault-action-secondary"
                type="button"
                onClick={() => void openLinkGraph()}
                disabled={isLoadingLinkGraph}
              >
                {isLoadingLinkGraph ? "Building graph…" : "Open vault graph"}
              </button>
            </div>
          </div>
          <div className="vault-search-controls">
            <button
              aria-label="Search this vault"
              className="icon-action"
              title="Search this vault"
              type="button"
              onClick={() => setIsVaultSearchOpen(!isVaultSearchOpen)}
            >
              ⌕
            </button>
            {isVaultSearchOpen && (
              <form
                className="vault-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchVault();
                }}
              >
                <input
                  aria-label="Search this vault"
                  autoFocus
                  placeholder="Search all files"
                  type="search"
                  value={vaultSearchQuery}
                  onChange={(event) => setVaultSearchQuery(event.target.value)}
                />
                <button type="submit">Search</button>
              </form>
            )}
          </div>
          {isVaultSearchOpen && vaultSearchResults.length > 0 && (
            <section
              className="vault-search-results"
              aria-label="Vault search results"
            >
              {vaultSearchResults.map((result) => (
                <button
                  key={result.relativePath}
                  type="button"
                  onClick={() => void readDocument(result.relativePath)}
                >
                  <strong>{result.title}</strong>
                  <span>{result.snippet}</span>
                </button>
              ))}
            </section>
          )}
          <section className="vault-tree" aria-label="Vault files">
            <p className="section-label">FILES</p>
            <ul>
              <TreeNode
                node={snapshot.tree}
                onSelect={(relativePath) => void readDocument(relativePath)}
              />
            </ul>
          </section>
          {recentVaults.length > 0 && (
            <nav className="recent-vaults" aria-label="Recent vaults">
              <p className="section-label">RECENT VAULTS</p>
              {recentVaults.map((recent) => (
                <button
                  key={recent.id}
                  type="button"
                  onClick={() => void openRecentVault(recent.id)}
                >
                  {recent.name}
                </button>
              ))}
            </nav>
          )}
        </aside>
        <section className="document-workspace" aria-label="Document workspace">
          {workspaceView === "graph" ? (
            <>
              <header className="document-toolbar graph-toolbar">
                <div>
                  <p className="section-label">LOCAL, NO-LLM</p>
                  <h2>Vault graph</h2>
                  <p>
                    {linkGraph
                      ? `${linkGraph.nodes.length} notes · ${linkGraph.edges.length} resolved links`
                      : "Building your note graph…"}
                  </p>
                </div>
                <button
                  className="vault-action-secondary"
                  type="button"
                  onClick={() => void openLinkGraph()}
                  disabled={isLoadingLinkGraph}
                >
                  Refresh graph
                </button>
              </header>
              {linkGraph && (
                <LinkGraphPreview
                  graph={linkGraph}
                  onOpenDocument={(relativePath) =>
                    void readDocument(relativePath)
                  }
                />
              )}
              <section
                className="graphify-callout"
                aria-label="Graphify analysis"
              >
                <div>
                  <p className="section-label">OPTIONAL CODE ANALYSIS</p>
                  <p>
                    Graphify is kept separate from note navigation: its
                    deterministic mode analyses code, not Markdown links.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void buildGraph()}
                  disabled={isBuildingGraph}
                >
                  {isBuildingGraph ? "Analysing…" : "Run Graphify"}
                </button>
              </section>
              {graphStatus && <p className="graph-status">{graphStatus}</p>}
            </>
          ) : document ? (
            <>
              <header className="document-toolbar">
                <div>
                  <p className="section-label">{document.kind.toUpperCase()}</p>
                  <h2>{document.title}</h2>
                </div>
                <div className="toolbar-actions">
                  {document.kind === "markdown" && (
                    <button
                      aria-label="Find in file"
                      className="icon-action"
                      title="Find in file"
                      type="button"
                      onClick={() => {
                        setIsFindOpen(true);
                        setViewMode("editor");
                      }}
                    >
                      ⌕
                    </button>
                  )}
                  {document.kind === "markdown" && (
                    <div
                      className="view-toggle"
                      role="group"
                      aria-label="Document view"
                    >
                      <button
                        aria-label="Preview"
                        className={viewMode === "preview" ? "active" : ""}
                        title="Preview"
                        type="button"
                        onClick={() => setViewMode("preview")}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        aria-label="Editor"
                        className={viewMode === "editor" ? "active" : ""}
                        title="Editor"
                        type="button"
                        onClick={() => setViewMode("editor")}
                      >
                        {"</>"}
                      </button>
                    </div>
                  )}
                  {document.kind === "markdown" && viewMode === "editor" && (
                    <button
                      type="button"
                      onClick={() => void saveDocument()}
                      disabled={isSaving || editorText === document.text}
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void copyDocumentContent()}
                    disabled={isCopying}
                  >
                    {copied
                      ? "Copied!"
                      : isCopying
                        ? "Copying…"
                        : "Copy file content"}
                  </button>
                </div>
              </header>
              {document.kind === "markdown" && isFindOpen && (
                <form
                  className="find-bar"
                  onSubmit={(event) => {
                    event.preventDefault();
                    moveFind(1);
                  }}
                >
                  <span aria-hidden="true">⌕</span>
                  <input
                    aria-label="Find in file"
                    autoFocus
                    placeholder="Find in this file"
                    type="search"
                    value={findQuery}
                    onChange={(event) => {
                      setFindQuery(event.target.value);
                      setFindIndex(0);
                    }}
                  />
                  <span className="find-count">
                    {findQuery
                      ? `${findPositionsInDocument.length} matches`
                      : "Type to search"}
                  </span>
                  <button
                    aria-label="Previous match"
                    type="button"
                    onClick={() => moveFind(-1)}
                    disabled={findPositionsInDocument.length === 0}
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Next match"
                    type="submit"
                    disabled={findPositionsInDocument.length === 0}
                  >
                    ↓
                  </button>
                  <button
                    aria-label="Close find"
                    type="button"
                    onClick={() => setIsFindOpen(false)}
                  >
                    ×
                  </button>
                </form>
              )}
              {document.kind === "markdown" && viewMode === "preview" ? (
                <MarkdownReading
                  source={document.text}
                  onWikiLink={openWikiLink}
                />
              ) : document.kind === "markdown" ? (
                <textarea
                  aria-label="Markdown editor"
                  className="document-editor"
                  ref={editorRef}
                  value={editorText}
                  onChange={(event) => setEditorText(event.target.value)}
                  spellCheck
                />
              ) : document.kind === "csv" ? (
                <CsvPreview source={document.text} />
              ) : (
                <pre className="document-source">{document.text}</pre>
              )}
            </>
          ) : (
            <div className="document-empty">
              <p className="eyebrow">BROWSE YOUR VAULT</p>
              <h2>Choose a file to read.</h2>
              <p>
                Markdown opens in a rendered preview; every supported file has
                an exact source view.
              </p>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {snapshot.issues.length > 0 && (
            <p className="notice">
              {snapshot.issues.length} unavailable item
              {snapshot.issues.length === 1 ? "" : "s"} stayed outside this
              vault.
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="welcome-shell">
      <div className="wordmark" aria-hidden="true">
        B.
      </div>
      <p className="eyebrow">LOCAL-FIRST NOTEBOOK</p>
      <h1>A quiet place for the files you already trust.</h1>
      <p className="welcome-copy">
        Open any folder of Markdown, CSV, plain text, JSON, XML, and HTML files.
        Brainarium keeps the vault where it is and leaves its source in your
        hands.
      </p>
      <button
        className="primary-action"
        type="button"
        onClick={() => void chooseVault()}
        disabled={isChoosing}
      >
        {isChoosing ? "Opening folder picker…" : "Open a vault"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="welcome-note">
        Supported text files stay local. Nothing is imported or copied.
      </p>
      {recentVaults.length > 0 && (
        <nav className="recent-vaults" aria-label="Recent vaults">
          <p className="section-label">RECENT VAULTS</p>
          {recentVaults.map((recent) => (
            <button
              key={recent.id}
              type="button"
              onClick={() => void openRecentVault(recent.id)}
            >
              {recent.name}
            </button>
          ))}
        </nav>
      )}
    </main>
  );
};

const root = document.getElementById("root");

if (!root) {
  throw new Error("Brainarium could not find its renderer root.");
}

createRoot(root).render(<App />);
