/**
 * Stylesheet for served pages.
 *
 * Derived from the desktop reading surface — same serif, same 68ch measure,
 * same wide canvas for tables, code and images — but self-contained and
 * independent of the app shell. The desktop dark theme is scoped to
 * `.vault-shell` and the app defines no `prefers-color-scheme` rule anywhere,
 * so the tokens are re-scoped to `:root` here and follow the tablet's system
 * appearance instead.
 */
export const webStyles = `
:root {
  color-scheme: light;
  --br-bg: #e7e4da;
  --br-surface: #f6f3e9;
  --br-text: #273330;
  --br-muted: #56615b;
  --br-border: #aaa99f;
  --br-accent: #a5492f;
  --br-code: #3d4944;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --br-bg: #202725;
    --br-surface: #262e2b;
    --br-text: #f5f1e6;
    --br-muted: #a9b3ad;
    --br-border: #45514c;
    --br-accent: #f19b78;
    --br-code: #cfd8d3;
  }
}

* { box-sizing: border-box; }

body {
  background: var(--br-bg);
  color: var(--br-text);
  font-family: "Avenir Next", Avenir, "Helvetica Neue", Helvetica, sans-serif;
  margin: 0;
  -webkit-text-size-adjust: 100%;
}

a { color: var(--br-accent); }

.page-header {
  border-bottom: 1px solid var(--br-border);
  padding: 1rem 1.25rem;
}
.page-header a { text-decoration: none; }
.page-header h1 {
  font-size: 1.35rem;
  line-height: 1.25;
  margin: 0.15rem 0 0;
}
.page-path {
  color: var(--br-muted);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 0.78rem;
  margin: 0.3rem 0 0;
  overflow-wrap: anywhere;
}
.breadcrumb {
  color: var(--br-muted);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

main { padding: 1.25rem; }

/* ---------- reading surface ---------- */
.markdown-reading {
  font-family: Georgia, "Iowan Old Style", "Times New Roman", serif;
  font-size: 1.16rem;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 72rem;
}

/* Prose keeps a comfortable measure; wide content gets the whole canvas. */
.markdown-reading > :is(h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote) {
  margin-inline: auto;
  max-width: 68ch;
}
.markdown-reading > :is(pre, table, img, .table-wrap) {
  max-width: 100%;
}

.markdown-reading h1,
.markdown-reading h2,
.markdown-reading h3,
.markdown-reading h4,
.markdown-reading h5,
.markdown-reading h6 {
  font-family: "Avenir Next", Avenir, "Helvetica Neue", Helvetica, sans-serif;
  line-height: 1.25;
  margin: 1.8rem 0 0.6rem;
}
.markdown-reading h1 { font-size: 1.9rem; }
.markdown-reading h2 { font-size: 1.5rem; }
.markdown-reading h3 { font-size: 1.25rem; }
.markdown-reading h4,
.markdown-reading h5,
.markdown-reading h6 { font-size: 1.08rem; }

.markdown-reading p { margin: 0 0 1rem; }
.markdown-reading ul,
.markdown-reading ol { margin: 0 0 1rem; padding-left: 1.5rem; }
.markdown-reading li { margin-bottom: 0.35rem; }
.markdown-reading li::marker { color: var(--br-muted); }

.markdown-reading blockquote {
  border-left: 3px solid var(--br-border);
  color: var(--br-muted);
  margin: 0 auto 1rem;
  padding-left: 0.9rem;
}

.markdown-reading code {
  background: var(--br-surface);
  border-radius: 0.25rem;
  color: var(--br-code);
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.88em;
  overflow-wrap: anywhere;
  padding: 0.1rem 0.3rem;
}
.markdown-reading pre {
  background: var(--br-surface);
  border: 1px solid var(--br-border);
  border-radius: 0.4rem;
  margin: 0 0 1rem;
  overflow-x: auto;
  padding: 0.85rem 1rem;
}
.markdown-reading pre code {
  background: none;
  font-size: 0.92rem;
  padding: 0;
  white-space: pre;
}

.markdown-reading img {
  border-radius: 0.3rem;
  display: block;
  height: auto;
  margin: 1rem auto;
  max-width: 100%;
}

.markdown-reading table {
  border-collapse: collapse;
  font-family: "Avenir Next", Avenir, "Helvetica Neue", Helvetica, sans-serif;
  font-size: 0.92rem;
  width: 100%;
}
.markdown-reading :is(th, td) {
  border: 1px solid var(--br-border);
  padding: 0.4rem 0.6rem;
  text-align: left;
  vertical-align: top;
}
.markdown-reading th { background: var(--br-surface); font-weight: 600; }

.markdown-reading input[type="checkbox"] { margin-right: 0.4rem; }

.wiki-link-missing {
  border-bottom: 1px dotted var(--br-muted);
  color: var(--br-muted);
}

/* ---------- source-only documents ---------- */
main > pre {
  background: var(--br-surface);
  border: 1px solid var(--br-border);
  border-radius: 0.4rem;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.92rem;
  margin: 0 auto;
  max-width: 72rem;
  overflow-x: auto;
  padding: 1rem;
}

.csv-meta, .export-notice {
  color: var(--br-muted);
  font-size: 0.85rem;
  margin: 0 0 0.6rem;
}
table {
  border-collapse: collapse;
  font-size: 0.9rem;
  width: 100%;
}
table :is(th, td) {
  border: 1px solid var(--br-border);
  padding: 0.35rem 0.55rem;
  text-align: left;
  vertical-align: top;
}
thead th { background: var(--br-surface); position: sticky; top: 0; }

/* ---------- index ---------- */
.vault-index { margin: 0 auto; max-width: 60rem; }
.vault-index ul { list-style: none; margin: 0; padding-left: 1rem; }
.vault-index > ul { padding-left: 0; }
.vault-index li { margin: 0.15rem 0; }
.vault-index a {
  display: inline-block;
  padding: 0.35rem 0;
  text-decoration: none;
}
.vault-index a:hover { text-decoration: underline; }
.vault-index .folder {
  color: var(--br-muted);
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  margin-top: 0.9rem;
  text-transform: uppercase;
}
.kind {
  color: var(--br-muted);
  font-size: 0.72rem;
  margin-left: 0.4rem;
}

/* ---------- pairing ---------- */
.pair-form {
  margin: 4rem auto;
  max-width: 22rem;
  text-align: center;
}
.pair-form input {
  border: 1px solid var(--br-border);
  border-radius: 0.35rem;
  font-size: 1.4rem;
  letter-spacing: 0.3em;
  padding: 0.6rem;
  text-align: center;
  width: 100%;
}
.pair-form button {
  background: var(--br-accent);
  border: none;
  border-radius: 0.35rem;
  color: #fff;
  font-size: 1rem;
  margin-top: 0.8rem;
  padding: 0.7rem 1.2rem;
  width: 100%;
}

@media (max-width: 700px) {
  main { padding: 1rem 0.9rem; }
  .markdown-reading { font-size: 1.1rem; }
}
`;
