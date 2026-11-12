import type { Pool, QueryResultRow } from 'pg';
import { EMBEDDING_DIMENSION } from '../ports/vector-store.js';
import type { DocumentChunkInput, VectorSearchResult, VectorStore } from '../ports/vector-store.js';

interface SearchRow extends QueryResultRow {
  id: string;
  document_id: string;
  knowledge_base_id: string;
  ordinal: number;
  text: string;
  filename: string | null;
  score: number;
}

function vectorLiteral(embedding: readonly number[]): string {
  if (
    embedding.length !== EMBEDDING_DIMENSION ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`Embedding must contain ${EMBEDDING_DIMENSION} finite values`);
  }
  return `[${embedding.join(',')}]`;
}

export class PgVectorStore implements VectorStore {
  constructor(private readonly pool: Pool) {}

  async upsertChunks(
    tenantId: string,
    knowledgeBaseId: string,
    chunks: readonly DocumentChunkInput[]
  ): Promise<void> {
    for (const chunk of chunks) {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO document_chunks (id, tenant_id, knowledge_base_id, document_id, ordinal, text, embedding)
         SELECT $1, d.tenant_id, d.knowledge_base_id, d.id, $5, $6, $7::vector
         FROM documents d
         WHERE d.tenant_id = $2 AND d.knowledge_base_id = $3 AND d.id = $4
         ON CONFLICT (id) DO UPDATE SET
           ordinal = EXCLUDED.ordinal, text = EXCLUDED.text,
           embedding = EXCLUDED.embedding, updated_at = now()
         WHERE document_chunks.tenant_id = EXCLUDED.tenant_id
           AND document_chunks.knowledge_base_id = EXCLUDED.knowledge_base_id
           AND document_chunks.document_id = EXCLUDED.document_id
         RETURNING id`,
        [
          chunk.id,
          tenantId,
          knowledgeBaseId,
          chunk.documentId,
          chunk.ordinal,
          chunk.text,
          vectorLiteral(chunk.embedding)
        ]
      );
      if (result.rows.length === 0)
        throw new Error('Chunk could not be written in tenant and knowledge base');
    }
  }

  async search(
    tenantId: string,
    knowledgeBaseIds: readonly string[],
    embedding: readonly number[],
    limit: number
  ): Promise<VectorSearchResult[]> {
    const vector = vectorLiteral(embedding);
    if (knowledgeBaseIds.length === 0 || limit <= 0) return [];
    const result = await this.pool.query<SearchRow>(
      `SELECT c.id, c.document_id, c.knowledge_base_id, c.ordinal, c.text, d.filename,
              (1 - (c.embedding <=> $3::vector))::float8 AS score
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id AND d.tenant_id = c.tenant_id
       WHERE c.tenant_id = $1 AND c.knowledge_base_id = ANY($2::uuid[])
       ORDER BY c.embedding <=> $3::vector, c.id
       LIMIT $4`,
      [tenantId, knowledgeBaseIds, vector, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      knowledgeBaseId: row.knowledge_base_id,
      ordinal: row.ordinal,
      text: row.text,
      score: row.score,
      filename: row.filename ?? undefined
    }));
  }

  async deleteDocument(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<void> {
    await this.pool.query(
      'DELETE FROM document_chunks WHERE tenant_id = $1 AND knowledge_base_id = $2 AND document_id = $3',
      [tenantId, knowledgeBaseId, documentId]
    );
  }
}
