import type {
  DocumentRepository,
  IngestionJob,
  JobRepository,
  ObjectStore,
  VectorStore
} from '@agents-platform/domain';
import { chunkText, type DocumentExtractor } from '@agents-platform/ingestion';
import type { EmbeddingClient } from '../embedding/embedding-client.js';

export interface IngestionJobDependencies {
  jobs: Pick<JobRepository, 'claimPending' | 'markSucceeded' | 'markFailed'>;
  documents: Pick<DocumentRepository, 'getById' | 'updateStatus'>;
  objectStore: Pick<ObjectStore, 'get'>;
  vectorStore: Pick<VectorStore, 'upsertChunks'>;
  embeddings: EmbeddingClient;
  extractors: readonly DocumentExtractor[];
  chunkOptions: { maxCharacters: number; overlapCharacters: number };
}

export class IngestionError extends Error {
  constructor(
    readonly code: 'DOCUMENT_UNSUPPORTED' | 'INGESTION_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}

export function createIngestionJobProcessor(deps: IngestionJobDependencies) {
  async function processClaimedJob(job: IngestionJob): Promise<void> {
    if (job.status !== 'processing') throw new Error('Job must be claimed before processing');
    const context = { tenantId: job.tenantId };
    try {
      const document = await deps.documents.getById(context, job.documentId);
      if (!document) throw new Error(`Document ${job.documentId} was not found in tenant`);
      const extractor = deps.extractors.find((candidate) =>
        candidate.supportedMimeTypes.includes(document.contentType)
      );
      if (!extractor)
        throw new IngestionError(
          'DOCUMENT_UNSUPPORTED',
          `Unsupported MIME type: ${document.contentType}`
        );

      await deps.documents.updateStatus(context, document.id, 'processing');
      const input = await deps.objectStore.get(document.objectKey);
      const extracted = await extractor.extract(input);
      const chunks = chunkText(extracted.text, { documentId: document.id, ...deps.chunkOptions });
      const embeddings = await deps.embeddings.embed(chunks.map((chunk) => chunk.text));
      if (embeddings.length !== chunks.length)
        throw new Error('Embedding count does not match chunk count');
      await deps.vectorStore.upsertChunks(
        job.tenantId,
        document.knowledgeBaseId,
        chunks.map((chunk, index) => ({
          id: chunk.id,
          documentId: chunk.documentId,
          ordinal: chunk.ordinal,
          text: chunk.text,
          embedding: embeddings[index]!
        }))
      );
      await deps.documents.updateStatus(context, document.id, 'ready');
      await deps.jobs.markSucceeded(context, job.id);
    } catch (cause) {
      const error =
        cause instanceof IngestionError
          ? cause
          : new IngestionError(
              'INGESTION_FAILED',
              cause instanceof Error ? cause.message : String(cause)
            );
      await deps.documents.updateStatus(context, job.documentId, 'failed');
      await deps.jobs.markFailed(context, job.id, `${error.code}: ${error.message}`);
      throw error;
    }
  }

  async function processIngestionJob(jobId: string): Promise<void> {
    const job = await deps.jobs.claimPending(jobId);
    if (job) await processClaimedJob(job);
  }

  return { processIngestionJob, processClaimedJob };
}
