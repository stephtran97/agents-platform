export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  content: string;
  filename: string;
  score: number;
  startOffset?: number;
  endOffset?: number;
};

export type RetrievalQuery = {
  tenantId: string;
  knowledgeBaseIds: string[];
  query: string;
  limit: number;
};

/** Port the runtime depends on; implementations must enforce tenant and knowledge-base scope. */
export interface Retriever {
  search(input: RetrievalQuery): Promise<RetrievedChunk[]>;
}
