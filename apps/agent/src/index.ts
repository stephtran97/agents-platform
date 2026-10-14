import Fastify from 'fastify';
import { LlmClient } from '@agents-platform/clients';
import { registerAgentRoutes } from './http/routes.js';
import { createAgentRuntime } from './runtime-registry.js';

const llm = new LlmClient(process.env.LLM_URL ?? 'http://localhost:4102');
const runtime = createAgentRuntime(process.env.AGENT_RUNTIME ?? 'basic-rag', {
  vectorStore: { search: async () => [] },
  llm: {
    complete: async (input) => {
      const result = await llm.complete(input);
      return { ...result, finishReason: 'stop' as const, message: { content: result.message.content } };
    },
  },
});
const app = Fastify({ logger: true });

async function main(): Promise<void> {
  await registerAgentRoutes(app, runtime);
  await app.listen({ port: Number(process.env.PORT ?? 4101), host: '0.0.0.0' });
}

void main();
