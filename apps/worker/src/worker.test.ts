import { describe, expect, it, vi } from 'vitest';
import type { IngestionJob } from '@agents-platform/domain';
import { createPollingWorker } from './worker.js';

const job: IngestionJob = {
  id: '22222222-2222-4222-8222-222222222222', tenantId: 'tenant-a',
  documentId: '11111111-1111-4111-8111-111111111111', status: 'processing',
  attempts: 1, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
};

describe('polling worker', () => {
  it('passes the already claimed job to the processor once', async () => {
    const jobs = { claimNextPending: vi.fn().mockResolvedValueOnce(job).mockResolvedValueOnce(null) };
    const processor = { processClaimedJob: vi.fn(async (_job: IngestionJob) => {}) };
    const worker = createPollingWorker({ jobs, processor });

    expect(await worker.runOnce()).toBe(true);
    expect(await worker.runOnce()).toBe(false);
    expect(jobs.claimNextPending).toHaveBeenCalledTimes(2);
    expect(processor.processClaimedJob).toHaveBeenCalledExactlyOnceWith(job);
  });
});
