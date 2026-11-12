import { randomUUID } from 'node:crypto';
import type { DocumentInspectionDto } from '@agents-platform/contracts';
import {
  createDefaultExtractors,
  defaultChunkOptions,
  type DocumentExtractor
} from '@agents-platform/ingestion';
import type {
  ConversationRepository,
  DocumentRepository,
  JobRepository,
  ObjectStore,
  TenantScopeRepository,
  VectorStore
} from '@agents-platform/domain';
import type { Conversation, Document } from '@agents-platform/domain';
import { buildInspection, type ChunkOptions } from './document-inspection.js';

export type ApiDocument = Pick<
  Document,
  'id' | 'tenantId' | 'knowledgeBaseId' | 'filename' | 'contentType' | 'sizeBytes' | 'status'
> & { createdAt: string };
export type ApiConversation = Pick<Conversation, 'id' | 'tenantId'> & { createdAt: string };
export type ApiMessage = { role: 'user' | 'assistant'; content: string };
export type ApiStore = {
  listDocuments(tenantId: string): Promise<ApiDocument[]>;
  getDocument(tenantId: string, id: string): Promise<ApiDocument | null>;
  createDocument(input: {
    tenantId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    content?: Buffer;
  }): Promise<ApiDocument>;
  /** Deletes the document with its stored file, chunks and jobs. False when absent in the tenant. */
  deleteDocument(tenantId: string, id: string): Promise<boolean>;
  inspectDocument(tenantId: string, id: string): Promise<DocumentInspectionDto | null>;
  createConversation(tenantId: string): Promise<ApiConversation>;
  getConversation(tenantId: string, id: string): Promise<ApiConversation | null>;
  addMessage(
    tenantId: string,
    conversationId: string,
    message: ApiMessage,
    citations?: Array<{ documentId: string; chunkId: string }>
  ): Promise<void>;
  listMessages(tenantId: string, conversationId: string): Promise<ApiMessage[]>;
};

export function createMemoryStore(
  options: { extractors?: readonly DocumentExtractor[]; chunkOptions?: ChunkOptions } = {}
): ApiStore {
  const extractors = options.extractors ?? createDefaultExtractors();
  const chunkOptions = options.chunkOptions ?? defaultChunkOptions;
  const documents: ApiDocument[] = [];
  const contents = new Map<string, Buffer>();
  const conversations: ApiConversation[] = [];
  const messages: Array<ApiMessage & { tenantId: string; conversationId: string }> = [];
  return {
    listDocuments: async (tenantId) =>
      documents.filter((document) => document.tenantId === tenantId),
    getDocument: async (tenantId, id) =>
      documents.find((document) => document.tenantId === tenantId && document.id === id) ?? null,
    createDocument: async (input) => {
      const document: ApiDocument = {
        id: randomUUID(),
        tenantId: input.tenantId,
        knowledgeBaseId: 'default',
        filename: input.filename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      documents.push(document);
      if (input.content) contents.set(document.id, input.content);
      return document;
    },
    deleteDocument: async (tenantId, id) => {
      const index = documents.findIndex(
        (document) => document.tenantId === tenantId && document.id === id
      );
      if (index < 0) return false;
      documents.splice(index, 1);
      contents.delete(id);
      return true;
    },
    inspectDocument: async (tenantId, id) => {
      const document = documents.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === id
      );
      if (!document) return null;
      return buildInspection({
        document,
        loadContent: async () => {
          const content = contents.get(id);
          if (!content) throw new Error('Document has no stored content');
          return content;
        },
        extractors,
        chunkOptions,
        storedChunks: []
      });
    },
    createConversation: async (tenantId) => {
      const conversation = { id: randomUUID(), tenantId, createdAt: new Date().toISOString() };
      conversations.push(conversation);
      return conversation;
    },
    getConversation: async (tenantId, id) =>
      conversations.find(
        (conversation) => conversation.tenantId === tenantId && conversation.id === id
      ) ?? null,
    addMessage: async (tenantId, conversationId, message) => {
      messages.push({ ...message, tenantId, conversationId });
    },
    listMessages: async (tenantId, conversationId) =>
      messages
        .filter((m) => m.tenantId === tenantId && m.conversationId === conversationId)
        .map(({ role, content }) => ({ role, content }))
  };
}

function mapDocument(document: Document): ApiDocument {
  return {
    id: document.id,
    tenantId: document.tenantId,
    knowledgeBaseId: document.knowledgeBaseId,
    filename: document.filename,
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    createdAt: document.createdAt.toISOString()
  };
}
function mapConversation(conversation: Conversation): ApiConversation {
  return {
    id: conversation.id,
    tenantId: conversation.tenantId,
    createdAt: conversation.createdAt.toISOString()
  };
}

export function createPersistentStore(deps: {
  documents: DocumentRepository;
  conversations: ConversationRepository;
  jobs: JobRepository;
  objectStore: ObjectStore;
  tenantScopes: TenantScopeRepository;
  vectorStore: Pick<VectorStore, 'listDocumentChunks'>;
  extractors?: readonly DocumentExtractor[];
  chunkOptions?: ChunkOptions;
}): ApiStore {
  const extractors = deps.extractors ?? createDefaultExtractors();
  const chunkOptions = deps.chunkOptions ?? defaultChunkOptions;
  return {
    listDocuments: async (tenantId) =>
      (await deps.documents.listByTenant({ tenantId })).map(mapDocument),
    getDocument: async (tenantId, id) => {
      const document = await deps.documents.getById({ tenantId }, id);
      return document ? mapDocument(document) : null;
    },
    createDocument: async (input) => {
      const id = randomUUID();
      const knowledgeBaseId = await deps.tenantScopes.ensureDefaultKnowledgeBase({
        tenantId: input.tenantId
      });
      const objectKey = input.content
        ? await deps.objectStore.put(input.tenantId, id, input.content, input.contentType)
        : `pending/${input.tenantId}/${id}`;
      const document = await deps.documents.create(
        { tenantId: input.tenantId },
        {
          id,
          knowledgeBaseId,
          filename: input.filename,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          objectKey
        }
      );
      await deps.jobs.create({ tenantId: input.tenantId }, { id: randomUUID(), documentId: id });
      return mapDocument(document);
    },
    deleteDocument: async (tenantId, id) => {
      const document = await deps.documents.getById({ tenantId }, id);
      if (!document) return false;
      // Chunks, embeddings and jobs are removed by the database cascade on the document row.
      if (!(await deps.documents.delete({ tenantId }, id))) return false;
      await deps.objectStore.delete(document.objectKey);
      return true;
    },
    inspectDocument: async (tenantId, id) => {
      const document = await deps.documents.getById({ tenantId }, id);
      if (!document) return null;
      return buildInspection({
        document: mapDocument(document),
        loadContent: () => deps.objectStore.get(document.objectKey),
        extractors,
        chunkOptions,
        storedChunks: await deps.vectorStore.listDocumentChunks(
          tenantId,
          document.knowledgeBaseId,
          id
        )
      });
    },
    createConversation: async (tenantId) => {
      await deps.tenantScopes.ensureTenant({ tenantId });
      return mapConversation(
        await deps.conversations.create({ tenantId }, { id: randomUUID(), title: undefined })
      );
    },
    getConversation: async (tenantId, id) => {
      const conversation = await deps.conversations.getById({ tenantId }, id);
      return conversation ? mapConversation(conversation) : null;
    },
    addMessage: async (tenantId, conversationId, message, citations) => {
      await deps.conversations.addMessage(
        { tenantId },
        {
          id: randomUUID(),
          conversationId,
          message: { role: message.role, content: message.content },
          citations
        }
      );
    },
    listMessages: async (tenantId, conversationId) =>
      (await deps.conversations.listMessages({ tenantId }, conversationId)).flatMap((m) =>
        m.message.role === 'user' || m.message.role === 'assistant'
          ? [{ role: m.message.role, content: m.message.content }]
          : []
      )
  };
}
