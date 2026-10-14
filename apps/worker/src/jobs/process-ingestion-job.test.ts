import { describe, expect, it, vi } from 'vitest';
import type { Document, IngestionJob } from '@agents-platform/domain';
import { createIngestionJobProcessor } from './process-ingestion-job.js';

const now = new Date('2026-01-01T00:00:00.000Z');
const document: Document = {
  id: '11111111-1111-4111-8111-111111111111', tenantId: 'tenant-a', knowledgeBaseId: 'kb-a',
  filename: 'notes.txt', contentType: 'text/plain', sizeBytes: 5, objectKey: 'file-a',
  status: 'pending', createdAt: now, updatedAt: now,
};
const job: IngestionJob = {
  id: '22222222-2222-4222-8222-222222222222', tenantId: 'tenant-a', documentId: document.id,
  status: 'queued', attempts: 0, createdAt: now, updatedAt: now,
};

function fixture(contentType = 'text/plain') {
  let currentJob: IngestionJob = { ...job };
  let currentDocument: Document = { ...document, contentType };
  const vectors = new Map<string, string>();
  const jobs = {
    claimPending: vi.fn(async (id: string) => {
      if (id !== currentJob.id || currentJob.status !== 'queued') return null;
      currentJob = { ...currentJob, status: 'processing' as const, attempts: currentJob.attempts + 1 };
      return currentJob;
    }),
    markSucceeded: vi.fn(async () => { currentJob = { ...currentJob, status: 'completed' }; return currentJob; }),
    markFailed: vi.fn(async (_context: unknown, _id: string, error: string) => {
      currentJob = { ...currentJob, status: 'failed', error }; return currentJob;
    }),
  };
  const documents = {
    getById: vi.fn(async () => currentDocument),
    updateStatus: vi.fn(async (_context: unknown, _id: string, status: Document['status']) => {
      currentDocument = { ...currentDocument, status }; return currentDocument;
    }),
  };
  const objectStore = { get: vi.fn(async () => Buffer.from('hello')) };
  const embeddings = { embed: vi.fn(async (inputs: readonly string[]) => inputs.map(() => [0.1, 0.2])) };
  const vectorStore = {
    upsertChunks: vi.fn(async (_tenant: string, _kb: string, chunks: readonly { id: string; text: string }[]) => {
      for (const chunk of chunks) vectors.set(chunk.id, chunk.text);
    }),
  };
  const extractor = { supportedMimeTypes: ['text/plain'], extract: vi.fn(async () => ({ text: 'hello' })) };
  const processor = createIngestionJobProcessor({ jobs, documents, objectStore, vectorStore, embeddings,
    extractors: [extractor], chunkOptions: { maxCharacters: 4, overlapCharacters: 1 } });
  return { processor, jobs, documents, objectStore, embeddings, vectorStore, extractor, vectors,
    getJob: () => currentJob, getDocument: () => currentDocument,
    requeue: () => { currentJob = { ...currentJob, status: 'queued' }; } };
}

describe('processIngestionJob', () => {
  it('persists DOCUMENT_UNSUPPORTED and fails the document for unknown MIME', async () => {
    const f = fixture('image/png');
    await expect(f.processor.processIngestionJob(job.id)).rejects.toMatchObject({ code: 'DOCUMENT_UNSUPPORTED' });
    expect(f.getJob()).toMatchObject({ status: 'failed', error: expect.stringContaining('DOCUMENT_UNSUPPORTED') });
    expect(f.getDocument().status).toBe('failed');
    expect(f.objectStore.get).not.toHaveBeenCalled();
  });

  it('persists INGESTION_FAILED with a message when extraction fails', async () => {
    const f = fixture();
    f.extractor.extract.mockRejectedValueOnce(new Error('corrupt file'));
    await expect(f.processor.processIngestionJob(job.id)).rejects.toMatchObject({ code: 'INGESTION_FAILED' });
    expect(f.getJob()).toMatchObject({ status: 'failed', error: expect.stringContaining('corrupt file') });
    expect(f.getDocument().status).toBe('failed');
  });

  it('retries with stable vector IDs and does not duplicate chunks', async () => {
    const f = fixture();
    f.vectorStore.upsertChunks.mockRejectedValueOnce(new Error('temporary vector failure'));
    await expect(f.processor.processIngestionJob(job.id)).rejects.toMatchObject({ code: 'INGESTION_FAILED' });
    f.requeue();
    await f.processor.processIngestionJob(job.id);
    expect(f.getJob()).toMatchObject({ status: 'completed', attempts: 2 });
    expect(f.getDocument().status).toBe('ready');
    expect(f.vectors.size).toBe(2);
    expect(f.vectorStore.upsertChunks.mock.calls[0]?.[2]).toEqual(f.vectorStore.upsertChunks.mock.calls[1]?.[2]);
    await f.processor.processIngestionJob(job.id);
    expect(f.embeddings.embed).toHaveBeenCalledTimes(3);
  });

  it('preserves tenant scope when reading and writing', async () => {
    const f = fixture();
    await f.processor.processIngestionJob(job.id);
    expect(f.documents.getById).toHaveBeenCalledWith({ tenantId: 'tenant-a' }, document.id);
    expect(f.vectorStore.upsertChunks).toHaveBeenCalledWith('tenant-a', 'kb-a', expect.any(Array));
    expect(f.documents.updateStatus).toHaveBeenCalledWith({ tenantId: 'tenant-a' }, document.id, 'ready');
  });
});
