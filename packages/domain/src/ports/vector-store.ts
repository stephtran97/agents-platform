export const EMBEDDING_DIMENSION = 768;

export interface DocumentChunkInput {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
  embedding: readonly number[];
}

export interface VectorSearchResult {
  id: string;
  documentId: string;
  knowledgeBaseId: string;
  ordinal: number;
  text: string;
  score: number;
  /** Source document filename, when the store can resolve it. */
  filename?: string;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  ordinal: number;
  text: string;
}

export interface VectorStore {
  upsertChunks(
    tenantId: string,
    knowledgeBaseId: string,
    chunks: readonly DocumentChunkInput[]
  ): Promise<void>;
  search(
    tenantId: string,
    knowledgeBaseIds: readonly string[],
    embedding: readonly number[],
    limit: number
  ): Promise<VectorSearchResult[]>;
  /** Lists a document's stored chunks (without embeddings) in ordinal order. */
  listDocumentChunks(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<StoredChunk[]>;
  deleteDocument(tenantId: string, knowledgeBaseId: string, documentId: string): Promise<void>;
}
