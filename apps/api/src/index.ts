import Fastify, { type FastifyInstance } from 'fastify';
import { conversationRequestSchema, type AgentRequest, type AgentResponse } from '@agents-platform/contracts';
import { AgentClient } from '@agents-platform/clients';

export type DocumentRecord = { id: string; tenantId: string; knowledgeBaseId: string; filename: string; contentType: string; sizeBytes: number; status: string; createdAt: string };
export type ConversationRecord = { id: string; tenantId: string; createdAt: string };
export type AgentService = { answer(request: AgentRequest): Promise<AgentResponse> };

export function createApp(agent: AgentService = new AgentClient(process.env.AGENT_URL ?? 'http://localhost:4101')): FastifyInstance {
  const app = Fastify({ logger: true });
  const documents: DocumentRecord[] = [];
  const conversations: ConversationRecord[] = [];
  function tenantId(request: { headers: Record<string, string | string[] | undefined> }): string { const value = request.headers['x-tenant-id']; return (Array.isArray(value) ? value[0] : value) ?? process.env.TENANT_ID ?? 'local'; }
  app.get('/health', async () => ({ ok: true }));
  app.get('/v1/documents', async (request) => documents.filter((document) => document.tenantId === tenantId(request)));
  app.get('/v1/documents/:id', async (request, reply) => { const document = documents.find((candidate) => candidate.id === (request.params as { id: string }).id && candidate.tenantId === tenantId(request)); return document ? document : reply.code(404).send({ code: 'DOCUMENT_NOT_FOUND' }); });
  app.post('/v1/documents', async (request, reply) => { const body = (request.body ?? {}) as { filename?: string; contentType?: string; sizeBytes?: number }; if (!body.filename) return reply.code(400).send({ code: 'INVALID_REQUEST' }); const document: DocumentRecord = { id: crypto.randomUUID(), tenantId: tenantId(request), knowledgeBaseId: 'default', filename: body.filename, contentType: body.contentType ?? 'text/plain', sizeBytes: body.sizeBytes ?? 0, status: 'pending', createdAt: new Date().toISOString() }; documents.push(document); return reply.code(201).send(document); });
  app.post('/v1/conversations', async (request, reply) => { const conversation: ConversationRecord = { id: crypto.randomUUID(), tenantId: tenantId(request), createdAt: new Date().toISOString() }; conversations.push(conversation); return reply.code(201).send(conversation); });
  app.post('/v1/conversations/:id/messages', async (request, reply) => { const id = (request.params as { id: string }).id; const conversation = conversations.find((candidate) => candidate.id === id && candidate.tenantId === tenantId(request)); if (!conversation) return reply.code(404).send({ code: 'CONVERSATION_NOT_FOUND' }); const parsed = conversationRequestSchema.safeParse({ ...(request.body as object), tenantId: conversation.tenantId, conversationId: conversation.id }); if (!parsed.success) return reply.code(400).send({ code: 'INVALID_REQUEST', issues: parsed.error.issues }); try { const answer = await agent.answer({ tenantId: conversation.tenantId, knowledgeBaseIds: parsed.data.knowledgeBaseIds, conversationId: conversation.id, messages: [], question: parsed.data.message, traceId: parsed.data.traceId }); return reply.send({ conversationId: conversation.id, ...answer }); } catch { return reply.code(503).send({ code: 'AGENT_UNAVAILABLE' }); } });
  return app;
}

async function main(): Promise<void> { await createApp().listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' }); }
if (process.env.NODE_ENV !== 'test') void main();
