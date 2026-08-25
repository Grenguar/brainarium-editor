import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Graph from "graphology";
import Sigma from "sigma";

import type {
  BrainariumAppInfo,
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

const graphScope = (
  graph: VaultLinkGraph,
  center: string | undefined,
  depth: number,
): VaultLinkGraph => {
  if (!center) return graph;
  const neighbours = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    const source = neighbours.get(edge.source) ?? new Set<string>();
    source.add(edge.target);
    neighbours.set(edge.source, source);
    const target = neighbours.get(edge.target) ?? new Set<string>();
    target.add(edge.source);
    neighbours.set(edge.target, target);
  }
  const included = new Set([center]);
  let frontier = new Set([center]);
  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const next = new Set<string>();
    for (const node of frontier) {
      for (const neighbour of neighbours.get(node) ?? []) {
        if (!included.has(neighbour)) {
          included.add(neighbour);
          next.add(neighbour);
        }
      }
    }
    frontier = next;
  }
  return {
    edges: graph.edges.filter(
      (edge) => included.has(edge.source) && included.has(edge.target),
    ),
    nodes: graph.nodes.filter((node) => included.has(node.relativePath)),
  };
};

const SigmaGraphPreview = ({
  graph,
  query,
  onOpenDocument,
}: {
  graph: VaultLinkGraph;
  query: string;
  onOpenDocument: (relativePath: string) => void;
}): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const openDocumentRef = useRef(onOpenDocument);

  useEffect(() => {
    openDocumentRef.current = onOpenDocument;
  }, [onOpenDocument]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const search = query.trim().toLocaleLowerCase();
    const visible = new Set(
      graph.nodes
        .filter(
          (node) =>
            !search ||
            node.title.toLocaleLowerCase().includes(search) ||
            node.relativePath.toLocaleLowerCase().includes(search),
        )
        .map((node) => node.relativePath),
    );
    const displayGraph = new Graph({ type: "directed" });
    const degrees = new Map<string, number>();
    for (const edge of graph.edges) {
      degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
    }
    graph.nodes.forEach((node, index) => {
      const angle = index * 2.399963229728653;
      const radius = Math.sqrt(index + 1);
      const degree = degrees.get(node.relativePath) ?? 0;
      displayGraph.addNode(node.relativePath, {
        color: degree > 0 ? "#d86d45" : "#9aa39d",
        forceLabel: degree > 3,
        hidden: !visible.has(node.relativePath),
        label: node.title,
        size: Math.min(9, 2.7 + Math.sqrt(degree) * 1.2),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });
    graph.edges.forEach((edge, index) => {
      if (
        displayGraph.hasNode(edge.source) &&
        displayGraph.hasNode(edge.target)
      ) {
        displayGraph.addDirectedEdgeWithKey(
          `${edge.source}\u0000${edge.target}\u0000${index}`,
          edge.source,
          edge.target,
          { color: "#b57a65", size: 1 },
        );
      }
    });
    if (displayGraph.order > 1 && displayGraph.size > 0) {
      forceAtlas2.assign(displayGraph, {
        iterations: Math.min(180, Math.max(45, displayGraph.order * 4)),
        settings: {
          barnesHutOptimize: displayGraph.order > 120,
          gravity: 1,
          scalingRatio: 2.2,
          slowDown: 2,
          strongGravityMode: true,
        },
      });
    }
    const renderer = new Sigma(displayGraph, container, {
      defaultEdgeColor: "#b57a65",
      defaultNodeColor: "#9aa39d",
      labelColor: { color: "#273330" },
      labelDensity: 0.7,
      labelFont: "Avenir Next, Avenir, sans-serif",
      labelRenderedSizeThreshold: 8,
      labelSize: 13,
      stagePadding: 44,
      zIndex: true,
    });
    renderer.on("clickNode", ({ node }) => openDocumentRef.current(node));
    renderer.on("enterNode", ({ node }) => {
      const related = new Set([...displayGraph.neighbors(node), node]);
      displayGraph.forEachNode((key) => {
        displayGraph.setNodeAttribute(
          key,
          "color",
          related.has(key) ? "#d86d45" : "#c3c7c1",
        );
      });
      renderer.refresh();
    });
    renderer.on("leaveNode", () => {
      displayGraph.forEachNode((key) => {
        displayGraph.setNodeAttribute(
          key,
          "color",
          (degrees.get(key) ?? 0) > 0 ? "#d86d45" : "#9aa39d",
        );
      });
      renderer.refresh();
    });
    return () => renderer.kill();
  }, [graph, query]);

  return (
    <figure className="vault-graph">
      <div
        aria-label="Vault link graph"
        className="vault-graph-canvas"
        ref={containerRef}
        role="application"
      />
      <figcaption>
        {graph.edges.length === 0
          ? "No resolved wiki-links yet. Add [[a-note]] links to connect notes."
          : "Drag to explore, scroll to zoom, and select a note to open it."}
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

const defaultAppInfo: BrainariumAppInfo = {
  description: "A local-first editor for the files you already trust.",
  name: "Brainarium",
  version: "",
};

const App = (): React.JSX.Element => {
  const [appInfo, setAppInfo] = useState<BrainariumAppInfo>(defaultAppInfo);
  const [snapshot, setSnapshot] = useState<VaultSnapshot>();
  const [document, setDocument] = useState<VaultDocumentContent>();
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "editor">("preview");
  const [editorText, setEditorText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLinkGraph, setIsLoadingLinkGraph] = useState(false);
  const [linkGraph, setLinkGraph] = useState<VaultLinkGraph>();
  const [workspaceView, setWorkspaceView] = useState<"document" | "graph">(
    "document",
  );
  const [graphMode, setGraphMode] = useState<"global" | "local">("global");
  const [graphQuery, setGraphQuery] = useState("");
  const [localGraphDepth, setLocalGraphDepth] = useState(1);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [vaultSearchResults, setVaultSearchResults] = useState<
    VaultSearchResult[]
  >([]);
  const [externalChangeNotice, setExternalChangeNotice] = useState<string>();
  const [isVaultSearchOpen, setIsVaultSearchOpen] = useState(false);
  const [error, setError] = useState<string>();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const documentRef = useRef<VaultDocumentContent | undefined>(undefined);
  const editorTextRef = useRef("");
  const findPositionsInDocument = document
    ? findPositions(editorText, findQuery)
    : [];

  const refreshRecents = async (): Promise<void> => {
    setRecentVaults(await window.brainarium.listRecentVaults());
  };

  useEffect(() => {
    void refreshRecents();
  }, []);

  useEffect(() => {
    void window.brainarium.appInfo().then(setAppInfo);
  }, []);

  useEffect(() => {
    documentRef.current = document;
    editorTextRef.current = editorText;
  }, [document, editorText]);

  useEffect(
    () =>
      window.brainarium.onVaultChanged((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        const openDocument = documentRef.current;
        if (!openDocument) return;
        const stillExists = nextSnapshot.documents.some(
          (candidate) => candidate.relativePath === openDocument.relativePath,
        );
        if (!stillExists) {
          setDocument(undefined);
          setEditorText("");
          setExternalChangeNotice(
            "The open file was removed outside Brainarium.",
          );
          return;
        }
        if (
          openDocument.kind === "markdown" &&
          editorTextRef.current !== openDocument.text
        ) {
          setExternalChangeNotice(
            "This file changed outside Brainarium. Your unsaved editor changes were kept.",
          );
          return;
        }
        void window.brainarium
          .readDocument(openDocument.relativePath)
          .then((freshDocument) => {
            if (
              documentRef.current?.relativePath ===
                freshDocument.relativePath &&
              editorTextRef.current === documentRef.current.text
            ) {
              setDocument(freshDocument);
              setEditorText(freshDocument.text);
              setExternalChangeNotice(undefined);
            }
          })
          .catch(() => {
            setExternalChangeNotice(
              "The open file changed before Brainarium could refresh it.",
            );
          });
      }),
    [],
  );

  useEffect(
    () =>
      window.brainarium.onVaultGraphChanged((freshGraph) => {
        setLinkGraph(freshGraph);
      }),
    [],
  );

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
        setExternalChangeNotice(undefined);
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
      setExternalChangeNotice(undefined);
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
      setExternalChangeNotice(undefined);
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
      setExternalChangeNotice(undefined);
    } catch {
      setError(
        "Brainarium could not save this file. It may have changed outside the app.",
      );
    } finally {
      setIsSaving(false);
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

  const visibleGraph =
    linkGraph && graphMode === "local"
      ? graphScope(
          linkGraph,
          document?.kind === "markdown" ? document.relativePath : undefined,
          localGraphDepth,
        )
      : linkGraph;

  if (snapshot) {
    return (
      <main className="vault-shell">
        <aside className="vault-sidebar">
          <div className="vault-sidebar-heading">
            <div className="sidebar-app-identity">
              <span aria-hidden="true" className="sidebar-monogram">
                B
              </span>
              <div>
                <p className="sidebar-app-name">{appInfo.name}</p>
                <p className="sidebar-app-version">
                  {appInfo.version ? `v${appInfo.version}` : "Local app"}
                </p>
              </div>
            </div>
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
                {isLoadingLinkGraph
                  ? "Building graph…"
                  : "Build & open vault graph"}
              </button>
            </div>
            <p className="vault-graph-storage-hint">
              The graph is a rebuildable local index in
              <code>.brainarium/graph-v1.json</code>.
            </p>
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
                  <h2>
                    {graphMode === "global" ? "Vault graph" : "Local graph"}
                  </h2>
                  <p>
                    {visibleGraph
                      ? `${visibleGraph.nodes.length} notes · ${visibleGraph.edges.length} resolved links`
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
              <section className="graph-controls" aria-label="Graph controls">
                <div
                  className="graph-mode-toggle"
                  role="group"
                  aria-label="Graph scope"
                >
                  <button
                    className={graphMode === "global" ? "active" : ""}
                    type="button"
                    onClick={() => setGraphMode("global")}
                  >
                    Global
                  </button>
                  <button
                    className={graphMode === "local" ? "active" : ""}
                    disabled={document?.kind !== "markdown"}
                    title={
                      document?.kind === "markdown"
                        ? "Show links around this note"
                        : "Open a Markdown note to use local graph"
                    }
                    type="button"
                    onClick={() => setGraphMode("local")}
                  >
                    Local
                  </button>
                </div>
                <label className="graph-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    aria-label="Filter graph notes"
                    placeholder="Filter graph notes"
                    type="search"
                    value={graphQuery}
                    onChange={(event) => setGraphQuery(event.target.value)}
                  />
                </label>
                {graphMode === "local" && (
                  <label className="graph-depth">
                    Depth {localGraphDepth}
                    <input
                      aria-label="Local graph depth"
                      max="4"
                      min="1"
                      type="range"
                      value={localGraphDepth}
                      onChange={(event) =>
                        setLocalGraphDepth(Number(event.target.value))
                      }
                    />
                  </label>
                )}
              </section>
              {visibleGraph && (
                <SigmaGraphPreview
                  graph={visibleGraph}
                  query={graphQuery}
                  onOpenDocument={(relativePath) =>
                    void readDocument(relativePath)
                  }
                />
              )}
              <p className="graph-storage-note">
                Rebuildable index saved in .brainarium/graph-v1.json.
              </p>
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
          {externalChangeNotice && (
            <p className="notice">{externalChangeNotice}</p>
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
      <div className="brand-lockup">
        <div className="wordmark" aria-hidden="true">
          B
        </div>
        <div>
          <p className="brand-name">{appInfo.name}</p>
          <p className="brand-version">
            {appInfo.version ? `Version ${appInfo.version}` : "Local app"}
          </p>
        </div>
      </div>
      <p className="eyebrow">LOCAL-FIRST NOTEBOOK</p>
      <h1>A quiet place for the files you already trust.</h1>
      <p className="welcome-copy">
        {appInfo.description} Open any folder of Markdown, CSV, plain text,
        JSON, XML, and HTML files. Brainarium keeps the vault where it is and
        leaves its source in your hands.
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
