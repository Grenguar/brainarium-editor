import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Graph from "graphology";
import Sigma from "sigma";
import { getDocument, type RenderTask } from "pdfjs-dist/webpack.mjs";

import type {
  BrainariumAppInfo,
  DocumentReviewState,
  DocumentKind,
  MarkdownChangeReview,
  RecentVault,
  VaultDocumentContent,
  VaultLinkGraph,
  VaultSearchResult,
  VaultSessionState,
  VaultSnapshot,
  VaultTreeNode,
} from "../shared/contracts/vault";

import { hasTextContent } from "../shared/documents";
import { CsvPreview } from "./csv-preview";
import { changedCounts } from "./changed-counts";
import { ChangeReviewPanel } from "./change-review-panel";
import { ChangesView } from "./changes-view";
import { DocumentConflictPanel } from "./document-conflict-panel";
import {
  documentSessionReducer,
  emptyDocumentSession,
} from "./document-session";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorMode,
} from "./editor/markdown-editor";
import { MarkdownReading } from "./markdown/markdown-reading";
import {
  shortcutLabels,
  shortcutPlatform,
  usesPrimaryModifier,
} from "./shortcuts";

import "./styles.css";

const currentShortcutPlatform = shortcutPlatform(navigator.userAgent);
const platformShortcuts = shortcutLabels(currentShortcutPlatform);

const TreeNode = ({
  activePath,
  changedPaths,
  directoryCounts,
  node,
  onFileContextMenu,
  onSelect,
}: {
  activePath?: string;
  changedPaths: ReadonlySet<string>;
  directoryCounts: ReadonlyMap<string, number>;
  node: VaultTreeNode;
  onFileContextMenu: (
    relativePath: string,
    kind: DocumentKind,
    position: { x: number; y: number },
  ) => void;
  onSelect: (relativePath: string) => void;
}): React.JSX.Element => {
  const changedDescendants = directoryCounts.get(node.relativePath) ?? 0;
  const hasChangedDescendant =
    node.kind === "directory"
      ? changedDescendants > 0
      : changedPaths.has(node.relativePath);
  const [isOpen, setIsOpen] = useState(
    node.relativePath === "" || hasChangedDescendant,
  );

  useEffect(() => {
    if (hasChangedDescendant) setIsOpen(true);
  }, [hasChangedDescendant]);

  if (node.kind !== "directory") {
    const icon =
      node.kind === "image"
        ? "▧"
        : node.kind === "csv"
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
          aria-current={activePath === node.relativePath ? "page" : undefined}
          type="button"
          onClick={() => onSelect(node.relativePath)}
          onContextMenu={(event) => {
            event.preventDefault();
            onFileContextMenu(node.relativePath, node.kind, {
              x: event.clientX,
              y: event.clientY,
            });
          }}
        >
          {node.kind === "pdf" ? (
            <Icon name="pdf" />
          ) : (
            <span aria-hidden="true">{icon}</span>
          )}
          {node.name}
          {changedPaths.has(node.relativePath) && (
            <span
              aria-label="Changed since reviewed"
              className="tree-change-dot"
            />
          )}
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
        {changedDescendants > 0 && node.relativePath !== "" && (
          <span
            aria-label={`${changedDescendants} changed since reviewed`}
            className="tree-change-count"
          >
            {changedDescendants}
          </span>
        )}
      </button>
      {isOpen && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.relativePath}
              activePath={activePath}
              changedPaths={changedPaths}
              directoryCounts={directoryCounts}
              node={child}
              onFileContextMenu={onFileContextMenu}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
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

const defaultAppInfo: BrainariumAppInfo = {
  description: "A local-first editor for the files you already trust.",
  name: "Brainarium",
  version: "",
};

type NavigationEntry = {
  relativePath: string;
};

type FileContextMenu = {
  kind: DocumentKind;
  relativePath: string;
  x: number;
  y: number;
};

const documentLabel = (
  relativePath: string,
  snapshot?: VaultSnapshot,
): string =>
  snapshot?.documents.find(
    (candidate) => candidate.relativePath === relativePath,
  )?.title ?? relativePath;

const InlineConnections = ({
  backlinks,
  onOpenDocument,
  outgoingLinks,
  snapshot,
}: {
  backlinks: VaultLinkGraph["edges"];
  onOpenDocument: (relativePath: string) => void;
  outgoingLinks: VaultLinkGraph["edges"];
  snapshot: VaultSnapshot;
}): React.JSX.Element => {
  if (outgoingLinks.length === 0 && backlinks.length === 0) return <></>;
  return (
    <section className="inline-connections" aria-label="Note connections">
      <p className="section-label">CONNECTIONS</p>
      <div className="inline-connections-columns">
        <div>
          <h3>Linked from this note</h3>
          <ul>
            {outgoingLinks.map((edge) => (
              <li key={`${edge.source}-${edge.target}`}>
                <button
                  type="button"
                  onClick={() => onOpenDocument(edge.target)}
                >
                  {documentLabel(edge.target, snapshot)}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Backlinks</h3>
          <ul>
            {backlinks.map((edge) => (
              <li key={`${edge.source}-${edge.target}`}>
                <button
                  type="button"
                  onClick={() => onOpenDocument(edge.source)}
                >
                  {documentLabel(edge.source, snapshot)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const ImageDocumentPreview = ({
  document,
}: {
  document: VaultDocumentContent;
}): React.JSX.Element => {
  const [zoom, setZoom] = useState(100);
  const image = document.image;
  const imageUrl = useRef<string | undefined>(undefined);
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    setZoom(100);
    if (!image) return;
    const exactBytes = new Uint8Array(image.bytes.byteLength);
    exactBytes.set(image.bytes);
    const nextUrl = URL.createObjectURL(
      new Blob([exactBytes.buffer], { type: image.mimeType }),
    );
    imageUrl.current = nextUrl;
    setUrl(nextUrl);
    return () => {
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = undefined;
    };
  }, [document.relativePath, document.version, image]);

  if (!image || !url) return <p role="status">Loading image…</p>;
  return (
    <section className="image-document-preview" aria-label="Image preview">
      <div
        className="image-preview-controls"
        role="group"
        aria-label="Image zoom"
      >
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(25, current - 25))}
        >
          −
        </button>
        <button type="button" onClick={() => setZoom(100)}>
          Fit
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(300, current + 25))}
        >
          +
        </button>
        <output>{zoom}%</output>
      </div>
      <div className="image-preview-frame">
        <img
          alt={document.title}
          className={zoom === 100 ? "" : "is-zoomed"}
          src={url}
          style={zoom === 100 ? undefined : { width: `${zoom}%` }}
        />
      </div>
    </section>
  );
};

const PdfDocumentPreview = ({
  document,
}: {
  document: VaultDocumentContent;
}): React.JSX.Element => {
  const pdf = document.pdf;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fitZoom = useRef(100);
  const hasAppliedInitialFit = useRef(false);
  const pageDimensions = useRef<{ height: number; width: number }>(undefined);
  const [pageCount, setPageCount] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [status, setStatus] = useState("Loading PDF…");
  const [zoom, setZoom] = useState(110);

  useEffect(() => {
    setPageNumber(1);
    setPageCount(undefined);
    hasAppliedInitialFit.current = false;
  }, [document.relativePath, document.version]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const exactBytes = new Uint8Array(pdf.bytes.byteLength);
    exactBytes.set(pdf.bytes);
    const loadingTask = getDocument({ data: exactBytes });
    let cancelled = false;
    let renderTask: RenderTask | undefined;

    const render = async (): Promise<void> => {
      try {
        setStatus("Loading PDF…");
        const pdfDocument = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdfDocument.numPages);
        const page = await pdfDocument.getPage(
          Math.min(pageNumber, pdfDocument.numPages),
        );
        if (cancelled || !canvasRef.current) return;
        const unscaledViewport = page.getViewport({ scale: 1 });
        pageDimensions.current = {
          height: unscaledViewport.height,
          width: unscaledViewport.width,
        };
        const frame = frameRef.current;
        const fitScale = frame
          ? Math.min(
              (frame.clientWidth - 32) / unscaledViewport.width,
              (frame.clientHeight - 32) / unscaledViewport.height,
            )
          : zoom / 100;
        fitZoom.current = Math.max(25, Math.round(fitScale * 100));
        if (!hasAppliedInitialFit.current) {
          hasAppliedInitialFit.current = true;
          setZoom(fitZoom.current);
        }
        const viewport = page.getViewport({ scale: zoom / 100 });
        const outputScale = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable.");
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.width = Math.ceil(viewport.width * outputScale);
        renderTask = page.render({
          canvas,
          canvasContext: context,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        });
        await renderTask.promise;
        if (!cancelled) setStatus("");
      } catch {
        if (!cancelled) setStatus("Brainarium could not render this PDF.");
      }
    };
    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf, zoom]);

  const fitPage = (): void => {
    const frame = frameRef.current;
    const dimensions = pageDimensions.current;
    if (!frame || !dimensions) return;
    const nextZoom = Math.max(
      25,
      Math.round(
        Math.min(
          (frame.clientWidth - 32) / dimensions.width,
          (frame.clientHeight - 32) / dimensions.height,
        ) * 100,
      ),
    );
    fitZoom.current = nextZoom;
    frame.scrollTo({ left: 0, top: 0 });
    setZoom(nextZoom);
  };

  const previousPage = (): void => {
    setPageNumber((page) => Math.max(1, page - 1));
  };

  const nextPage = (): void => {
    setPageNumber((page) => Math.min(pageCount ?? page, page + 1));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (usesPrimaryModifier(currentShortcutPlatform, event)) {
        if (event.key === "0") {
          event.preventDefault();
          fitPage();
        } else if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          setZoom((current) => Math.min(200, current + 10));
        } else if (event.key === "-") {
          event.preventDefault();
          setZoom((current) => Math.max(25, current - 10));
        }
        return;
      }
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          event.preventDefault();
          previousPage();
        } else if (event.key === "ArrowRight" || event.key === "PageDown") {
          event.preventDefault();
          nextPage();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageCount, pageNumber, zoom]);

  if (!pdf) return <p role="status">Loading PDF…</p>;
  return (
    <section className="pdf-document-preview" aria-label="PDF preview">
      <header className="pdf-preview-heading">
        <div>
          <p className="section-label">READ-ONLY PDF</p>
          <p>{status || "Rendered locally; nothing leaves this vault."}</p>
        </div>
        <div className="pdf-preview-controls" aria-label="PDF controls">
          <button
            aria-label="Previous PDF page"
            disabled={pageNumber <= 1}
            type="button"
            onClick={previousPage}
          >
            Previous
          </button>
          <output aria-live="polite">
            {pageCount ? `Page ${pageNumber} of ${pageCount}` : "Opening…"}
          </output>
          <button
            aria-label="Next PDF page"
            disabled={!pageCount || pageNumber >= pageCount}
            type="button"
            onClick={nextPage}
          >
            Next
          </button>
          <button
            aria-label="Zoom out PDF"
            disabled={zoom <= 60}
            title="Zoom out (Cmd/Ctrl+-)"
            type="button"
            onClick={() => setZoom((current) => current - 10)}
          >
            −
          </button>
          <button
            aria-label="Fit PDF page"
            title="Fit page (Cmd/Ctrl+0)"
            type="button"
            onClick={fitPage}
          >
            Fit
          </button>
          <button
            aria-label="Zoom in PDF"
            disabled={zoom >= 200}
            title="Zoom in (Cmd/Ctrl++)"
            type="button"
            onClick={() => setZoom((current) => current + 10)}
          >
            +
          </button>
        </div>
      </header>
      <div className="pdf-preview-frame" ref={frameRef}>
        <canvas
          aria-label={`${document.title} PDF page ${pageNumber}`}
          ref={canvasRef}
        />
      </div>
    </section>
  );
};

type IconName =
  | "back"
  | "changes"
  | "connections"
  | "files"
  | "forward"
  | "graph"
  | "menu"
  | "moon"
  | "pdf"
  | "search"
  | "sun";

const Icon = ({ name }: { name: IconName }): React.JSX.Element => {
  const paths: Record<IconName, React.JSX.Element> = {
    back: <path d="m14.5 5-7 7 7 7M8 12h9" />,
    changes: (
      <path d="M4 13.5h4l1.5 2.5h5l1.5-2.5h4M4 13.5 6.5 5h11L20 13.5v5.5H4z" />
    ),
    connections: (
      <path d="M9 7.5 7.5 6a3.2 3.2 0 0 0-4.5 4.5l2 2a3.2 3.2 0 0 0 4.5 0l1-1M15 16.5l1.5 1.5A3.2 3.2 0 0 0 21 13.5l-2-2a3.2 3.2 0 0 0-4.5 0l-1 1M8 16l8-8" />
    ),
    files: <path d="M4 4.5h6l1.6 2H20v13H4zM7.5 11h9M7.5 15h6" />,
    forward: <path d="m9.5 5 7 7-7 7M16 12H7" />,
    graph: (
      <path d="M6 5.5a2 2 0 1 0 0 .01M18 5.5a2 2 0 1 0 0 .01M12 18.5a2 2 0 1 0 0 .01M7.7 7.1l2.9 9.2M16.3 7.1l-2.9 9.2M8 5.5h8" />
    ),
    menu: <path d="M5 7h14M5 12h14M5 17h14" />,
    moon: <path d="M20 15.2A8 8 0 1 1 8.8 4 6.2 6.2 0 0 0 20 15.2Z" />,
    pdf: (
      <>
        <path d="M6 3.75h8.2L18 7.55v12.7H6zM14 3.75v4h4" />
        <path d="M8.2 15.8h1.35a1.25 1.25 0 0 0 0-2.5H8.2v4M12.1 17.3v-4h1.15a2 2 0 1 1 0 4zM16.15 17.3v-4h2.2M16.15 15.25h1.8" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4 4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" className="ui-icon" fill="none" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
};

const App = (): React.JSX.Element => {
  const [appInfo, setAppInfo] = useState<BrainariumAppInfo>(defaultAppInfo);
  const [snapshot, setSnapshot] = useState<VaultSnapshot>();
  const [reviewStates, setReviewStates] = useState<DocumentReviewState[]>([]);
  const [changeReview, setChangeReview] = useState<MarkdownChangeReview>();
  const [session, dispatchSession] = useReducer(
    documentSessionReducer,
    undefined,
    emptyDocumentSession,
  );
  const document = session.base;
  const editorText = session.draft;
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFileName, setExportedFileName] = useState<string>();
  const [viewMode, setViewMode] = useState<"preview" | "editor">("preview");
  const [editorMode, setEditorMode] = useState<MarkdownEditorMode>("assisted");
  const [isReloading, setIsReloading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isConfirmingReload, setIsConfirmingReload] = useState(false);
  const [isLoadingLinkGraph, setIsLoadingLinkGraph] = useState(false);
  const [linkGraph, setLinkGraph] = useState<VaultLinkGraph>();
  const [workspaceView, setWorkspaceView] = useState<
    "changes" | "connections" | "document" | "graph"
  >("document");
  const [graphMode, setGraphMode] = useState<"global" | "local">("global");
  const [graphQuery, setGraphQuery] = useState("");
  const [localGraphDepth, setLocalGraphDepth] = useState(1);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [vaultSearchResults, setVaultSearchResults] = useState<
    VaultSearchResult[]
  >([]);
  const [isVaultSearchOpen, setIsVaultSearchOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [quickOpenIndex, setQuickOpenIndex] = useState(0);
  const [isRecentVaultsOpen, setIsRecentVaultsOpen] = useState(false);
  const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.innerWidth <= 860,
  );
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenu>();
  const [reviewPanelWidth, setReviewPanelWidth] = useState(() => {
    const savedWidth = Number(
      window.localStorage.getItem("brainarium.change-review-panel-width-v2"),
    );
    return Number.isFinite(savedWidth)
      ? Math.max(576, Math.min(992, savedWidth))
      : undefined;
  });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [history, setHistory] = useState<NavigationEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastSavedAt, setLastSavedAt] = useState<Date>();
  const [error, setError] = useState<string>();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const vaultSearchInputRef = useRef<HTMLInputElement>(null);
  const documentWorkspaceRef = useRef<HTMLElement>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const sessionSaveTimerRef = useRef<number | undefined>(undefined);
  const documentRef = useRef<VaultDocumentContent | undefined>(undefined);
  const editorTextRef = useRef("");
  const sessionRef = useRef(session);
  const sessionGenerationRef = useRef(0);
  const saveRequestRef = useRef(0);
  const findPositionsInDocument = document
    ? findPositions(editorText, findQuery)
    : [];
  const changedPaths = useMemo(
    () =>
      new Set(
        reviewStates
          .filter((state) => state.changed)
          .map((state) => state.relativePath),
      ),
    [reviewStates],
  );
  const changedDirectoryCounts = useMemo(
    () =>
      snapshot
        ? changedCounts(snapshot.tree, changedPaths)
        : new Map<string, number>(),
    [changedPaths, snapshot],
  );
  const preferredReviewPanelWidth =
    reviewPanelWidth ??
    Math.max(576, Math.min(992, Math.round(window.innerWidth * 0.4)));

  useEffect(() => {
    const collapseForCompactWindow = (): void => {
      if (window.innerWidth <= 860) setIsSidebarCollapsed(true);
    };
    collapseForCompactWindow();
    window.addEventListener("resize", collapseForCompactWindow);
    return () => window.removeEventListener("resize", collapseForCompactWindow);
  }, []);

  useEffect(() => {
    if (reviewPanelWidth === undefined) return;
    window.localStorage.setItem(
      "brainarium.change-review-panel-width-v2",
      String(reviewPanelWidth),
    );
  }, [reviewPanelWidth]);

  useEffect(() => {
    if (!fileContextMenu) return;
    const dismiss = (): void => setFileContextMenu(undefined);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fileContextMenu]);

  const refreshRecents = async (): Promise<void> => {
    setRecentVaults(await window.brainarium.listRecentVaults());
  };

  const refreshReviewStates = async (): Promise<void> => {
    setReviewStates(await window.brainarium.reviewStates());
  };

  const saveVaultSession = (): void => {
    const activeDocumentPath = documentRef.current?.relativePath;
    if (!snapshot) return;
    const state: VaultSessionState = {
      activeDocumentPath,
      scrollPositions: { ...scrollPositionsRef.current },
    };
    void window.brainarium.saveVaultSession(state).catch(() => {
      // Session restoration is a convenience; a failed local state write must
      // never interrupt reading or editing the vault.
    });
  };

  const scheduleVaultSessionSave = (): void => {
    window.clearTimeout(sessionSaveTimerRef.current);
    sessionSaveTimerRef.current = window.setTimeout(saveVaultSession, 180);
  };

  useEffect(() => {
    void refreshRecents();
  }, []);

  useEffect(() => {
    void window.brainarium.appInfo().then(setAppInfo);
  }, []);

  useEffect(() => () => window.clearTimeout(sessionSaveTimerRef.current), []);

  useEffect(() => {
    documentRef.current = document;
    editorTextRef.current = editorText;
    sessionRef.current = session;
    sessionGenerationRef.current = session.generation;
  }, [document, editorText, session]);

  useEffect(
    () =>
      window.brainarium.onVaultChanged((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        void window.brainarium.reviewStates().then(setReviewStates);
        const openDocument = documentRef.current;
        if (!openDocument) return;
        const generation = sessionGenerationRef.current;
        const stillExists = nextSnapshot.documents.some(
          (candidate) => candidate.relativePath === openDocument.relativePath,
        );
        if (!stillExists) {
          dispatchSession({ type: "missing" });
          return;
        }
        if (openDocument.kind === "markdown")
          dispatchSession({ type: "reconcile" });
        void window.brainarium
          .readDocument(openDocument.relativePath)
          .then((freshDocument) => {
            if (
              documentRef.current?.relativePath ===
                freshDocument.relativePath &&
              sessionGenerationRef.current === generation
            ) {
              if (freshDocument.kind === "markdown") {
                dispatchSession({
                  document: freshDocument,
                  type: "reconcileClean",
                });
              } else {
                dispatchSession({ document: freshDocument, type: "open" });
              }
            }
          })
          .catch(() => {
            if (sessionGenerationRef.current === generation) {
              dispatchSession({ type: "missing" });
            }
          });
      }),
    [],
  );

  useEffect(() => {
    if (!snapshot) return;
    void refreshReviewStates();
  }, [snapshot?.rootPath]);

  useEffect(() => {
    if (document?.kind !== "markdown") {
      setChangeReview(undefined);
      return;
    }
    let cancelled = false;
    void window.brainarium
      .changeReview(document.relativePath)
      .then((review) => {
        if (!cancelled) setChangeReview(review);
      });
    return () => {
      cancelled = true;
    };
  }, [document?.kind, document?.relativePath, document?.version, reviewStates]);

  useEffect(
    () =>
      window.brainarium.onVaultGraphChanged((freshGraph) => {
        setLinkGraph(freshGraph);
      }),
    [],
  );

  const confirmLeaveDocument = (): boolean => {
    const { status } = sessionRef.current;
    if (status !== "dirty" && status !== "conflict" && status !== "missing") {
      return true;
    }
    return window.confirm(
      "Discard the unsaved copy in Brainarium? Your file on disk will not be changed.",
    );
  };

  const chooseVault = async (): Promise<void> => {
    if (!confirmLeaveDocument()) return;
    setIsChoosing(true);
    setError(undefined);
    try {
      const result = await window.brainarium.chooseVault();
      if (!result.cancelled) {
        setSnapshot(result.snapshot);
        dispatchSession({ type: "clear" });
        setCopied(false);
        setFindQuery("");
        setLinkGraph(undefined);
        setWorkspaceView("document");
        setIsComparing(false);
        setIsConfirmingReload(false);
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
    if (!confirmLeaveDocument()) return;
    setError(undefined);
    try {
      setSnapshot(await window.brainarium.openRecentVault(id));
      dispatchSession({ type: "clear" });
      setCopied(false);
      setFindQuery("");
      setLinkGraph(undefined);
      setWorkspaceView("document");
      setIsComparing(false);
      setIsConfirmingReload(false);
      await refreshRecents();
    } catch {
      setError("That vault is unavailable. Choose another folder to continue.");
    }
  };

  const scrollToFragment = (fragment: string): void => {
    window.setTimeout(() => {
      globalThis.document.getElementById(fragment)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };

  const recordHistory = (relativePath: string): void => {
    setHistory((previous) => {
      const next = previous.slice(0, historyIndex + 1);
      if (next[next.length - 1]?.relativePath === relativePath) return previous;
      setHistoryIndex(next.length);
      return [...next, { relativePath }];
    });
  };

  const readDocument = async (
    relativePath: string,
    fragment?: string,
    navigation: "record" | "restore" = "record",
  ): Promise<void> => {
    if (documentRef.current?.relativePath === relativePath && fragment) {
      scrollToFragment(fragment);
      return;
    }
    if (
      documentRef.current?.relativePath !== relativePath &&
      !confirmLeaveDocument()
    ) {
      return;
    }
    setError(undefined);
    try {
      const currentDocument = documentRef.current;
      const workspace = documentWorkspaceRef.current;
      if (currentDocument && workspace) {
        scrollPositionsRef.current[currentDocument.relativePath] =
          workspace.scrollTop;
      }
      const nextDocument = await window.brainarium.readDocument(relativePath);
      dispatchSession({ document: nextDocument, type: "open" });
      setLastSavedAt(undefined);
      setCopied(false);
      setFindQuery("");
      setFindIndex(0);
      setWorkspaceView("document");
      setIsComparing(false);
      setIsConfirmingReload(false);
      if (navigation === "record") recordHistory(relativePath);
      if (fragment) scrollToFragment(fragment);
      scheduleVaultSessionSave();
    } catch {
      setError(
        "Brainarium could not read that file. It may have changed outside the vault.",
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    void window.brainarium.restoreVaultSession().then(async (restored) => {
      if (cancelled || !restored.snapshot) return;
      scrollPositionsRef.current = restored.scrollPositions;
      setSnapshot(restored.snapshot);
      if (restored.activeDocumentPath) {
        await readDocument(restored.activeDocumentPath, undefined, "restore");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const relativePath = document?.relativePath;
    if (!relativePath) return;
    const restoreScroll = window.requestAnimationFrame(() => {
      const workspace = documentWorkspaceRef.current;
      if (!workspace) return;
      workspace.scrollTop = scrollPositionsRef.current[relativePath] ?? 0;
    });
    scheduleVaultSessionSave();
    return () => window.cancelAnimationFrame(restoreScroll);
  }, [document?.relativePath]);

  const navigateHistory = (direction: -1 | 1): void => {
    const nextIndex = historyIndex + direction;
    const target = history[nextIndex];
    if (!target) return;
    setHistoryIndex(nextIndex);
    void readDocument(target.relativePath, undefined, "restore");
  };

  const saveDocument = async (): Promise<void> => {
    const current = sessionRef.current;
    if (
      !current.base ||
      current.base.kind !== "markdown" ||
      current.status !== "dirty"
    ) {
      return;
    }
    const requestId = ++saveRequestRef.current;
    const generation = current.generation;
    const submittedText = current.draft;
    dispatchSession({ requestId, submittedText, type: "saveStart" });
    setError(undefined);
    try {
      const result = await window.brainarium.saveDocument({
        baseVersion: current.base.version,
        relativePath: current.base.relativePath,
        text: submittedText,
      });
      if (sessionGenerationRef.current !== generation) return;
      dispatchSession({ requestId, result, type: "saveResult" });
      if (result.status === "saved") setLastSavedAt(new Date());
      setLinkGraph(undefined);
    } catch {
      if (sessionGenerationRef.current === generation) {
        dispatchSession({ requestId, type: "saveFailed" });
      }
      setError(
        "Brainarium could not save this file. It may have changed outside the app.",
      );
    }
  };

  const reloadFromDisk = async (): Promise<void> => {
    const current = sessionRef.current;
    if (!current.base) return;
    setIsReloading(true);
    try {
      const disk = await window.brainarium.readDocument(
        current.base.relativePath,
      );
      if (sessionGenerationRef.current === current.generation) {
        dispatchSession({ document: disk, type: "open" });
        setIsComparing(false);
        setIsConfirmingReload(false);
      }
    } catch {
      if (sessionGenerationRef.current === current.generation) {
        dispatchSession({ type: "missing" });
      }
    } finally {
      setIsReloading(false);
    }
  };

  const keepMine = async (): Promise<void> => {
    const current = sessionRef.current;
    if (!current.base || !current.disk || current.status !== "conflict") return;
    const requestId = ++saveRequestRef.current;
    const generation = current.generation;
    const submittedText = current.draft;
    // Rebase the local draft onto the exact disk SHA shown in Compare. The
    // main process performs the final optimistic check before replacement.
    dispatchSession({
      requestId,
      submittedText,
      type: "saveStart",
    });
    try {
      const result = await window.brainarium.saveDocument({
        baseVersion: current.disk.version,
        relativePath: current.base.relativePath,
        text: submittedText,
      });
      if (sessionGenerationRef.current !== generation) return;
      dispatchSession({ requestId, result, type: "saveResult" });
      if (result.status === "saved") {
        setIsComparing(false);
        setLastSavedAt(new Date());
      }
    } catch {
      if (sessionGenerationRef.current === generation) {
        dispatchSession({ requestId, type: "saveFailed" });
      }
      setError("Brainarium could not keep this copy. Try comparing again.");
    }
  };

  useEffect(() => {
    if (session.status !== "dirty" || document?.kind !== "markdown") {
      return;
    }
    const timer = window.setTimeout(() => void saveDocument(), 750);
    return () => window.clearTimeout(timer);
  }, [document?.kind, editorText, session.status]);

  const buildLinkGraph = async (): Promise<VaultLinkGraph | undefined> => {
    setIsLoadingLinkGraph(true);
    setError(undefined);
    try {
      const graph = await window.brainarium.buildVaultLinkGraph();
      setLinkGraph(graph);
      return graph;
    } catch {
      setError("Brainarium could not build the vault link graph.");
    } finally {
      setIsLoadingLinkGraph(false);
    }
  };

  const openLinkGraph = async (): Promise<void> => {
    const graph = await buildLinkGraph();
    if (graph) setWorkspaceView("graph");
  };

  const openExternalLink = (target: string): void => {
    void window.brainarium.openExternalLink(target).catch(() => {
      setError("Brainarium could not open that external link.");
    });
  };

  const copyDocumentContent = async (relativePath?: string): Promise<void> => {
    const targetPath = relativePath ?? document?.relativePath;
    if (!targetPath) {
      return;
    }
    setIsCopying(true);
    try {
      await window.brainarium.copyDocumentContent(targetPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Brainarium could not copy that file. Try opening it again.");
    } finally {
      setIsCopying(false);
    }
  };

  /**
   * Exports the document as saved on disk. The main process re-reads it, so an
   * unsaved draft would silently export stale text; the button is disabled
   * while dirty rather than exporting something the reader did not see.
   */
  const exportDocumentPdf = async (relativePath?: string): Promise<void> => {
    const targetPath = relativePath ?? documentRef.current?.relativePath;
    if (!targetPath) return;
    setIsExporting(true);
    try {
      const result = await window.brainarium.exportDocumentPdf({
        relativePath: targetPath,
      });
      if (result.status === "exported") {
        setExportedFileName(result.fileName);
        window.setTimeout(() => setExportedFileName(undefined), 2400);
      } else if (result.status === "busy") {
        setError("Brainarium is already exporting a document.");
      } else if (result.status === "missing") {
        setError("That file is no longer part of this vault.");
      } else if (result.status === "unsupported") {
        setError(`Brainarium cannot export ${result.kind} files to PDF.`);
      }
    } catch {
      setError("Brainarium could not export that document to PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const copyDocumentPath = async (relativePath: string): Promise<void> => {
    try {
      await window.brainarium.copyDocumentPath(relativePath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Brainarium could not copy that path. Try opening it again.");
    }
  };

  const openFileContextMenu = (
    relativePath: string,
    kind: DocumentKind,
    position: { x: number; y: number },
  ): void => {
    setFileContextMenu({
      kind,
      relativePath,
      x: Math.min(position.x, window.innerWidth - 228),
      y: Math.min(position.y, window.innerHeight - 112),
    });
  };

  const markDocumentReviewed = async (): Promise<void> => {
    if (!document || document.kind !== "markdown") return;
    try {
      setReviewStates(
        await window.brainarium.markReviewed(document.relativePath),
      );
      setChangeReview(undefined);
    } catch {
      setError("Brainarium could not mark this document as reviewed.");
    }
  };

  const markReviewedAt = async (relativePath: string): Promise<void> => {
    try {
      setReviewStates(await window.brainarium.markReviewed(relativePath));
      if (documentRef.current?.relativePath === relativePath) {
        setChangeReview(undefined);
      }
    } catch {
      setError("Brainarium could not mark this document as reviewed.");
    }
  };

  /**
   * Only moves the stored review baseline. Files on disk and any unsaved draft
   * are untouched, so this deliberately skips confirmLeaveDocument().
   */
  const markAllDocumentsReviewed = async (): Promise<void> => {
    try {
      setReviewStates(await window.brainarium.markAllReviewed());
      setChangeReview(undefined);
    } catch {
      setError("Brainarium could not mark these changes as reviewed.");
    }
  };

  const copyPlainSelection = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError("Brainarium could not copy the selected text. Try again.");
    }
  };

  const importImage = async (): Promise<void> => {
    if (document?.kind !== "markdown") return;
    try {
      const imported = await window.brainarium.importImage(
        document.relativePath,
      );
      editorRef.current?.insertText(imported.markdown);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Image selection was cancelled."
      )
        return;
      setError(
        "Brainarium could not move that image. Check its file type and size.",
      );
    }
  };

  useEffect(() => {
    if (!isVaultSearchOpen) return;
    const focusSearch = window.requestAnimationFrame(() => {
      vaultSearchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusSearch);
  }, [isVaultSearchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLocaleLowerCase();
      if (event.key === "Escape") {
        setIsQuickOpen(false);
        setIsFindOpen(false);
        setIsConnectionsOpen(false);
        return;
      }
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key === "ArrowLeft"
      ) {
        event.preventDefault();
        navigateHistory(-1);
        return;
      }
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        navigateHistory(1);
        return;
      }
      if (!usesPrimaryModifier(currentShortcutPlatform, event)) return;

      if (key === "r") {
        const activeDocument = documentRef.current;
        const workspace = documentWorkspaceRef.current;
        if (activeDocument && workspace) {
          scrollPositionsRef.current[activeDocument.relativePath] =
            workspace.scrollTop;
        }
        saveVaultSession();
        return;
      }

      if (key === "p" && !event.shiftKey) {
        event.preventDefault();
        setIsQuickOpen(true);
      } else if (key === "f" && event.shiftKey) {
        event.preventDefault();
        setIsVaultSearchOpen(true);
        setVaultSearchResults([]);
      } else if (key === "f" && document?.kind === "markdown") {
        event.preventDefault();
        setIsFindOpen(true);
        setFindIndex(-1);
      } else if (
        key === "c" &&
        event.shiftKey &&
        documentRef.current !== undefined &&
        hasTextContent(documentRef.current.kind)
      ) {
        event.preventDefault();
        void copyDocumentContent();
      } else if (
        key === "c" &&
        documentRef.current !== undefined &&
        hasTextContent(documentRef.current.kind)
      ) {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        const selectedText = window.getSelection()?.toString();
        if (selectedText) {
          void copyPlainSelection(selectedText);
        } else {
          void copyDocumentContent();
        }
      } else if (key === "e" && document?.kind === "markdown") {
        event.preventDefault();
        setViewMode((current) =>
          current === "preview" ? "editor" : "preview",
        );
      } else if (
        key === "m" &&
        event.shiftKey &&
        document?.kind === "markdown"
      ) {
        event.preventDefault();
        setViewMode("editor");
        setEditorMode((current) =>
          current === "assisted" ? "source" : "assisted",
        );
      } else if (key === "l" && event.shiftKey) {
        event.preventDefault();
        setIsSidebarCollapsed((current) => !current);
      } else if (key === "u" && event.shiftKey) {
        event.preventDefault();
        setWorkspaceView("changes");
      } else if (key === "g" && event.shiftKey) {
        event.preventDefault();
        setWorkspaceView("connections");
      } else if (key === "g") {
        event.preventDefault();
        setWorkspaceView("graph");
        void window.brainarium
          .buildVaultLinkGraph()
          .then(setLinkGraph)
          .catch(() =>
            setError("Brainarium could not build the vault link graph."),
          );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document, history, historyIndex, snapshot]);

  const moveFind = (direction: 1 | -1): void => {
    if (findPositionsInDocument.length === 0) return;
    const nextIndex =
      findIndex < 0
        ? direction === 1
          ? 0
          : findPositionsInDocument.length - 1
        : (findIndex + direction + findPositionsInDocument.length) %
          findPositionsInDocument.length;
    setFindIndex(nextIndex);
    if (viewMode !== "editor") return;
    window.setTimeout(() => {
      const from = findPositionsInDocument[nextIndex];
      editorRef.current?.focus();
      editorRef.current?.selectSourceRange(from, from + findQuery.length);
    }, 0);
  };

  const savedLabel = (() => {
    if (session.status === "dirty") return "Unsaved changes";
    if (session.status === "saving") return "Saving…";
    if (session.status === "conflict") return "Needs review";
    if (!lastSavedAt) return "Saved from disk";
    return `Saved ${lastSavedAt.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  })();

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
  const quickOpenDocuments = snapshot
    ? snapshot.documents
        .filter((candidate) => {
          const query = quickOpenQuery.trim().toLocaleLowerCase();
          return (
            !query ||
            candidate.title.toLocaleLowerCase().includes(query) ||
            candidate.relativePath.toLocaleLowerCase().includes(query)
          );
        })
        .slice(0, 12)
    : [];
  const outgoingLinks =
    document && linkGraph
      ? linkGraph.edges.filter((edge) => edge.source === document.relativePath)
      : [];
  const backlinks =
    document && linkGraph
      ? linkGraph.edges.filter((edge) => edge.target === document.relativePath)
      : [];

  if (snapshot) {
    return (
      <main
        className={`vault-shell${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}
        data-theme={theme}
      >
        <aside
          className={`vault-sidebar${isSidebarCollapsed ? " is-collapsed" : ""}`}
        >
          <button
            aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={!isSidebarCollapsed}
            className="sidebar-toggle"
            title={`${isSidebarCollapsed ? "Show" : "Hide"} sidebar (Cmd+Shift+L)`}
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <Icon name="menu" />
          </button>
          <div className="sidebar-content">
            <div className="vault-sidebar-heading">
              <div className="sidebar-app-identity">
                <span aria-hidden="true" className="sidebar-monogram">
                  B<span className="monogram-cursor">_</span>
                </span>
                <div>
                  <p className="sidebar-app-name">{appInfo.name}</p>
                  <p className="sidebar-app-version">
                    {appInfo.version ? `v${appInfo.version}` : "Local app"}
                  </p>
                </div>
                <button
                  aria-label={
                    theme === "light" ? "Use night theme" : "Use light theme"
                  }
                  aria-pressed={theme === "dark"}
                  className="theme-toggle"
                  title={
                    theme === "light" ? "Use night theme" : "Use light theme"
                  }
                  type="button"
                  onClick={() =>
                    setTheme((current) =>
                      current === "light" ? "dark" : "light",
                    )
                  }
                >
                  <Icon name={theme === "light" ? "moon" : "sun"} />
                  <span>{theme === "light" ? "Night" : "Light"}</span>
                </button>
              </div>
              <p className="eyebrow">OPEN VAULT</p>
              <h1>{snapshot.tree.name}</h1>
              <p>{snapshot.documents.length} readable documents</p>
            </div>
            <div className="vault-search-controls">
              <button
                className="vault-search-trigger"
                title={`Search this vault (${platformShortcuts.searchVault})`}
                type="button"
                onClick={() => {
                  setIsVaultSearchOpen((current) => !current);
                  setVaultSearchResults([]);
                }}
              >
                <Icon name="search" />
                Search
                <kbd>{platformShortcuts.searchVault}</kbd>
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
                    placeholder="Search all files"
                    ref={vaultSearchInputRef}
                    type="search"
                    value={vaultSearchQuery}
                    onChange={(event) =>
                      setVaultSearchQuery(event.target.value)
                    }
                  />
                  <button type="submit">Search</button>
                </form>
              )}
            </div>
            <div className="sidebar-commands" aria-label="Vault commands">
              <button
                title={`Quick open (${platformShortcuts.quickOpen})`}
                type="button"
                onClick={() => setIsQuickOpen(true)}
              >
                <Icon name="search" />
                Quick open
                <kbd>{platformShortcuts.quickOpen}</kbd>
              </button>
              <button
                aria-label="Back"
                disabled={historyIndex <= 0}
                title={`Back (${platformShortcuts.back})`}
                type="button"
                onClick={() => navigateHistory(-1)}
              >
                <Icon name="back" />
              </button>
              <button
                aria-label="Forward"
                disabled={historyIndex >= history.length - 1}
                title={`Forward (${platformShortcuts.forward})`}
                type="button"
                onClick={() => navigateHistory(1)}
              >
                <Icon name="forward" />
              </button>
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
                  activePath={document?.relativePath}
                  changedPaths={changedPaths}
                  directoryCounts={changedDirectoryCounts}
                  node={snapshot.tree}
                  onFileContextMenu={openFileContextMenu}
                  onSelect={(relativePath) => void readDocument(relativePath)}
                />
              </ul>
            </section>
            <nav className="library-navigation" aria-label="Library navigation">
              <p className="section-label">LIBRARY</p>
              <button
                aria-current={workspaceView === "changes" ? "page" : undefined}
                title={`Review changed Markdown notes (${platformShortcuts.changes})`}
                type="button"
                onClick={() => setWorkspaceView("changes")}
              >
                <Icon name="changes" />
                Changes
                {changedPaths.size > 0 && (
                  <span className="library-change-count">
                    {changedPaths.size}
                  </span>
                )}
                <kbd>{platformShortcuts.changes}</kbd>
              </button>
              <button
                aria-current={workspaceView === "graph" ? "page" : undefined}
                title={`Open global graph (${platformShortcuts.globalGraph})`}
                type="button"
                onClick={() => void openLinkGraph()}
              >
                <Icon name="graph" />
                Graph
                <kbd>{platformShortcuts.globalGraph}</kbd>
              </button>
              <button
                aria-current={
                  workspaceView === "connections" ? "page" : undefined
                }
                title={`Open vault connections (${platformShortcuts.connections})`}
                type="button"
                onClick={() => setWorkspaceView("connections")}
              >
                <Icon name="connections" />
                Connections
                <kbd>{platformShortcuts.connections}</kbd>
              </button>
              <button
                className="library-vault-switch"
                disabled={isChoosing}
                title="Open another vault"
                type="button"
                onClick={() => void chooseVault()}
              >
                <Icon name="files" />
                {isChoosing ? "Opening vault…" : "Open another vault"}
              </button>
            </nav>
            {recentVaults.length > 0 && (
              <nav className="recent-vaults" aria-label="Recent vaults">
                <button
                  aria-expanded={isRecentVaultsOpen}
                  className="recent-vaults-toggle"
                  title="Show recent vaults"
                  type="button"
                  onClick={() => setIsRecentVaultsOpen((current) => !current)}
                >
                  <span>RECENT VAULTS</span>
                  <span aria-hidden="true">
                    {isRecentVaultsOpen ? "⌄" : "›"}
                  </span>
                </button>
                {isRecentVaultsOpen &&
                  recentVaults.map((recent) => (
                    <button
                      key={recent.id}
                      title={`Open ${recent.name}`}
                      type="button"
                      onClick={() => void openRecentVault(recent.id)}
                    >
                      {recent.name}
                    </button>
                  ))}
              </nav>
            )}
          </div>
        </aside>
        <section
          className="document-workspace"
          aria-label="Document workspace"
          onScroll={(event) => {
            const activeDocument = documentRef.current;
            if (!activeDocument) return;
            scrollPositionsRef.current[activeDocument.relativePath] =
              event.currentTarget.scrollTop;
            scheduleVaultSessionSave();
          }}
          ref={documentWorkspaceRef}
        >
          <nav
            className="workspace-command-bar"
            aria-label="Workspace controls"
          >
            <button
              type="button"
              onClick={() => setIsQuickOpen(true)}
              title={`Quick open (${platformShortcuts.quickOpen})`}
            >
              Quick open
              <kbd>{platformShortcuts.quickOpen}</kbd>
            </button>
            <button
              type="button"
              disabled={historyIndex <= 0}
              onClick={() => navigateHistory(-1)}
              title={`Back (${platformShortcuts.back})`}
            >
              Back
            </button>
            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={() => navigateHistory(1)}
              title={`Forward (${platformShortcuts.forward})`}
            >
              Forward
            </button>
            {document?.kind === "markdown" && (
              <button
                aria-expanded={isConnectionsOpen}
                type="button"
                onClick={() => setIsConnectionsOpen((current) => !current)}
                title="Toggle connections (Cmd+Shift+B)"
              >
                Connections
              </button>
            )}
          </nav>
          {isQuickOpen && (
            <div className="quick-open-scrim" role="presentation">
              <section
                aria-label="Quick open"
                aria-modal="true"
                className="quick-open-dialog"
                role="dialog"
              >
                <div className="quick-open-heading">
                  <div>
                    <p className="section-label">GO TO FILE</p>
                    <h2>Quick open</h2>
                  </div>
                  <button type="button" onClick={() => setIsQuickOpen(false)}>
                    Close
                  </button>
                </div>
                <input
                  aria-label="Search files by title or path"
                  autoFocus
                  placeholder="Search files by title or path"
                  type="search"
                  value={quickOpenQuery}
                  onChange={(event) => {
                    setQuickOpenQuery(event.target.value);
                    setQuickOpenIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setQuickOpenIndex((current) =>
                        Math.min(
                          current + 1,
                          Math.max(quickOpenDocuments.length - 1, 0),
                        ),
                      );
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setQuickOpenIndex((current) => Math.max(current - 1, 0));
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const selected = quickOpenDocuments[quickOpenIndex];
                      if (!selected) return;
                      setIsQuickOpen(false);
                      void readDocument(selected.relativePath);
                    }
                  }}
                />
                <p className="quick-open-hint">
                  Use arrows and Enter, or press Escape to close.
                </p>
                <ul className="quick-open-results">
                  {quickOpenDocuments.length > 0 ? (
                    quickOpenDocuments.map((candidate, index) => (
                      <li key={candidate.relativePath}>
                        <button
                          className={
                            quickOpenIndex === index ? "is-active" : ""
                          }
                          type="button"
                          onClick={() => {
                            setIsQuickOpen(false);
                            void readDocument(candidate.relativePath);
                          }}
                        >
                          <strong>{candidate.title}</strong>
                          <span>{candidate.relativePath}</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="quick-open-empty">
                      No files match that search.
                    </li>
                  )}
                </ul>
              </section>
            </div>
          )}
          {document?.kind === "markdown" && isConnectionsOpen && (
            <aside className="connections-panel" aria-label="Connections">
              <div className="connections-heading">
                <div>
                  <p className="section-label">THIS NOTE</p>
                  <h2>Connections</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectionsOpen(false)}
                >
                  Close
                </button>
              </div>
              {!linkGraph ? (
                <div className="connections-empty">
                  <p>
                    Build the local link index to see this note’s outgoing links
                    and backlinks.
                  </p>
                  <button
                    className="vault-action-primary"
                    disabled={isLoadingLinkGraph}
                    type="button"
                    onClick={() => void buildLinkGraph()}
                  >
                    {isLoadingLinkGraph
                      ? "Building connections…"
                      : "Build connections"}
                  </button>
                  <p className="connections-note">
                    This creates only the rebuildable{" "}
                    <code>.brainarium/graph-v1.json</code> index.
                  </p>
                </div>
              ) : (
                <div className="connections-lists">
                  <section>
                    <h3>Outgoing · {outgoingLinks.length}</h3>
                    {outgoingLinks.length ? (
                      <ul>
                        {outgoingLinks.map((link) => (
                          <li key={`${link.source}-${link.target}`}>
                            <button
                              type="button"
                              onClick={() => void readDocument(link.target)}
                            >
                              {documentLabel(link.target, snapshot)}
                              <span>{link.target}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No resolved outgoing links.</p>
                    )}
                  </section>
                  <section>
                    <h3>Backlinks · {backlinks.length}</h3>
                    {backlinks.length ? (
                      <ul>
                        {backlinks.map((link) => (
                          <li key={`${link.source}-${link.target}`}>
                            <button
                              type="button"
                              onClick={() => void readDocument(link.source)}
                            >
                              {documentLabel(link.source, snapshot)}
                              <span>{link.source}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No backlinks yet.</p>
                    )}
                  </section>
                  <button
                    className="connections-graph-link"
                    type="button"
                    onClick={() => {
                      setIsConnectionsOpen(false);
                      setWorkspaceView("graph");
                      setGraphMode("local");
                    }}
                  >
                    Explore local graph
                  </button>
                </div>
              )}
            </aside>
          )}
          {workspaceView === "changes" ? (
            <ChangesView
              changed={reviewStates}
              documentPaths={
                new Set(
                  snapshot.documents.map((candidate) => candidate.relativePath),
                )
              }
              onMarkAllReviewed={() => void markAllDocumentsReviewed()}
              onMarkReviewed={(relativePath) =>
                void markReviewedAt(relativePath)
              }
              onOpenDocument={(relativePath) => void readDocument(relativePath)}
              requestChangeReview={(relativePath) =>
                window.brainarium.changeReview(relativePath)
              }
            />
          ) : workspaceView === "connections" ? (
            <section
              className="global-connections"
              aria-labelledby="connections-title"
            >
              <header className="document-toolbar">
                <div>
                  <p className="section-label">VAULT-WIDE NAVIGATION</p>
                  <h2 id="connections-title">Connections</h2>
                  <p>Explore the relationships across your whole vault.</p>
                </div>
                <button
                  className="vault-action-secondary"
                  disabled={isLoadingLinkGraph}
                  type="button"
                  onClick={() => void buildLinkGraph()}
                >
                  <Icon name="graph" />
                  {isLoadingLinkGraph ? "Building…" : "Refresh connections"}
                </button>
              </header>
              {!linkGraph ? (
                <div className="library-empty-state">
                  <Icon name="connections" />
                  <h3>Map your vault’s relationships</h3>
                  <p>
                    Build the local index to browse linked notes, backlinks, and
                    notes without connections.
                  </p>
                  <button
                    className="vault-action-primary"
                    type="button"
                    onClick={() => void buildLinkGraph()}
                  >
                    Build connection index
                  </button>
                </div>
              ) : (
                <div className="connection-overview">
                  <div className="connection-stat">
                    <strong>{linkGraph.nodes.length}</strong>
                    <span>notes</span>
                  </div>
                  <div className="connection-stat">
                    <strong>{linkGraph.edges.length}</strong>
                    <span>resolved links</span>
                  </div>
                  <div className="connection-list">
                    <h3>Most connected</h3>
                    <p>Open a note to explore its local context.</p>
                    <ul>
                      {linkGraph.nodes
                        .map((node) => ({
                          node,
                          count: linkGraph.edges.filter(
                            (edge) =>
                              edge.source === node.relativePath ||
                              edge.target === node.relativePath,
                          ).length,
                        }))
                        .sort(
                          (left, right) =>
                            right.count - left.count ||
                            left.node.title.localeCompare(right.node.title),
                        )
                        .slice(0, 12)
                        .map(({ node, count }) => (
                          <li key={node.relativePath}>
                            <button
                              type="button"
                              onClick={() =>
                                void readDocument(node.relativePath)
                              }
                            >
                              <span>{node.title}</span>
                              <em>{count} links</em>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div className="connection-list">
                    <h3>Orphan notes</h3>
                    <p>Notes with no resolved links yet.</p>
                    <ul>
                      {linkGraph.nodes
                        .filter(
                          (node) =>
                            !linkGraph.edges.some(
                              (edge) =>
                                edge.source === node.relativePath ||
                                edge.target === node.relativePath,
                            ),
                        )
                        .slice(0, 12)
                        .map((node) => (
                          <li key={node.relativePath}>
                            <button
                              type="button"
                              onClick={() =>
                                void readDocument(node.relativePath)
                              }
                            >
                              {node.title}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          ) : workspaceView === "graph" ? (
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
                  <div className="document-metadata-row">
                    <p className="section-label">
                      {document.kind.toUpperCase()}
                    </p>
                    {document.kind === "markdown" && (
                      <span
                        aria-live="polite"
                        className="document-save-status"
                        role="status"
                      >
                        {savedLabel}
                      </span>
                    )}
                  </div>
                  <h2 className="document-file-title">{document.title}</h2>
                  <p className="document-path">{document.relativePath}</p>
                </div>
                <div className="toolbar-actions">
                  {document.kind === "markdown" && (
                    <button
                      aria-expanded={isFindOpen}
                      title={`Find in file (${platformShortcuts.findInFile}) — keeps Reading preview open`}
                      type="button"
                      onClick={() => {
                        setIsFindOpen(true);
                        setFindIndex(-1);
                      }}
                    >
                      Find
                      <kbd>{platformShortcuts.findInFile}</kbd>
                    </button>
                  )}
                  {document.kind === "markdown" && (
                    <div
                      className="view-toggle"
                      role="group"
                      aria-label="Document view"
                    >
                      <button
                        aria-pressed={viewMode === "preview"}
                        className={viewMode === "preview" ? "active" : ""}
                        title={`Read (${platformShortcuts.toggleReadEdit})`}
                        type="button"
                        onClick={() => setViewMode("preview")}
                      >
                        Read
                      </button>
                      <button
                        aria-pressed={viewMode === "editor"}
                        className={viewMode === "editor" ? "active" : ""}
                        title={`Edit (${platformShortcuts.toggleReadEdit})`}
                        type="button"
                        onClick={() => setViewMode("editor")}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  {document.kind === "markdown" && viewMode === "editor" && (
                    <button
                      aria-pressed={editorMode === "source"}
                      className="editor-mode-action"
                      type="button"
                      onClick={() =>
                        setEditorMode(
                          editorMode === "assisted" ? "source" : "assisted",
                        )
                      }
                    >
                      {editorMode === "assisted" ? "Raw source" : "Assisted"}
                    </button>
                  )}
                  {document.kind === "markdown" && viewMode === "editor" && (
                    <button type="button" onClick={() => void importImage()}>
                      Move image
                    </button>
                  )}
                  {document.kind === "markdown" && viewMode === "editor" && (
                    <button
                      type="button"
                      onClick={() => editorRef.current?.openInsertMenu()}
                      title="Insert Markdown block (Cmd+Shift+I)"
                    >
                      Insert
                    </button>
                  )}
                  {document.kind === "markdown" && viewMode === "editor" && (
                    <button
                      type="button"
                      onClick={() => void saveDocument()}
                      disabled={session.status !== "dirty"}
                    >
                      {session.status === "saving" ? "Saving…" : "Save"}
                    </button>
                  )}
                  {hasTextContent(document.kind) && (
                    <button
                      aria-label={`Copy document content (${platformShortcuts.copyContent})`}
                      title={`Copy document content (${platformShortcuts.copyContent})`}
                      type="button"
                      onClick={() => void copyDocumentContent()}
                      disabled={isCopying}
                    >
                      {copied ? "Copied!" : isCopying ? "Copying…" : "Copy"}
                      <kbd>{platformShortcuts.copyContent}</kbd>
                    </button>
                  )}
                  {hasTextContent(document.kind) && (
                    <button
                      aria-label="Export document to PDF"
                      disabled={isExporting || session.status === "dirty"}
                      title={
                        session.status === "dirty"
                          ? "Save your changes first — Brainarium exports the saved file."
                          : "Export document to PDF"
                      }
                      type="button"
                      onClick={() => void exportDocumentPdf()}
                    >
                      {exportedFileName
                        ? `Exported ${exportedFileName}`
                        : isExporting
                          ? "Exporting…"
                          : "Export PDF"}
                    </button>
                  )}
                </div>
              </header>
              {document.kind === "markdown" && changeReview && (
                <section className="document-change-notice" role="status">
                  <span aria-hidden="true" className="tree-change-dot" />
                  Updated since you last reviewed — open Read mode to inspect
                  it.
                </section>
              )}
              {document.kind === "markdown" &&
                (session.status === "conflict" ||
                  session.status === "missing") && (
                  <DocumentConflictPanel
                    base={document}
                    disk={session.disk}
                    draft={editorText}
                    isComparing={isComparing}
                    isConfirmingReload={isConfirmingReload}
                    isReloading={isReloading}
                    onCancelReload={() => setIsConfirmingReload(false)}
                    onCompare={() => setIsComparing(!isComparing)}
                    onKeepMine={() => void keepMine()}
                    onRequestReload={() => setIsConfirmingReload(true)}
                    onReload={() => void reloadFromDisk()}
                    onRetry={() => void reloadFromDisk()}
                    state={session.status}
                  />
                )}
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
                      setFindIndex(-1);
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
                <div
                  className={
                    changeReview
                      ? "document-reading-layout has-change-review"
                      : "document-reading-layout"
                  }
                  style={
                    changeReview && reviewPanelWidth !== undefined
                      ? ({
                          "--change-review-panel-width": `${reviewPanelWidth}px`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <MarkdownReading
                    activeFindMatch={findIndex}
                    documents={snapshot.documents}
                    findQuery={isFindOpen ? findQuery : ""}
                    onOpenDocument={(relativePath, fragment) =>
                      void readDocument(relativePath, fragment)
                    }
                    onOpenExternal={openExternalLink}
                    source={editorText}
                    sourceRelativePath={document.relativePath}
                  />
                  {changeReview && (
                    <ChangeReviewPanel
                      onMarkReviewed={() => void markDocumentReviewed()}
                      onPanelWidthChange={setReviewPanelWidth}
                      panelWidth={preferredReviewPanelWidth}
                      review={changeReview}
                    />
                  )}
                </div>
              ) : document.kind === "image" && document.image ? (
                <ImageDocumentPreview document={document} />
              ) : document.kind === "pdf" && document.pdf ? (
                <PdfDocumentPreview document={document} />
              ) : document.kind === "markdown" ? (
                <MarkdownEditor
                  generation={session.generation}
                  mode={editorMode}
                  onChange={(text) => dispatchSession({ text, type: "edit" })}
                  onSave={() => void saveDocument()}
                  ref={editorRef}
                  value={editorText}
                />
              ) : document.kind === "csv" ? (
                <CsvPreview source={document.text} />
              ) : (
                <pre className="document-source">{document.text}</pre>
              )}
              {document.kind === "markdown" && viewMode === "preview" && (
                <InlineConnections
                  backlinks={backlinks}
                  onOpenDocument={(relativePath) =>
                    void readDocument(relativePath)
                  }
                  outgoingLinks={outgoingLinks}
                  snapshot={snapshot}
                />
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
        {fileContextMenu && (
          <div
            aria-label={`Actions for ${fileContextMenu.relativePath}`}
            className="file-context-menu"
            onPointerDown={(event) => event.stopPropagation()}
            role="menu"
            style={{
              left: `${fileContextMenu.x}px`,
              top: `${fileContextMenu.y}px`,
            }}
          >
            <p>{fileContextMenu.relativePath}</p>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                void copyDocumentPath(fileContextMenu.relativePath);
                setFileContextMenu(undefined);
              }}
            >
              Copy full path
            </button>
            <button
              disabled={!hasTextContent(fileContextMenu.kind)}
              role="menuitem"
              type="button"
              onClick={() => {
                void copyDocumentContent(fileContextMenu.relativePath);
                setFileContextMenu(undefined);
              }}
            >
              Copy content
            </button>
            <button
              disabled={!hasTextContent(fileContextMenu.kind)}
              role="menuitem"
              type="button"
              onClick={() => {
                void exportDocumentPdf(fileContextMenu.relativePath);
                setFileContextMenu(undefined);
              }}
            >
              Export to PDF…
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="welcome-shell">
      <div className="brand-lockup">
        <div className="wordmark" aria-hidden="true">
          B<span className="monogram-cursor">_</span>
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
        JSON, XML, HTML, PDFs, and common image files. Brainarium keeps the
        vault where it is and leaves its source in your hands.
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
