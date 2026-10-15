import type { DocumentStatus, IngestionJobStatus, Message } from '@agents-platform/contracts';

export interface TenantOwnedEntity {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBase extends TenantOwnedEntity {
  name: string;
  description?: string;
}

export interface Document extends TenantOwnedEntity {
  knowledgeBaseId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  status: DocumentStatus;
}

export interface IngestionJob extends TenantOwnedEntity {
  documentId: string;
  status: IngestionJobStatus;
  attempts: number;
  error?: string;
}

export interface Conversation extends TenantOwnedEntity {
  title?: string;
}

export interface ConversationMessage extends TenantOwnedEntity {
  conversationId: string;
  message: Message;
  citations?: Array<{ documentId: string; chunkId: string }>;
}
