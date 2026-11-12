export * from './chunking/chunker.js';
export * from './extractors/extractor.js';
export * from './extractors/docx-extractor.js';
export * from './extractors/pdf-extractor.js';
export * from './extractors/plain-text-extractor.js';

import { DocxExtractor } from './extractors/docx-extractor.js';
import { PdfExtractor } from './extractors/pdf-extractor.js';
import { PlainTextExtractor } from './extractors/plain-text-extractor.js';
import type { DocumentExtractor } from './extractors/extractor.js';

/** Chunk sizing shared by ingestion and document inspection so both always agree. */
export const defaultChunkOptions = { maxCharacters: 1200, overlapCharacters: 120 } as const;

export function createDefaultExtractors(): DocumentExtractor[] {
  return [new PlainTextExtractor(), new PdfExtractor(), new DocxExtractor()];
}
