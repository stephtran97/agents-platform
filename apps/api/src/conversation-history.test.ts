import { describe, expect, it } from 'vitest';
import type { AgentRequest, AgentResponse } from '@agents-platform/contracts';
import { defaultKnowledgeBaseId, toTenantUuid } from '@agents-platform/domain';
import { createApp } from './index.js';
import { createMemoryStore } from './store.js';

const reply = (text: string): AgentResponse => ({
  answer: text,
  citations: [{ documentId: 'd1', chunkId: 'c1', filename: 'f.txt', text: 'x', score: 1 }],
  toolCalls: [],
  traceId: 'trace-1'
});

async function newConversation(app: ReturnType<typeof createApp>, tenant: string) {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/conversations',
    headers: { 'x-tenant-id': tenant },
    payload: {}
  });
  return created.json().id as string;
}

describe('conversation history', () => {
  it('persists the user and assistant messages and sends prior turns to the agent', async () => {
    const store = createMemoryStore();
    const seen: AgentRequest['messages'][] = [];
    const app = createApp(
      {
        answer: async (request) => {
          seen.push(request.messages);
          return reply(`answer to ${request.question}`);
        }
      },
      store
    );
    const id = await newConversation(app, 'tenant-a');
    const headers = { 'x-tenant-id': 'tenant-a' };

    await app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      headers,
      payload: { message: 'first?' }
    });
    await app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      headers,
      payload: { message: 'second?' }
    });

    expect(seen[0]).toEqual([]);
    expect(seen[1]).toEqual([
      { role: 'user', content: 'first?' },
      { role: 'assistant', content: 'answer to first?' }
    ]);
    expect(await store.listMessages(toTenantUuid('tenant-a'), id)).toHaveLength(4);
  });

  it('keeps the user message and returns a stable error when the agent fails', async () => {
    const store = createMemoryStore();
    const app = createApp(
      {
        answer: async () => {
          throw new Error('down');
        }
      },
      store
    );
    const id = await newConversation(app, 'tenant-a');
    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      headers: { 'x-tenant-id': 'tenant-a' },
      payload: { message: 'hello' }
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      code: 'AGENT_UNAVAILABLE',
      stack: expect.stringContaining('Error: down')
    });
    expect(await store.listMessages(toTenantUuid('tenant-a'), id)).toEqual([
      { role: 'user', content: 'hello' }
    ]);
  });
});

describe('knowledge base selection', () => {
  it('maps the literal "default" knowledge base to the tenant default UUID', async () => {
    const seen: string[][] = [];
    const app = createApp({
      answer: async (request) => {
        seen.push(request.knowledgeBaseIds);
        return reply('ok');
      }
    });
    const id = await newConversation(app, 'tenant-a');
    await app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      headers: { 'x-tenant-id': 'tenant-a' },
      payload: { message: 'hi', knowledgeBaseIds: ['default'] }
    });
    expect(seen[0]).toEqual([defaultKnowledgeBaseId(toTenantUuid('tenant-a'))]);
  });
});

describe('tenant spoofing', () => {
  it('ignores tenant ids supplied in the body or query string', async () => {
    const tenants: string[] = [];
    const app = createApp({
      answer: async (request) => {
        tenants.push(request.tenantId);
        return reply('ok');
      }
    });
    const id = await newConversation(app, 'tenant-a');
    await app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages?tenantId=tenant-b`,
      headers: { 'x-tenant-id': 'tenant-a' },
      payload: { message: 'hi', tenantId: 'tenant-b' }
    });
    expect(tenants).toEqual([toTenantUuid('tenant-a')]);
  });

  it('does not let another tenant read a document or list it', async () => {
    const app = createApp({ answer: async () => reply('ok') });
    const created = await app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: { 'x-tenant-id': 'tenant-a' },
      payload: { filename: 'a.txt' }
    });
    const docId = created.json().id as string;
    const read = await app.inject({
      method: 'GET',
      url: `/v1/documents/${docId}?tenantId=tenant-a`,
      headers: { 'x-tenant-id': 'tenant-b' }
    });
    expect(read.statusCode).toBe(404);
    const list = await app.inject({
      method: 'GET',
      url: '/v1/documents',
      headers: { 'x-tenant-id': 'tenant-b' }
    });
    expect(list.json()).toEqual([]);
  });
});
