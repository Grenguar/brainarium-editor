export type ProjectionChange = {
  from: number;
  insert: string;
  to: number;
};

/**
 * Keeps exact vault source authoritative while CodeMirror works on the
 * line-feed projection it expects. Only edited ranges are rewritten: existing
 * CRLF/mixed separators and the final-newline state stay untouched.
 */
export class SourceBuffer {
  private source: string;
  private readonly preferredLineEnding: "\n" | "\r\n";

  constructor(source: string) {
    this.source = source;
    this.preferredLineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  }

  text(): string {
    return this.source;
  }

  projection(): string {
    return normalizeLineEndings(this.source);
  }

  sourceOffsetForProjectionOffset(projectionOffset: number): number {
    const projection = this.projection();
    if (projectionOffset < 0 || projectionOffset > projection.length) {
      throw new RangeError("The projection selection is outside the document.");
    }

    let rawOffset = 0;
    let normalizedOffset = 0;
    while (
      rawOffset < this.source.length &&
      normalizedOffset < projectionOffset
    ) {
      if (
        this.source[rawOffset] === "\r" &&
        this.source[rawOffset + 1] === "\n"
      ) {
        rawOffset += 1;
      }
      rawOffset += 1;
      normalizedOffset += 1;
    }
    return rawOffset;
  }

  projectionOffsetForSourceOffset(sourceOffset: number): number {
    if (sourceOffset < 0 || sourceOffset > this.source.length) {
      throw new RangeError("The source selection is outside the document.");
    }

    let rawOffset = 0;
    let normalizedOffset = 0;
    while (rawOffset < sourceOffset) {
      if (
        this.source[rawOffset] === "\r" &&
        this.source[rawOffset + 1] === "\n"
      ) {
        rawOffset += 1;
        if (rawOffset === sourceOffset) break;
      }
      rawOffset += 1;
      normalizedOffset += 1;
    }
    return normalizedOffset;
  }

  applyProjectionChanges(changes: readonly ProjectionChange[]): string {
    const beforeProjection = this.projection();
    const ordered = [...changes].sort((left, right) => right.from - left.from);
    for (const change of ordered) {
      if (
        change.from < 0 ||
        change.to < change.from ||
        change.to > beforeProjection.length
      ) {
        throw new RangeError("CodeMirror produced an invalid source change.");
      }
      const from = this.sourceOffsetForProjectionOffset(change.from);
      const to = this.sourceOffsetForProjectionOffset(change.to);
      const insert = change.insert.replaceAll("\n", this.preferredLineEnding);
      this.source = `${this.source.slice(0, from)}${insert}${this.source.slice(to)}`;
    }

    return this.source;
  }
}

export const normalizeLineEndings = (source: string): string =>
  source.replaceAll("\r\n", "\n");
