import type { FastifyInstance } from 'fastify';
import { agentRequestSchema, type AgentRequest, type AgentResponse } from '@agents-platform/contracts';

export type AgentRuntime = { answer(request: AgentRequest): Promise<AgentResponse> };

export async function registerAgentRoutes(app: FastifyInstance, runtime: AgentRuntime): Promise<void> {
  app.get('/health', async () => ({ ok: true }));
  app.post('/v1/answer', async (request, reply) => {
    const parsed = agentRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', issues: parsed.error.issues });
    try {
      return await runtime.answer(parsed.data);
    } catch {
      return reply.code(503).send({ code: 'AGENT_UNAVAILABLE' });
    }
  });
}
