import { createHash } from 'node:crypto';

export interface ChunkOptions {
  documentId: string;
  maxCharacters: number;
  overlapCharacters: number;
}

export interface DocumentChunkDraft {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

function chunkId(documentId: string, ordinal: number): string {
  const bytes = createHash('sha256').update(`${documentId}:${ordinal}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function chunkText(text: string, options: ChunkOptions): DocumentChunkDraft[] {
  const { documentId, maxCharacters, overlapCharacters } = options;
  if (!documentId || !text.trim()) throw new Error('Document ID and nonempty text are required');
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 1 ||
      !Number.isSafeInteger(overlapCharacters) || overlapCharacters < 0 || overlapCharacters >= maxCharacters) {
    throw new Error('Chunk size must be positive and overlap must be smaller than chunk size');
  }

  const chunks: DocumentChunkDraft[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxCharacters, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1]!)) end--;
    if (end <= start) throw new Error('Chunk size cannot contain a Unicode character');
    const ordinal = chunks.length;
    chunks.push({ id: chunkId(documentId, ordinal), documentId, ordinal,
      text: text.slice(start, end), startOffset: start, endOffset: end });
    if (end === text.length) break;
    start = Math.max(start + 1, end - overlapCharacters);
    if (/[\uDC00-\uDFFF]/u.test(text[start]!)) start--;
  }
  return chunks;
}
