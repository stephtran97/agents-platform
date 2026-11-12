import { z } from 'zod';
import { tenantIdSchema, traceIdSchema, usageSchema } from './common.js';
import { citationSchema, messageSchema } from './conversations.js';

export const agentRequestSchema = z.object({
  tenantId: tenantIdSchema,
  knowledgeBaseIds: z.array(z.string().min(1)),
  conversationId: z.string().min(1),
  messages: z.array(messageSchema),
  question: z.string().trim().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
  traceId: traceIdSchema.optional()
});
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export const agentResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
  toolCalls: z.array(z.record(z.string(), z.unknown())).default([]),
  usage: usageSchema.optional(),
  traceId: traceIdSchema
});
export type AgentResponse = z.infer<typeof agentResponseSchema>;

export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({ type: z.literal('citation'), citation: citationSchema }),
  z.object({ type: z.literal('done'), traceId: traceIdSchema })
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
