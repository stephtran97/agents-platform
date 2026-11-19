-- Switch the embedding column from 1536 to 768 dimensions (nomic-embed-text; OpenAI
-- text-embedding-3-* models are asked for 768 dimensions). Keep this in sync with
-- EMBEDDING_DIMENSION in ports/vector-store.ts.
-- Vectors of different sizes cannot be converted, so stored chunks are dropped and every
-- existing document is queued again so the worker re-embeds it.
DROP INDEX IF EXISTS document_chunks_embedding_idx;
DELETE FROM document_chunks;
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(768);
CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

WITH requeued AS (
  UPDATE documents SET status = 'pending', updated_at = now()
  WHERE status IN ('ready', 'processing')
  RETURNING id, tenant_id
)
INSERT INTO ingestion_jobs (id, tenant_id, document_id)
SELECT gen_random_uuid(), tenant_id, id FROM requeued;
