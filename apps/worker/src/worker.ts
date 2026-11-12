import type { IngestionJob, JobRepository } from '@agents-platform/domain';

export interface PollingWorkerDependencies {
  jobs: Pick<JobRepository, 'claimNextPending'>;
  processor: { processClaimedJob(job: IngestionJob): Promise<void> };
}

export function createPollingWorker({ jobs, processor }: PollingWorkerDependencies) {
  async function runOnce(): Promise<boolean> {
    const job = await jobs.claimNextPending();
    if (!job) return false;
    await processor.processClaimedJob(job);
    return true;
  }

  async function run(options: { signal: AbortSignal; pollIntervalMs?: number }): Promise<void> {
    const interval = options.pollIntervalMs ?? 1000;
    if (!Number.isSafeInteger(interval) || interval < 1)
      throw new Error('Poll interval must be a positive integer');
    while (!options.signal.aborted) {
      try {
        if (await runOnce()) continue;
      } catch (error) {
        // The processor persists the failure; the next poll can claim another job.
        console.error('Ingestion worker iteration failed', error);
      }
      if (options.signal.aborted) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, interval);
        options.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      });
    }
  }

  return { runOnce, run };
}
