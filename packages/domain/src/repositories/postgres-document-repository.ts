import type { DocumentStatus } from '@agents-platform/contracts';
import type { Pool, QueryResultRow } from 'pg';
import type { Document } from '../entities.js';
import type { TenantContext } from '../tenant-context.js';
import type { DocumentRepository, NewDocument } from '../ports/document-repository.js';

interface DocumentRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  knowledge_base_id: string;
  filename: string;
  content_type: string;
  size_bytes: string;
  object_key: string;
  status: DocumentStatus;
  created_at: Date;
  updated_at: Date;
}

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id, tenantId: row.tenant_id, knowledgeBaseId: row.knowledge_base_id,
    filename: row.filename, contentType: row.content_type, sizeBytes: Number(row.size_bytes),
    objectKey: row.object_key, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class PostgresDocumentRepository implements DocumentRepository {
  constructor(private readonly pool: Pool) {}

  async create(context: TenantContext, document: NewDocument): Promise<Document> {
    const result = await this.pool.query<DocumentRow>(
      `INSERT INTO documents (id, tenant_id, knowledge_base_id, filename, content_type, size_bytes, object_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [document.id, context.tenantId, document.knowledgeBaseId, document.filename,
        document.contentType, document.sizeBytes, document.objectKey],
    );
    return toDocument(result.rows[0]!);
  }

  async getById(context: TenantContext, id: string): Promise<Document | null> {
    const result = await this.pool.query<DocumentRow>('SELECT * FROM documents WHERE tenant_id = $1 AND id = $2', [context.tenantId, id]);
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  }

  async listByTenant(context: TenantContext): Promise<Document[]> {
    const result = await this.pool.query<DocumentRow>('SELECT * FROM documents WHERE tenant_id = $1 ORDER BY created_at DESC, id', [context.tenantId]);
    return result.rows.map(toDocument);
  }

  async updateStatus(context: TenantContext, id: string, status: DocumentStatus): Promise<Document | null> {
    const result = await this.pool.query<DocumentRow>(
      'UPDATE documents SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2 RETURNING *',
      [context.tenantId, id, status],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  }
}
