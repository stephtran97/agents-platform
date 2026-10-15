import { describe, expect, it } from 'vitest';
import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
import { createApp } from './index.js';

const answer: AgentResponse = { answer: 'Grounded answer', citations: [], toolCalls: [], traceId: 'trace-1' };
const fakeAgent = { answer: async (request: AgentRequest) => ({ ...answer, traceId: request.traceId ?? answer.traceId }) };
describe('public API', () => {
  it('uses request tenant context instead of body tenantId', async () => { const app = createApp(fakeAgent); const created = await app.inject({ method: 'POST', url: '/v1/conversations', headers: { 'x-tenant-id': 'tenant-a' } }); const response = await app.inject({ method: 'POST', url: `/v1/conversations/${created.json().id}/messages`, headers: { 'x-tenant-id': 'tenant-a' }, payload: { tenantId: 'tenant-b', message: 'Question', knowledgeBaseIds: [] } }); expect(response.statusCode).toBe(200); expect(response.json().answer).toBe('Grounded answer'); });
  it('does not expose a conversation to another tenant', async () => { const app = createApp(fakeAgent); const created = await app.inject({ method: 'POST', url: '/v1/conversations', headers: { 'x-tenant-id': 'tenant-a' } }); const response = await app.inject({ method: 'POST', url: `/v1/conversations/${created.json().id}/messages`, headers: { 'x-tenant-id': 'tenant-b' }, payload: { message: 'Question', knowledgeBaseIds: [] } }); expect(response.statusCode).toBe(404); });
});
