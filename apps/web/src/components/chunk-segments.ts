export type SegmentChunk = {
  ordinal: number;
  startOffset: number | null;
  endOffset: number | null;
};

export type TextSegment = {
  text: string;
  /** Ordinals of every chunk covering this span; more than one means an overlap. Empty when uncovered. */
  ordinals: number[];
};

/**
 * Splits the extracted text at every chunk boundary so each span knows which chunks contain it.
 * Chunks without offsets (they no longer match the chunker output) are ignored.
 */
export function buildSegments(text: string, chunks: readonly SegmentChunk[]): TextSegment[] {
  const located = chunks.filter(
    (chunk): chunk is SegmentChunk & { startOffset: number; endOffset: number } =>
      chunk.startOffset !== null && chunk.endOffset !== null && chunk.endOffset > chunk.startOffset
  );
  const points = new Set<number>([0, text.length]);
  for (const chunk of located) {
    points.add(Math.min(chunk.startOffset, text.length));
    points.add(Math.min(chunk.endOffset, text.length));
  }
  const sorted = [...points].sort((a, b) => a - b);
  const segments: TextSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    if (end <= start) continue;
    segments.push({
      text: text.slice(start, end),
      ordinals: located
        .filter((chunk) => chunk.startOffset <= start && chunk.endOffset >= end)
        .map((chunk) => chunk.ordinal)
    });
  }
  return segments;
}
