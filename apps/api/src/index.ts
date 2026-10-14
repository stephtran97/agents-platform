import Fastify from 'fastify';
import { conversationRequestSchema } from '@agents-platform/contracts';
import { AgentClient } from '@agents-platform/clients';
const app = Fastify({ logger: true });
const agent = new AgentClient(process.env.AGENT_URL ?? 'http://agent:4101');
const documents: unknown[] = [];
app.get('/health', async () => ({ ok: true }));
app.get('/v1/documents', async () => documents);
app.post('/v1/documents', async (request, reply) => { const body = request.body as { filename?: string; contentType?: string; sizeBytes?: number }; const doc = { id: crypto.randomUUID(), tenantId: process.env.TENANT_ID ?? 'local', knowledgeBaseId: 'default', filename: body.filename ?? 'upload', contentType: body.contentType ?? 'text/plain', sizeBytes: body.sizeBytes ?? 0, status: 'pending', createdAt: new Date().toISOString() }; documents.push(doc); return reply.code(201).send(doc); });
app.post('/v1/conversations/:id/messages', async (request, reply) => { const body = conversationRequestSchema.parse({ ...(request.body as object), tenantId: process.env.TENANT_ID ?? 'local', conversationId: (request.params as { id: string }).id }); const answer = await agent.answer({ tenantId: body.tenantId, knowledgeBaseIds: body.knowledgeBaseIds, conversationId: body.conversationId!, messages: [], question: body.message }); return reply.send({ conversationId: body.conversationId, ...answer }); });
async function main() { await app.listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' }); }
void main();
