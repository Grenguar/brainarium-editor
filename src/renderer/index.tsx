import { createRoot } from "react-dom/client";
import { useState } from "react";

import type { VaultSnapshot, VaultTreeNode } from "../shared/contracts/vault";

import "./styles.css";

const TreeNode = ({ node }: { node: VaultTreeNode }): React.JSX.Element => {
  if (node.kind !== "directory") {
    return (
      <li className="tree-file">
        <span aria-hidden="true">{node.kind === "csv" ? "▦" : "⌁"}</span>
        {node.name}
      </li>
    );
  }

  return (
    <li>
      <span className="tree-directory">{node.name || "Vault"}</span>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.relativePath} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
};

const App = (): React.JSX.Element => {
  const [snapshot, setSnapshot] = useState<VaultSnapshot>();
  const [isChoosing, setIsChoosing] = useState(false);
  const [error, setError] = useState<string>();

  const chooseVault = async (): Promise<void> => {
    setIsChoosing(true);
    setError(undefined);
    try {
      const result = await window.brainarium.chooseVault();
      if (!result.cancelled) {
        setSnapshot(result.snapshot);
      }
    } catch {
      setError(
        "Brainarium could not open that folder. Check its permissions and try again.",
      );
    } finally {
      setIsChoosing(false);
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
            <TreeNode node={snapshot.tree} />
          </ul>
        </section>
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
        Open any folder of Markdown and CSV files. Brainarium keeps the vault
        where it is and leaves its source in your hands.
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
        Markdown and CSV stay local. Nothing is imported or copied.
      </p>
    </main>
  );
};

const root = document.getElementById("root");

if (!root) {
  throw new Error("Brainarium could not find its renderer root.");
}

createRoot(root).render(<App />);
