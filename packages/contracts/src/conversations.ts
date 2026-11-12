import { z } from 'zod';
import { tenantIdSchema, traceIdSchema, usageSchema } from './common.js';

export const messageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export const messageSchema = z.object({
  role: messageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional()
});
export type Message = z.infer<typeof messageSchema>;

export const citationSchema = z.object({
  documentId: z.string().min(1),
  filename: z.string().min(1),
  chunkId: z.string().min(1),
  text: z.string(),
  page: z.number().int().positive().optional(),
  score: z.number().optional()
});
export type Citation = z.infer<typeof citationSchema>;

export const conversationRequestSchema = z.object({
  tenantId: tenantIdSchema,
  conversationId: z.string().min(1).optional(),
  message: z.string().trim().min(1),
  knowledgeBaseIds: z.array(z.string().min(1)).default([]),
  traceId: traceIdSchema.optional()
});
export type ConversationRequest = z.infer<typeof conversationRequestSchema>;

export const conversationResponseSchema = z.object({
  conversationId: z.string().min(1),
  answer: z.string(),
  citations: z.array(citationSchema),
  usage: usageSchema.optional(),
  traceId: traceIdSchema
});
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
