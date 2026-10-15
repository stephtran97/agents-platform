import type { LlmClient } from '@agents-platform/clients';
import type { PgVectorStore } from '@agents-platform/domain';
import type { RetrievedChunk } from '../runtimes/basic-rag-runtime.js';

export class VectorRetriever {
  constructor(private readonly vectors: PgVectorStore, private readonly llm: LlmClient, private readonly embeddingModel = 'text-embedding-3-small') {}
  async search(input: { tenantId: string; knowledgeBaseIds: string[]; query: string; limit: number }): Promise<RetrievedChunk[]> {
    const embedding = await this.llm.embed({ model: this.embeddingModel, input: input.query });
    const results = await this.vectors.search(input.tenantId, input.knowledgeBaseIds, embedding.embeddings[0] ?? [], input.limit);
    return results.map((result) => ({ chunkId: result.id, documentId: result.documentId, content: result.text, filename: result.documentId, score: result.score }));
  }
}
