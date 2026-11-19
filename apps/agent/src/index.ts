import { LlmClient } from '@agents-platform/clients';
import { PgVectorStore } from '@agents-platform/domain';
import { Pool } from 'pg';
import { VectorRetriever } from './retrieval/vector-retriever.js';
import { buildAgentServer } from './http/server.js';
import { createAgentRuntime } from './runtime-registry.js';

const llm = new LlmClient(process.env.LLM_URL ?? 'http://localhost:4102');
// Without a database the agent has nothing to retrieve from, so it falls back to an empty store.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : undefined;
const retriever = pool ? new VectorRetriever(new PgVectorStore(pool), llm) : undefined;
const minScore = Number(process.env.RETRIEVAL_MIN_SCORE ?? 0);
const scoreMargin = Number(process.env.RETRIEVAL_SCORE_MARGIN ?? 0);
const runtime = createAgentRuntime(process.env.AGENT_RUNTIME ?? 'basic-rag', {
  minScore: Number.isFinite(minScore) ? minScore : 0,
  scoreMargin: Number.isFinite(scoreMargin) ? scoreMargin : 0,
  vectorStore: retriever ?? { search: async () => [] },
  llm: {
    complete: async (input) => {
      const result = await llm.complete(input);
      return {
        ...result,
        finishReason: 'stop' as const,
        message: { content: result.message.content }
      };
    }
  }
});

async function main(): Promise<void> {
  const app = await buildAgentServer(runtime);
  app.addHook('onClose', async () => {
    await pool?.end();
  });
  await app.listen({ port: Number(process.env.PORT ?? 4101), host: '0.0.0.0' });
}

void main();
