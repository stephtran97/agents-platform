import type { DocumentInspectionDto } from '@agents-platform/contracts';
import type { StoredChunk } from '@agents-platform/domain';
import { chunkText, type DocumentExtractor } from '@agents-platform/ingestion';

export type ChunkOptions = { maxCharacters: number; overlapCharacters: number };

/**
 * Re-extracts the stored file and re-chunks it with the ingestion chunker to recover each stored
 * chunk's source offsets. A stored chunk whose text no longer matches the re-chunk of the same
 * ordinal (e.g. the chunk settings changed since ingestion) is returned without offsets.
 */
export async function buildInspection(input: {
  document: DocumentInspectionDto['document'];
  loadContent: () => Promise<Buffer>;
  extractors: readonly DocumentExtractor[];
  chunkOptions: ChunkOptions;
  storedChunks: readonly StoredChunk[];
}): Promise<DocumentInspectionDto> {
  const { document, extractors, chunkOptions, storedChunks } = input;
  let extractedText: string | null = null;
  let extractionError: string | undefined;
  try {
    const extractor = extractors.find((candidate) =>
      candidate.supportedMimeTypes.includes(document.contentType)
    );
    if (!extractor) throw new Error(`Unsupported MIME type: ${document.contentType}`);
    extractedText = (await extractor.extract(await input.loadContent())).text;
  } catch (cause) {
    extractionError = cause instanceof Error ? cause.message : String(cause);
  }

  const recomputed = new Map<number, { text: string; startOffset: number; endOffset: number }>();
  if (extractedText?.trim()) {
    for (const chunk of chunkText(extractedText, { documentId: document.id, ...chunkOptions }))
      recomputed.set(chunk.ordinal, chunk);
  }

  return {
    document,
    extractedText,
    ...(extractionError ? { extractionError } : {}),
    chunkOptions,
    chunks: [...storedChunks]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((stored) => {
        const match = recomputed.get(stored.ordinal);
        const aligned = match !== undefined && match.text === stored.text;
        return {
          id: stored.id,
          ordinal: stored.ordinal,
          text: stored.text,
          startOffset: aligned ? match.startOffset : null,
          endOffset: aligned ? match.endOffset : null
        };
      })
  };
}
