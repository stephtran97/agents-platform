import { LlmClient } from '@agents-platform/clients';
import { MinioObjectStore, PgVectorStore, PostgresDocumentRepository, PostgresJobRepository, migrate } from '@agents-platform/domain';
import { Pool } from 'pg';
import { chunkText } from './chunking/chunker.js';
import { LlmEmbeddingClient } from './embedding/embedding-client.js';
import { DocxExtractor } from './extractors/docx-extractor.js';
import { PdfExtractor } from './extractors/pdf-extractor.js';
import { PlainTextExtractor } from './extractors/plain-text-extractor.js';
import { createIngestionJobProcessor } from './jobs/process-ingestion-job.js';
import { createPollingWorker } from './worker.js';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://agents:agents@localhost:5432/agents' });
  await migrate(pool);
  const documents = new PostgresDocumentRepository(pool);
  const jobs = new PostgresJobRepository(pool);
  const vectorStore = new PgVectorStore(pool);
  const objectStore = new MinioObjectStore({ endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000', bucket: process.env.S3_BUCKET ?? 'agents-documents', accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin', secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin' });
  const processor = createIngestionJobProcessor({ jobs, documents, objectStore, vectorStore, embeddings: new LlmEmbeddingClient(new LlmClient(process.env.LLM_URL ?? 'http://localhost:4102')), extractors: [new PlainTextExtractor(), new PdfExtractor(), new DocxExtractor()], chunkOptions: { maxCharacters: 1200, overlapCharacters: 120 } });
  const controller = new AbortController();
  process.once('SIGTERM', () => controller.abort()); process.once('SIGINT', () => controller.abort());
  await createPollingWorker({ jobs, processor }).run({ signal: controller.signal });
  await pool.end();
}

void main();
