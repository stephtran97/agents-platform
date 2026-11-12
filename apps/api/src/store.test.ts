import { describe, expect, it } from 'vitest';
import { defaultKnowledgeBaseId, type Document } from '@agents-platform/domain';
import { createPersistentStore } from './store.js';

const kbId = defaultKnowledgeBaseId('11111111-1111-1111-1111-111111111111');

function build() {
  const created: Array<{ tenantId: string; knowledgeBaseId: string }> = [];
  const ensured: string[] = [];
  const store = createPersistentStore({
    documents: {
      create: async (context, doc) => { created.push({ tenantId: context.tenantId, knowledgeBaseId: doc.knowledgeBaseId }); return { ...doc, tenantId: context.tenantId, status: 'pending', createdAt: new Date(), updatedAt: new Date() } as Document; },
      getById: async () => null, listByTenant: async () => [], updateStatus: async () => null,
    },
    conversations: { create: async (context: { tenantId: string }, c: { id: string }) => ({ ...c, tenantId: context.tenantId, createdAt: new Date(), updatedAt: new Date() }), getById: async () => null } as never,
    jobs: { create: async () => ({}) } as never,
    objectStore: { put: async () => 'key' } as never,
    tenantScopes: {
      ensureTenant: async (context) => { ensured.push(context.tenantId); },
      ensureDefaultKnowledgeBase: async (context) => { ensured.push(context.tenantId); return defaultKnowledgeBaseId(context.tenantId); },
    },
  });
  return { store, created, ensured };
}

describe('persistent store', () => {
  it('files new documents under the tenant default knowledge base UUID', async () => {
    const { store, created, ensured } = build();
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const document = await store.createDocument({ tenantId, filename: 'a.txt', contentType: 'text/plain', sizeBytes: 1 });
    expect(created).toEqual([{ tenantId, knowledgeBaseId: kbId }]);
    expect(document.knowledgeBaseId).toBe(kbId);
    expect(ensured).toEqual([tenantId]);
  });

  it('ensures the tenant exists before creating a conversation', async () => {
    const { store, ensured } = build();
    await store.createConversation('22222222-2222-2222-2222-222222222222');
    expect(ensured).toEqual(['22222222-2222-2222-2222-222222222222']);
  });
});
