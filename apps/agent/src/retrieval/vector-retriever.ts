import type { LlmClient } from '@agents-platform/clients';
import type { PgVectorStore } from '@agents-platform/domain';
import type { RetrievalQuery, RetrievedChunk, Retriever } from './retriever.js';

export class VectorRetriever implements Retriever {
  constructor(private readonly vectors: Pick<PgVectorStore, 'search'>, private readonly llm: Pick<LlmClient, 'embed'>, private readonly embeddingModel = 'text-embedding-3-small') {}

  async search(input: RetrievalQuery): Promise<RetrievedChunk[]> {
    const embedding = await this.llm.embed({ model: this.embeddingModel, input: input.query });
    const results = await this.vectors.search(input.tenantId, input.knowledgeBaseIds, embedding.embeddings[0] ?? [], input.limit);
    return results.map((result) => ({
      chunkId: result.id,
      documentId: result.documentId,
      content: result.text,
      filename: result.filename ?? result.documentId,
      score: result.score,
    }));
  }
}
