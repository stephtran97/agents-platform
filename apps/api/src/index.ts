import Fastify from 'fastify';
import { conversationRequestSchema } from '@agents-platform/contracts';
import { AgentClient } from '@agents-platform/clients';
const app = Fastify({ logger: true });
const agent = new AgentClient(process.env.AGENT_URL ?? 'http://agent:4101');
type DocumentRecord = { id: string; tenantId: string; knowledgeBaseId: string; filename: string; contentType: string; sizeBytes: number; status: string; createdAt: string };
const documents: DocumentRecord[] = [];
function tenantId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const value = request.headers['x-tenant-id'];
  return (Array.isArray(value) ? value[0] : value) ?? process.env.TENANT_ID ?? 'local';
}
app.get('/health', async () => ({ ok: true }));
app.get('/v1/documents', async (request) => documents.filter((document) => document.tenantId === tenantId(request)));
app.post('/v1/documents', async (request, reply) => { const body = request.body as { filename?: string; contentType?: string; sizeBytes?: number }; const doc = { id: crypto.randomUUID(), tenantId: tenantId(request), knowledgeBaseId: 'default', filename: body.filename ?? 'upload', contentType: body.contentType ?? 'text/plain', sizeBytes: body.sizeBytes ?? 0, status: 'pending', createdAt: new Date().toISOString() }; documents.push(doc); return reply.code(201).send(doc); });
app.post('/v1/conversations/:id/messages', async (request, reply) => { const body = conversationRequestSchema.parse({ ...(request.body as object), tenantId: tenantId(request), conversationId: (request.params as { id: string }).id }); const answer = await agent.answer({ tenantId: body.tenantId, knowledgeBaseIds: body.knowledgeBaseIds, conversationId: body.conversationId!, messages: [], question: body.message }); return reply.send({ conversationId: body.conversationId, ...answer }); });
async function main() { await app.listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' }); }
void main();
