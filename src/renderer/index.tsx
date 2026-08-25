import { createRoot } from "react-dom/client";

import "./styles.css";

const App = (): React.JSX.Element => (
  <main>
    <h1>Brainarium</h1>
    <p>Choose a Markdown or CSV vault to begin.</p>
  </main>
);

const root = document.getElementById("root");

if (!root) {
  throw new Error("Brainarium could not find its renderer root.");
}

createRoot(root).render(<App />);
