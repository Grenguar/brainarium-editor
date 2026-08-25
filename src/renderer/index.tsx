import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";

import type {
  RecentVault,
  VaultDocumentContent,
  VaultSnapshot,
  VaultTreeNode,
} from "../shared/contracts/vault";

import "./styles.css";

const TreeNode = ({
  node,
  onSelect,
}: {
  node: VaultTreeNode;
  onSelect: (relativePath: string) => void;
}): React.JSX.Element => {
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
      <span className="tree-directory">{node.name || "Vault"}</span>
      {node.children.length > 0 && (
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

const App = (): React.JSX.Element => {
  const [snapshot, setSnapshot] = useState<VaultSnapshot>();
  const [document, setDocument] = useState<VaultDocumentContent>();
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const [isChoosing, setIsChoosing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
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
      await refreshRecents();
    } catch {
      setError("That vault is unavailable. Choose another folder to continue.");
    }
  };

  const readDocument = async (relativePath: string): Promise<void> => {
    setError(undefined);
    try {
      setDocument(await window.brainarium.readDocument(relativePath));
    } catch {
      setError(
        "Brainarium could not read that file. It may have changed outside the vault.",
      );
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
    } catch {
      setError("Brainarium could not copy that file. Try opening it again.");
    } finally {
      setIsCopying(false);
    }
  };

  if (snapshot) {
    return (
      <main className="vault-shell">
        <header className="vault-header">
          <div>
            <p className="eyebrow">OPEN VAULT</p>
            <h1>{snapshot.tree.name}</h1>
            <p>{snapshot.documents.length} readable documents</p>
          </div>
          <button
            type="button"
            onClick={() => void chooseVault()}
            disabled={isChoosing}
          >
            Open another vault
          </button>
        </header>
        <section className="vault-tree" aria-label="Vault files">
          <p className="section-label">FILES</p>
          <ul>
            <TreeNode
              node={snapshot.tree}
              onSelect={(relativePath) => void readDocument(relativePath)}
            />
          </ul>
        </section>
        {document && (
          <section className="document-preview" aria-label="Document preview">
            <div className="preview-heading">
              <div>
                <p className="section-label">
                  SOURCE PREVIEW · {document.kind.toUpperCase()}
                </p>
                <h2>{document.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => void copyDocumentContent()}
                disabled={isCopying}
              >
                {copied
                  ? "Copied"
                  : isCopying
                    ? "Copying…"
                    : "Copy file content"}
              </button>
            </div>
            <pre>{document.text}</pre>
          </section>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
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
        {snapshot.issues.length > 0 && (
          <p className="notice">
            {snapshot.issues.length} unavailable item
            {snapshot.issues.length === 1 ? "" : "s"} stayed outside this vault.
          </p>
        )}
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
