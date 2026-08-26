export type MarkdownInsertCommand = {
  id: string;
  label: string;
  description: string;
  keywords: readonly string[];
  text: string;
  selectionOffset?: number;
};

/**
 * These are deliberately plain Markdown snippets. The editor never creates a
 * private block format, so an inserted document remains usable everywhere
 * Markdown is supported.
 */
export const markdownInsertCommands: readonly MarkdownInsertCommand[] = [
  {
    id: "paragraph",
    label: "Paragraph",
    description: "Plain text",
    keywords: ["text"],
    text: "Text",
  },
  {
    id: "heading-1",
    label: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "title"],
    text: "# Heading 1",
  },
  {
    id: "heading-2",
    label: "Heading 2",
    description: "Section heading",
    keywords: ["h2"],
    text: "## Heading 2",
  },
  {
    id: "heading-3",
    label: "Heading 3",
    description: "Subsection heading",
    keywords: ["h3"],
    text: "### Heading 3",
  },
  {
    id: "heading-4",
    label: "Heading 4",
    description: "Subsection heading",
    keywords: ["h4"],
    text: "#### Heading 4",
  },
  {
    id: "heading-5",
    label: "Heading 5",
    description: "Subsection heading",
    keywords: ["h5"],
    text: "##### Heading 5",
  },
  {
    id: "heading-6",
    label: "Heading 6",
    description: "Subsection heading",
    keywords: ["h6"],
    text: "###### Heading 6",
  },
  {
    id: "bullet-list",
    label: "Bulleted list",
    description: "Unordered list",
    keywords: ["bullet", "ul"],
    text: "- Item",
  },
  {
    id: "numbered-list",
    label: "Numbered list",
    description: "Ordered list",
    keywords: ["ordered", "ol"],
    text: "1. Item",
  },
  {
    id: "task-list",
    label: "Task list",
    description: "GFM checkbox",
    keywords: ["todo", "checkbox", "checklist"],
    text: "- [ ] Task",
  },
  {
    id: "quote",
    label: "Quote",
    description: "Block quote",
    keywords: ["blockquote"],
    text: "> Quote",
  },
  {
    id: "code-block",
    label: "Code block",
    description: "Fenced code block",
    keywords: ["code", "fence"],
    text: "```\ncode\n```",
    selectionOffset: 4,
  },
  {
    id: "horizontal-rule",
    label: "Horizontal rule",
    description: "Section divider",
    keywords: ["divider", "hr"],
    text: "---",
  },
  {
    id: "link",
    label: "Link",
    description: "Markdown link",
    keywords: ["url", "hyperlink"],
    text: "[Link text](https://example.com)",
    selectionOffset: 1,
  },
  {
    id: "image",
    label: "Image",
    description: "Image reference",
    keywords: ["photo", "picture"],
    text: "![Alt text](path/to/image.png)",
    selectionOffset: 2,
  },
  {
    id: "table",
    label: "Table",
    description: "GFM table",
    keywords: ["gfm", "grid"],
    text: "| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |",
    selectionOffset: 2,
  },
];

export const filterMarkdownInsertCommands = (
  query: string,
): MarkdownInsertCommand[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...markdownInsertCommands];
  return markdownInsertCommands.filter((command) =>
    [command.label, command.description, ...command.keywords]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
};

export type SlashCommandQuery = { from: number; query: string };

/** Finds a slash command immediately before a collapsed cursor on its line. */
export const slashCommandQueryAt = (
  line: string,
  lineFrom: number,
  cursor: number,
): SlashCommandQuery | null => {
  const beforeCursor = line.slice(0, cursor - lineFrom);
  const match = /(?:^|\s)\/([\w-]*(?: [\w-]+)*)$/.exec(beforeCursor);
  if (!match) return null;
  return {
    from: lineFrom + match.index + (match[0].startsWith(" ") ? 1 : 0),
    query: match[1],
  };
};

export const insertionSelection = (
  from: number,
  command: MarkdownInsertCommand,
): { anchor: number; head: number } => {
  const offset = command.selectionOffset ?? command.text.length;
  return { anchor: from + offset, head: from + offset };
};

export const insertMarkdownAtRange = (
  source: string,
  { from, to }: { from: number; to: number },
  command: MarkdownInsertCommand,
): string => `${source.slice(0, from)}${command.text}${source.slice(to)}`;
