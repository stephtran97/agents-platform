import type { FastifyInstance } from 'fastify';
import { completionRequestSchema, embeddingRequestSchema } from '@agents-platform/contracts';
import { createLlmProvider } from '../provider-registry.js';
export async function registerRoutes(app: FastifyInstance, provider = createLlmProvider({ provider: process.env.LLM_PROVIDER ?? 'mock' })) {
  app.get('/health', async () => ({ ok: true }));
  app.post('/v1/completions', async (request, reply) => { try { return await provider.complete(completionRequestSchema.parse(request.body)); } catch { return reply.code(503).send({ code: 'MODEL_UNAVAILABLE' }); } });
  app.post('/v1/embeddings', async (request, reply) => { try { return await provider.embed(embeddingRequestSchema.parse(request.body)); } catch { return reply.code(503).send({ code: 'MODEL_UNAVAILABLE' }); } });
  app.get('/v1/models', async () => provider.listModels());
}
