/**
 * Styles for the printed document. Deliberately independent of the app's
 * stylesheet: the export is always light, uses only system fonts (the print
 * document's CSP forbids loading any), and is tuned for paginated output
 * rather than a scrolling window.
 */
export const printStyles = `
:root { color-scheme: light; }

@page { size: A4; margin: 18mm; }

body {
  background: #fff;
  color: #273330;
  font-family: "Avenir Next", Avenir, "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  margin: 0;
}

.export-header { border-bottom: 1px solid #ccc; margin-bottom: 1.2em; padding-bottom: 0.6em; }
.export-header h1 { font-size: 17pt; margin: 0 0 0.2em; }
.export-path { color: #6b7671; font-size: 9pt; margin: 0; }

.export-notice, .csv-meta { color: #6b7671; font-size: 9pt; margin: 0 0 0.6em; }

h1, h2, h3, h4, h5, h6 { break-after: avoid; line-height: 1.25; }
h1 { font-size: 16pt; }
h2 { font-size: 13.5pt; }
h3 { font-size: 12pt; }

p, ul, ol { margin: 0 0 0.75em; }
li { break-inside: avoid; }

/* Paper has no horizontal scrolling, so long lines must wrap rather than clip. */
pre, code, samp, kbd {
  font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 9pt;
}
pre {
  background: #f5f5f3;
  border: 1px solid #e0e0dc;
  border-radius: 3pt;
  break-inside: avoid;
  overflow-wrap: anywhere;
  padding: 6pt 8pt;
  white-space: pre-wrap;
}
code { overflow-wrap: anywhere; }

blockquote {
  border-left: 2pt solid #d0d0cb;
  break-inside: avoid;
  color: #4a5551;
  margin: 0 0 0.75em;
  padding-left: 8pt;
}

table {
  border-collapse: collapse;
  font-size: 8.5pt;
  table-layout: fixed;
  width: 100%;
}
/* Repeats the header row on every page of a long table. */
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td {
  border: 1px solid #c9c9c4;
  overflow-wrap: anywhere;
  padding: 2pt 4pt;
  text-align: left;
  vertical-align: top;
}
th { background: #f0f0ed; font-weight: 600; }

img { break-inside: avoid; height: auto; max-width: 100%; }

a { color: #1f5c4a; }
hr { border: none; border-top: 1px solid #d0d0cb; margin: 1em 0; }
`;
