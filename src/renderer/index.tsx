import { createRoot } from "react-dom/client";
import { useEffect, useState, type ReactNode } from "react";

import type {
  RecentVault,
  VaultDocumentContent,
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

const renderInline = (text: string): ReactNode[] => {
  const parts = text.split(
    /(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g,
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

const MarkdownReading = ({ source }: { source: string }): React.JSX.Element => {
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
      blocks.push(<Tag key={cursor}>{renderInline(heading[2])}</Tag>);
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
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote key={cursor}>
          {renderInline(line.replace(/^>\s?/, ""))}
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
                  <th key={index}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((_cell, cellIndex) => (
                    <td key={cellIndex}>
                      {renderInline(row[cellIndex] ?? "")}
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
    blocks.push(<p key={cursor}>{renderInline(paragraph.join(" "))}</p>);
  }
  return <article className="markdown-reading">{blocks}</article>;
};

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
  const [graphStatus, setGraphStatus] = useState<string>();
  const [error, setError] = useState<string>();

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
          ? `Local graph built with ${graph.nodeCount} nodes. Graph explorer is the next workspace view.`
          : "Graphify completed, but its no-LLM build found no graph nodes in this text vault.",
      );
    } catch {
      setGraphStatus(
        "Graphify is unavailable. Install graphify-rs or set BRAINARIUM_GRAPHIFY_BIN, then try again.",
      );
    } finally {
      setIsBuildingGraph(false);
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

  if (snapshot) {
    return (
      <main className="vault-shell">
        <aside className="vault-sidebar">
          <div className="vault-sidebar-heading">
            <p className="eyebrow">OPEN VAULT</p>
            <h1>{snapshot.tree.name}</h1>
            <p>{snapshot.documents.length} readable documents</p>
            <button
              type="button"
              onClick={() => void chooseVault()}
              disabled={isChoosing}
            >
              Open another vault
            </button>
            <button
              type="button"
              onClick={() => void buildGraph()}
              disabled={isBuildingGraph}
            >
              {isBuildingGraph ? "Building graph…" : "Build local graph"}
            </button>
            {graphStatus && <p className="graph-status">{graphStatus}</p>}
          </div>
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
          {document ? (
            <>
              <header className="document-toolbar">
                <div>
                  <p className="section-label">{document.kind.toUpperCase()}</p>
                  <h2>{document.title}</h2>
                </div>
                <div className="toolbar-actions">
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
                        ◉
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
              {document.kind === "markdown" && viewMode === "preview" ? (
                <MarkdownReading source={document.text} />
              ) : document.kind === "markdown" ? (
                <textarea
                  aria-label="Markdown editor"
                  className="document-editor"
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
