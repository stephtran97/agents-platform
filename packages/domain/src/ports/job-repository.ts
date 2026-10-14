import type { IngestionJob } from '../entities.js';
import type { TenantContext } from '../tenant-context.js';

export type NewIngestionJob = Pick<IngestionJob, 'id' | 'documentId'>;

export interface JobRepository {
  create(context: TenantContext, job: NewIngestionJob): Promise<IngestionJob>;
  claimPending(jobId: string): Promise<IngestionJob | null>;
  claimNextPending(): Promise<IngestionJob | null>;
  markRunning(context: TenantContext, jobId: string): Promise<IngestionJob | null>;
  markSucceeded(context: TenantContext, jobId: string): Promise<IngestionJob | null>;
  markFailed(context: TenantContext, jobId: string, error: string): Promise<IngestionJob | null>;
}
