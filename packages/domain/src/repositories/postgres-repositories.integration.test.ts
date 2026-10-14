import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { migrate } from '../db.js';
import { PostgresDocumentRepository } from './postgres-document-repository.js';
import { PostgresConversationRepository } from './postgres-conversation-repository.js';
import { PostgresJobRepository } from './postgres-job-repository.js';
import { PgVectorStore } from './pgvector-store.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://agents:agents@localhost:5432/agents' });
const tenantA = { tenantId: randomUUID() };
const tenantB = { tenantId: randomUUID() };
const kbA = randomUUID();
const kbOther = randomUUID();
const kbB = randomUUID();
const documentId = randomUUID();
const objectKey = `${tenantA.tenantId}/${documentId}/source.txt`;

beforeAll(async () => {
  await migrate(pool);
  await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)', [tenantA.tenantId, 'A', tenantB.tenantId, 'B']);
  await pool.query('INSERT INTO knowledge_bases (id, tenant_id, name) VALUES ($1, $2, $3), ($4, $2, $5), ($6, $7, $8)', [kbA, tenantA.tenantId, 'A', kbOther, 'Other', kbB, tenantB.tenantId, 'B']);
});

afterAll(async () => {
  await pool.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantA.tenantId, tenantB.tenantId]);
  await pool.end();
});

describe('tenant-scoped PostgreSQL adapters', () => {
  const documents = new PostgresDocumentRepository(pool);
  const conversations = new PostgresConversationRepository(pool);
  const jobs = new PostgresJobRepository(pool);
  const vectors = new PgVectorStore(pool);

  it('keeps document reads and status updates in the owning tenant', async () => {
    await documents.create(tenantA, { id: documentId, knowledgeBaseId: kbA, filename: 'source.txt', contentType: 'text/plain', sizeBytes: 5, objectKey });
    expect((await documents.getById(tenantA, documentId))?.filename).toBe('source.txt');
    expect(await documents.getById(tenantB, documentId)).toBeNull();
    expect(await documents.listByTenant(tenantB)).toEqual([]);
    expect(await documents.updateStatus(tenantB, documentId, 'ready')).toBeNull();
    expect((await documents.getById(tenantA, documentId))?.status).toBe('pending');
    expect((await documents.updateStatus(tenantA, documentId, 'ready'))?.status).toBe('ready');
  });

  it('keeps conversation messages in the owning tenant', async () => {
    const conversationId = randomUUID();
    await conversations.create(tenantA, { id: conversationId, title: 'Q&A' });
    await conversations.addMessage(tenantA, { id: randomUUID(), conversationId, message: { role: 'user', content: 'Question' } });
    expect(await conversations.getById(tenantB, conversationId)).toBeNull();
    expect(await conversations.listMessages(tenantB, conversationId)).toEqual([]);
    expect((await conversations.listMessages(tenantA, conversationId))[0]?.message.content).toBe('Question');
  });

  it('claims a queued job once and makes terminal transitions idempotent', async () => {
    const jobId = randomUUID();
    await jobs.create(tenantA, { id: jobId, documentId });
    expect((await jobs.claimNextPending())?.id).toBe(jobId);
    expect(await jobs.claimNextPending()).toBeNull();
    expect((await jobs.markRunning(tenantA, jobId))?.attempts).toBe(1);
    expect((await jobs.markRunning(tenantA, jobId))?.attempts).toBe(1);
    expect((await jobs.markSucceeded(tenantA, jobId))?.status).toBe('completed');
    expect((await jobs.markFailed(tenantA, jobId, 'late failure'))?.status).toBe('completed');
    expect(await jobs.markSucceeded(tenantB, jobId)).toBeNull();
  });

  it('filters vector search by tenant and knowledge base and replaces chunks on retry', async () => {
    const embedding = Array.from({ length: 1536 }, (_, i) => i === 0 ? 1 : 0);
    const chunk = { id: randomUUID(), documentId, ordinal: 0, text: 'answer', embedding };
    await vectors.upsertChunks(tenantA.tenantId, kbA, [chunk]);
    await vectors.upsertChunks(tenantA.tenantId, kbA, [{ ...chunk, text: 'updated' }]);
    expect((await vectors.search(tenantA.tenantId, [kbA], embedding, 10)).map(result => result.text)).toEqual(['updated']);
    expect(await vectors.search(tenantA.tenantId, [kbOther], embedding, 10)).toEqual([]);
    expect(await vectors.search(tenantB.tenantId, [kbB], embedding, 10)).toEqual([]);
    await vectors.deleteDocument(tenantA.tenantId, kbA, documentId);
    expect(await vectors.search(tenantA.tenantId, [kbA], embedding, 10)).toEqual([]);
  });
});
