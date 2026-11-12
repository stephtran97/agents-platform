import type { IngestionJobStatus } from '@agents-platform/contracts';
import type { Pool, QueryResultRow } from 'pg';
import type { IngestionJob } from '../entities.js';
import type { TenantContext } from '../tenant-context.js';
import type { JobRepository, NewIngestionJob } from '../ports/job-repository.js';

interface JobRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  document_id: string;
  status: IngestionJobStatus;
  attempts: number;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

function toJob(row: JobRow): IngestionJob {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    documentId: row.document_id,
    status: row.status,
    attempts: row.attempts,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class PostgresJobRepository implements JobRepository {
  constructor(private readonly pool: Pool) {}

  async create(context: TenantContext, job: NewIngestionJob): Promise<IngestionJob> {
    const inserted = await this.pool.query<JobRow>(
      `INSERT INTO ingestion_jobs (id, tenant_id, document_id)
       SELECT $1, d.tenant_id, d.id FROM documents d WHERE d.tenant_id = $2 AND d.id = $3
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [job.id, context.tenantId, job.documentId]
    );
    if (inserted.rows[0]) return toJob(inserted.rows[0]);
    const existing = await this.getById(context, job.id);
    if (existing && existing.documentId === job.documentId) return existing;
    throw new Error('Job could not be created in tenant');
  }

  async getById(context: TenantContext, jobId: string): Promise<IngestionJob | null> {
    const result = await this.pool.query<JobRow>(
      'SELECT * FROM ingestion_jobs WHERE tenant_id = $1 AND id = $2',
      [context.tenantId, jobId]
    );
    return result.rows[0] ? toJob(result.rows[0]) : null;
  }

  async claimNextPending(): Promise<IngestionJob | null> {
    const result = await this.pool.query<JobRow>(
      `UPDATE ingestion_jobs SET status = 'processing', attempts = attempts + 1, updated_at = now()
       WHERE id = (SELECT id FROM ingestion_jobs WHERE status = 'queued'
                   ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
       RETURNING *`
    );
    return result.rows[0] ? toJob(result.rows[0]) : null;
  }

  async claimPending(jobId: string): Promise<IngestionJob | null> {
    const result = await this.pool.query<JobRow>(
      `UPDATE ingestion_jobs SET status = 'processing', attempts = attempts + 1, updated_at = now()
       WHERE id = $1 AND status = 'queued' RETURNING *`,
      [jobId]
    );
    return result.rows[0] ? toJob(result.rows[0]) : null;
  }

  async markRunning(context: TenantContext, jobId: string): Promise<IngestionJob | null> {
    const result = await this.pool.query<JobRow>(
      `UPDATE ingestion_jobs SET status = 'processing', attempts = attempts + 1, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = 'queued' RETURNING *`,
      [context.tenantId, jobId]
    );
    return result.rows[0] ? toJob(result.rows[0]) : this.getById(context, jobId);
  }

  async markSucceeded(context: TenantContext, jobId: string): Promise<IngestionJob | null> {
    return this.finish(context, jobId, 'completed', null);
  }

  async markFailed(
    context: TenantContext,
    jobId: string,
    error: string
  ): Promise<IngestionJob | null> {
    return this.finish(context, jobId, 'failed', error);
  }

  private async finish(
    context: TenantContext,
    jobId: string,
    status: 'completed' | 'failed',
    error: string | null
  ): Promise<IngestionJob | null> {
    const result = await this.pool.query<JobRow>(
      `UPDATE ingestion_jobs SET status = $3, error = $4, updated_at = now()
       WHERE tenant_id = $1 AND id = $2 AND status = 'processing' RETURNING *`,
      [context.tenantId, jobId, status, error]
    );
    return result.rows[0] ? toJob(result.rows[0]) : this.getById(context, jobId);
  }
}
