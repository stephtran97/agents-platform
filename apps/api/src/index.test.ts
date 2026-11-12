import { describe, expect, it } from 'vitest';
import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
import { defaultKnowledgeBaseId, toTenantUuid } from '@agents-platform/domain';
import { createApp } from './index.js';

const answer: AgentResponse = {
  answer: 'Grounded answer',
  citations: [],
  toolCalls: [],
  traceId: 'trace-1'
};
const fakeAgent = {
  answer: async (request: AgentRequest) => ({
    ...answer,
    traceId: request.traceId ?? answer.traceId
  })
};
describe('public API', () => {
  it('uses request tenant context instead of body tenantId', async () => {
    const app = createApp(fakeAgent);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${created.json().id}/messages`,
      headers: { 'x-tenant-id': 'tenant-a' },
      payload: { tenantId: 'tenant-b', message: 'Question', knowledgeBaseIds: [] }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().answer).toBe('Grounded answer');
  });
  it('does not expose a conversation to another tenant', async () => {
    const app = createApp(fakeAgent);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: { 'x-tenant-id': 'tenant-a' }
    });
    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${created.json().id}/messages`,
      headers: { 'x-tenant-id': 'tenant-b' },
      payload: { message: 'Question', knowledgeBaseIds: [] }
    });
    expect(response.statusCode).toBe(404);
  });
  it('maps non-UUID tenant keys to stable tenant UUIDs and keeps tenants isolated', async () => {
    const app = createApp(fakeAgent);
    const headers = { 'x-tenant-id': 'local' };
    const created = await app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers,
      payload: { filename: 'a.txt' }
    });
    expect(created.json().tenantId).toMatch(/^[0-9a-f-]{36}$/);
    const own = await app.inject({ method: 'GET', url: '/v1/documents', headers });
    const other = await app.inject({
      method: 'GET',
      url: '/v1/documents',
      headers: { 'x-tenant-id': 'other' }
    });
    expect(own.json()).toHaveLength(1);
    expect(other.json()).toHaveLength(0);
  });
  it('searches the tenant default knowledge base when none is requested', async () => {
    const seen: string[][] = [];
    const app = createApp({
      answer: async (request: AgentRequest) => {
        seen.push(request.knowledgeBaseIds);
        return answer;
      }
    });
    const headers = { 'x-tenant-id': 'local' };
    const created = await app.inject({ method: 'POST', url: '/v1/conversations', headers });
    await app.inject({
      method: 'POST',
      url: `/v1/conversations/${created.json().id}/messages`,
      headers,
      payload: { message: 'Question' }
    });
    expect(seen).toEqual([[defaultKnowledgeBaseId(toTenantUuid('local'))]]);
  });
});
