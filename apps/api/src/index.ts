import Fastify, { type FastifyInstance } from 'fastify';
import { conversationRequestSchema, type AgentRequest, type AgentResponse } from '@agents-platform/contracts';
import { AgentClient } from '@agents-platform/clients';
import { defaultKnowledgeBaseId, toTenantUuid } from '@agents-platform/domain';
import { createMemoryStore, type ApiStore } from './store.js';
import { createPersistentApp } from './persistent.js';

export type AgentService = { answer(request: AgentRequest): Promise<AgentResponse> };
export function createApp(agent: AgentService = new AgentClient(process.env.AGENT_URL ?? 'http://localhost:4101'), store: ApiStore = createMemoryStore()): FastifyInstance {
  const app = Fastify({ logger: true });
  function tenantId(request: { headers: Record<string, string | string[] | undefined> }): string { const value = request.headers['x-tenant-id']; return toTenantUuid(((Array.isArray(value) ? value[0] : value) ?? process.env.TENANT_ID ?? 'local').trim()); }
  app.get('/health', async () => ({ ok: true }));
  app.get('/v1/documents', async (request) => store.listDocuments(tenantId(request)));
  app.get('/v1/documents/:id', async (request, reply) => { const document = await store.getDocument(tenantId(request), (request.params as { id: string }).id); return document ? document : reply.code(404).send({ code: 'DOCUMENT_NOT_FOUND' }); });
  app.post('/v1/documents', async (request, reply) => { const body = (request.body ?? {}) as { filename?: string; contentType?: string; sizeBytes?: number; contentBase64?: string }; if (!body.filename) return reply.code(400).send({ code: 'INVALID_REQUEST' }); const content = body.contentBase64 ? Buffer.from(body.contentBase64, 'base64') : undefined; const document = await store.createDocument({ tenantId: tenantId(request), filename: body.filename, contentType: body.contentType ?? 'text/plain', sizeBytes: body.sizeBytes ?? content?.length ?? 0, content }); return reply.code(201).send(document); });
  app.post('/v1/conversations', async (request, reply) => reply.code(201).send(await store.createConversation(tenantId(request))));
  app.post('/v1/conversations/:id/messages', async (request, reply) => { const tenant = tenantId(request); const id = (request.params as { id: string }).id; const conversation = await store.getConversation(tenant, id); if (!conversation) return reply.code(404).send({ code: 'CONVERSATION_NOT_FOUND' }); const parsed = conversationRequestSchema.safeParse({ ...(request.body as object), tenantId: tenant, conversationId: id }); if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', issues: parsed.error.issues }); const history = (await store.listMessages(tenant, id)).slice(-20); await store.addMessage(tenant, id, { role: 'user', content: parsed.data.message }); try { const answer = await agent.answer({ tenantId: tenant, knowledgeBaseIds: parsed.data.knowledgeBaseIds.length > 0 ? parsed.data.knowledgeBaseIds.map((kb) => (kb === 'default' ? defaultKnowledgeBaseId(tenant) : kb)) : [defaultKnowledgeBaseId(tenant)], conversationId: id, messages: history, question: parsed.data.message, traceId: parsed.data.traceId }); await store.addMessage(tenant, id, { role: 'assistant', content: answer.answer }, answer.citations.map((c) => ({ documentId: c.documentId, chunkId: c.chunkId }))); return reply.send({ conversationId: id, ...answer }); } catch { return reply.code(503).send({ code: 'AGENT_UNAVAILABLE' }); } });
  return app;
}

async function main(): Promise<void> { const app = process.env.DATABASE_URL ? await createPersistentApp() : createApp(); await app.listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' }); }
if (process.env.NODE_ENV !== 'test') void main();
