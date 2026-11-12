import type { DocumentStatus } from '@agents-platform/contracts';
import type { Document } from '../entities.js';
import type { TenantContext } from '../tenant-context.js';

export type NewDocument = Pick<
  Document,
  'id' | 'knowledgeBaseId' | 'filename' | 'contentType' | 'sizeBytes' | 'objectKey'
>;

export interface DocumentRepository {
  create(context: TenantContext, document: NewDocument): Promise<Document>;
  getById(context: TenantContext, id: string): Promise<Document | null>;
  listByTenant(context: TenantContext): Promise<Document[]>;
  updateStatus(
    context: TenantContext,
    id: string,
    status: DocumentStatus
  ): Promise<Document | null>;
}
