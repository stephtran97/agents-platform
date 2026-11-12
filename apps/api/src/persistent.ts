import { LlmClient, AgentClient } from '@agents-platform/clients';
import { MinioObjectStore, PgVectorStore, PostgresConversationRepository, PostgresDocumentRepository, PostgresJobRepository, PostgresTenantScopeRepository, migrate } from '@agents-platform/domain';
import { Pool } from 'pg';
import { createApp } from './index.js';
import { createPersistentStore } from './store.js';

export async function createPersistentApp() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(pool);
  const store = createPersistentStore({
    documents: new PostgresDocumentRepository(pool),
    conversations: new PostgresConversationRepository(pool),
    jobs: new PostgresJobRepository(pool),
    tenantScopes: new PostgresTenantScopeRepository(pool),
    objectStore: new MinioObjectStore({ endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000', bucket: process.env.S3_BUCKET ?? 'agents-documents', accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin', secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin' }),
  });
  const app = createApp(new AgentClient(process.env.AGENT_URL ?? 'http://localhost:4101'), store);
  app.addHook('onClose', async () => { await pool.end(); });
  return app;
}
