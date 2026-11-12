import { randomUUID } from 'node:crypto';
import type { ConversationRepository, DocumentRepository, JobRepository, ObjectStore, TenantScopeRepository } from '@agents-platform/domain';
import type { Conversation, Document } from '@agents-platform/domain';

export type ApiDocument = Pick<Document, 'id' | 'tenantId' | 'knowledgeBaseId' | 'filename' | 'contentType' | 'sizeBytes' | 'status'> & { createdAt: string };
export type ApiConversation = Pick<Conversation, 'id' | 'tenantId'> & { createdAt: string };
export type ApiStore = { listDocuments(tenantId: string): Promise<ApiDocument[]>; getDocument(tenantId: string, id: string): Promise<ApiDocument | null>; createDocument(input: { tenantId: string; filename: string; contentType: string; sizeBytes: number; content?: Buffer }): Promise<ApiDocument>; createConversation(tenantId: string): Promise<ApiConversation>; getConversation(tenantId: string, id: string): Promise<ApiConversation | null> };

export function createMemoryStore(): ApiStore {
  const documents: ApiDocument[] = []; const conversations: ApiConversation[] = [];
  return {
    listDocuments: async (tenantId) => documents.filter((document) => document.tenantId === tenantId),
    getDocument: async (tenantId, id) => documents.find((document) => document.tenantId === tenantId && document.id === id) ?? null,
    createDocument: async (input) => { const document: ApiDocument = { id: randomUUID(), tenantId: input.tenantId, knowledgeBaseId: 'default', filename: input.filename, contentType: input.contentType, sizeBytes: input.sizeBytes, status: 'pending', createdAt: new Date().toISOString() }; documents.push(document); return document; },
    createConversation: async (tenantId) => { const conversation = { id: randomUUID(), tenantId, createdAt: new Date().toISOString() }; conversations.push(conversation); return conversation; },
    getConversation: async (tenantId, id) => conversations.find((conversation) => conversation.tenantId === tenantId && conversation.id === id) ?? null,
  };
}

function mapDocument(document: Document): ApiDocument { return { id: document.id, tenantId: document.tenantId, knowledgeBaseId: document.knowledgeBaseId, filename: document.filename, contentType: document.contentType, sizeBytes: document.sizeBytes, status: document.status, createdAt: document.createdAt.toISOString() }; }
function mapConversation(conversation: Conversation): ApiConversation { return { id: conversation.id, tenantId: conversation.tenantId, createdAt: conversation.createdAt.toISOString() }; }

export function createPersistentStore(deps: { documents: DocumentRepository; conversations: ConversationRepository; jobs: JobRepository; objectStore: ObjectStore; tenantScopes: TenantScopeRepository }): ApiStore {
  return {
    listDocuments: async (tenantId) => (await deps.documents.listByTenant({ tenantId })).map(mapDocument),
    getDocument: async (tenantId, id) => { const document = await deps.documents.getById({ tenantId }, id); return document ? mapDocument(document) : null; },
    createDocument: async (input) => { const id = randomUUID(); const knowledgeBaseId = await deps.tenantScopes.ensureDefaultKnowledgeBase({ tenantId: input.tenantId }); const objectKey = input.content ? await deps.objectStore.put(input.tenantId, id, input.content, input.contentType) : `pending/${input.tenantId}/${id}`; const document = await deps.documents.create({ tenantId: input.tenantId }, { id, knowledgeBaseId, filename: input.filename, contentType: input.contentType, sizeBytes: input.sizeBytes, objectKey }); await deps.jobs.create({ tenantId: input.tenantId }, { id: randomUUID(), documentId: id }); return mapDocument(document); },
    createConversation: async (tenantId) => { await deps.tenantScopes.ensureTenant({ tenantId }); return mapConversation(await deps.conversations.create({ tenantId }, { id: randomUUID(), title: undefined })); },
    getConversation: async (tenantId, id) => { const conversation = await deps.conversations.getById({ tenantId }, id); return conversation ? mapConversation(conversation) : null; },
  };
}
