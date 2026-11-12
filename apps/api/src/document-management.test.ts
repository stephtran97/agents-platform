import { describe, expect, it } from 'vitest';
import type { Document, StoredChunk } from '@agents-platform/domain';
import { chunkText } from '@agents-platform/ingestion';
import { createApp } from './index.js';
import { createPersistentStore } from './store.js';

const agent = { answer: async () => ({ answer: '', citations: [], toolCalls: [], traceId: 't' }) };
const chunkOptions = { maxCharacters: 10, overlapCharacters: 2 };
const text = 'abcdefghij klmnopqrst uvwxyz';

describe('document management API', () => {
  async function upload(app: ReturnType<typeof createApp>, tenant: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: { 'x-tenant-id': tenant },
      payload: {
        filename: 'notes.txt',
        contentType: 'text/plain',
        contentBase64: Buffer.from(text).toString('base64')
      }
    });
    return response.json().id as string;
  }

  it('returns the re-extracted text for the owning tenant only', async () => {
    const app = createApp(agent);
    const id = await upload(app, 'tenant-a');

    const own = await app.inject({
      method: 'GET',
      url: `/v1/documents/${id}/chunks`,
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().extractedText).toBe(text);
    expect(own.json().document.id).toBe(id);

    const other = await app.inject({
      method: 'GET',
      url: `/v1/documents/${id}/chunks`,
      headers: { 'x-tenant-id': 'tenant-b' }
    });
    expect(other.statusCode).toBe(404);
  });

  it('deletes a document and refuses cross-tenant deletes', async () => {
    const app = createApp(agent);
    const id = await upload(app, 'tenant-a');

    const foreign = await app.inject({
      method: 'DELETE',
      url: `/v1/documents/${id}`,
      headers: { 'x-tenant-id': 'tenant-b' }
    });
    expect(foreign.statusCode).toBe(404);
    const stillThere = await app.inject({
      method: 'GET',
      url: `/v1/documents/${id}`,
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    expect(stillThere.statusCode).toBe(200);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/v1/documents/${id}`,
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    expect(deleted.statusCode).toBe(204);
    const gone = await app.inject({
      method: 'GET',
      url: `/v1/documents/${id}`,
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    expect(gone.statusCode).toBe(404);
    const repeat = await app.inject({
      method: 'DELETE',
      url: `/v1/documents/${id}`,
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    expect(repeat.statusCode).toBe(404);
  });
});

describe('persistent store document management', () => {
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  const kb = '33333333-3333-3333-3333-333333333333';

  function build(contentType = 'text/plain') {
    const documents = new Map<string, Document>();
    const objects = new Map<string, Buffer>();
    const chunks = new Map<string, StoredChunk[]>();
    const document: Document = {
      id: 'doc-1',
      tenantId: tenantA,
      knowledgeBaseId: kb,
      filename: 'notes.txt',
      contentType,
      sizeBytes: text.length,
      objectKey: 'objects/doc-1',
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    documents.set(document.id, document);
    objects.set(document.objectKey, Buffer.from(text));
    const stored = chunkText(text, { documentId: document.id, ...chunkOptions }).map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      ordinal: chunk.ordinal,
      text: chunk.text
    }));
    chunks.set(document.id, stored);
    const deletedKeys: string[] = [];
    const store = createPersistentStore({
      documents: {
        getById: async (context: { tenantId: string }, id: string) => {
          const found = documents.get(id);
          return found && found.tenantId === context.tenantId ? found : null;
        },
        delete: async (context: { tenantId: string }, id: string) => {
          const found = documents.get(id);
          if (!found || found.tenantId !== context.tenantId) return false;
          documents.delete(id);
          chunks.delete(id);
          return true;
        }
      } as never,
      conversations: {} as never,
      jobs: {} as never,
      tenantScopes: {} as never,
      objectStore: {
        get: async (key: string) => objects.get(key)!,
        delete: async (key: string) => {
          deletedKeys.push(key);
          objects.delete(key);
        }
      } as never,
      vectorStore: {
        listDocumentChunks: async (tenantId: string, _kb: string, documentId: string) =>
          documents.get(documentId)?.tenantId === tenantId ? (chunks.get(documentId) ?? []) : []
      },
      chunkOptions
    });
    return { store, documents, objects, chunks, deletedKeys, stored };
  }

  it('aligns stored chunks with offsets in the re-extracted text', async () => {
    const { store, stored } = build();
    const inspection = await store.inspectDocument(tenantA, 'doc-1');
    expect(inspection?.extractedText).toBe(text);
    expect(inspection?.chunks).toHaveLength(stored.length);
    for (const chunk of inspection!.chunks)
      expect(text.slice(chunk.startOffset!, chunk.endOffset!)).toBe(chunk.text);
  });

  it('drops offsets for stored chunks that no longer match the chunker output', async () => {
    const { store, chunks } = build();
    chunks.set(
      'doc-1',
      chunks.get('doc-1')!.map((chunk) => ({ ...chunk, text: `${chunk.text}!` }))
    );
    const inspection = await store.inspectDocument(tenantA, 'doc-1');
    expect(inspection?.chunks.every((c) => c.startOffset === null && c.endOffset === null)).toBe(
      true
    );
  });

  it('reports an extraction error without failing for unsupported types', async () => {
    const { store, stored } = build('image/png');
    const inspection = await store.inspectDocument(tenantA, 'doc-1');
    expect(inspection?.extractedText).toBeNull();
    expect(inspection?.extractionError).toMatch(/Unsupported MIME type/);
    expect(inspection?.chunks).toHaveLength(stored.length);
  });

  it('does not inspect or delete another tenant’s document', async () => {
    const { store, documents, deletedKeys } = build();
    expect(await store.inspectDocument(tenantB, 'doc-1')).toBeNull();
    expect(await store.deleteDocument(tenantB, 'doc-1')).toBe(false);
    expect(documents.has('doc-1')).toBe(true);
    expect(deletedKeys).toEqual([]);
  });

  it('deletes the document row, its chunks and the stored file', async () => {
    const { store, documents, objects, chunks, deletedKeys } = build();
    expect(await store.deleteDocument(tenantA, 'doc-1')).toBe(true);
    expect(documents.has('doc-1')).toBe(false);
    expect(chunks.has('doc-1')).toBe(false);
    expect(objects.has('objects/doc-1')).toBe(false);
    expect(deletedKeys).toEqual(['objects/doc-1']);
    expect(await store.deleteDocument(tenantA, 'doc-1')).toBe(false);
  });
});
