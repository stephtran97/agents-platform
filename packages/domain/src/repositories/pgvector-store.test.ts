import { expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PgVectorStore } from './pgvector-store.js';

it('scopes vector writes and searches to tenant and knowledge base', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool = {
    query: async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      return { rows: sql.includes('INSERT INTO document_chunks') ? [{ id: 'chunk' }] : [] };
    }
  } as unknown as Pool;
  const store = new PgVectorStore(pool);
  const embedding = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0));

  await store.upsertChunks('tenant', 'kb', [
    { id: 'chunk', documentId: 'doc', ordinal: 0, text: 'answer', embedding }
  ]);
  await store.search('tenant', ['kb'], embedding, 5);
  await store.deleteDocument('tenant', 'kb', 'doc');

  expect(calls).toHaveLength(3);
  expect(calls[0]?.sql).toMatch(
    /FROM documents.*tenant_id = \$\d+.*knowledge_base_id = \$\d+.*id = \$\d+/s
  );
  expect(calls[0]?.values.slice(0, 3)).toEqual(['chunk', 'tenant', 'kb']);
  expect(calls[1]?.sql).toMatch(/tenant_id = \$\d+.*knowledge_base_id = ANY\(\$\d+::uuid\[\]\)/s);
  expect(calls[1]?.values.slice(0, 2)).toEqual(['tenant', ['kb']]);
  expect(calls[2]?.sql).toMatch(
    /tenant_id = \$\d+.*knowledge_base_id = \$\d+.*document_id = \$\d+/s
  );
  expect(calls[2]?.values).toEqual(['tenant', 'kb', 'doc']);
});

it('rejects embeddings with the wrong dimension before querying', async () => {
  let queried = false;
  const pool = {
    query: async () => {
      queried = true;
      return { rows: [] };
    }
  } as unknown as Pool;
  const store = new PgVectorStore(pool);

  await expect(store.search('tenant', ['kb'], [1], 5)).rejects.toThrow(/1536/);
  expect(queried).toBe(false);
});
