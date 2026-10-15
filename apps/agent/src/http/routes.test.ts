import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { AgentResponse } from '@agents-platform/contracts';
import { registerAgentRoutes } from './routes.js';

describe('agent HTTP routes', () => {
  it('validates a request and returns the runtime response', async () => {
    const app = Fastify();
    const response: AgentResponse = {
      answer: 'The answer',
      citations: [],
      toolCalls: [],
      traceId: 'trace-123',
    };
    await registerAgentRoutes(app, { answer: async () => response });

    const result = await app.inject({
      method: 'POST',
      url: '/v1/answer',
      payload: {
        tenantId: 'tenant-1',
        knowledgeBaseIds: ['kb-1'],
        conversationId: 'conversation-1',
        messages: [{ role: 'user', content: 'Hello' }],
        question: 'What is this?',
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual(response);
  });

  it('rejects malformed requests', async () => {
    const app = Fastify();
    await registerAgentRoutes(app, { answer: async () => ({ answer: '', citations: [], toolCalls: [], traceId: 'trace-123' }) });
    const result = await app.inject({ method: 'POST', url: '/v1/answer', payload: {} });
    expect(result.statusCode).toBe(400);
  });
});
