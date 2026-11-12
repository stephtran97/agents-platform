export const EMBEDDING_DIMENSION = 1536;

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

export interface VectorStore {
  upsertChunks(tenantId: string, knowledgeBaseId: string, chunks: readonly DocumentChunkInput[]): Promise<void>;
  search(tenantId: string, knowledgeBaseIds: readonly string[], embedding: readonly number[], limit: number): Promise<VectorSearchResult[]>;
  deleteDocument(tenantId: string, knowledgeBaseId: string, documentId: string): Promise<void>;
}
