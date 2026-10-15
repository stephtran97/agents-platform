CREATE EXTENSION IF NOT EXISTS vector;

-- Keep this vector(1536) declaration in sync with EMBEDDING_DIMENSION in ports/vector-store.ts.
CREATE TABLE document_chunks (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  knowledge_base_id uuid NOT NULL,
  document_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  text text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_id, ordinal),
  FOREIGN KEY (tenant_id, knowledge_base_id, document_id)
    REFERENCES documents (tenant_id, knowledge_base_id, id) ON DELETE CASCADE
);
CREATE INDEX document_chunks_scope_idx ON document_chunks (tenant_id, knowledge_base_id, document_id);
CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);
