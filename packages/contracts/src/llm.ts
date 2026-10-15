import { z } from 'zod';
import { messageSchema } from './conversations.js';
import { usageSchema } from './common.js';

export const completionRequestSchema = z.object({
  model: z.string().trim().min(1),
  messages: z.array(messageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  responseFormat: z.enum(['text', 'json']).optional(),
});
export type CompletionRequest = z.infer<typeof completionRequestSchema>;

export const completionResponseSchema = z.object({
  model: z.string().min(1),
  message: messageSchema,
  finishReason: z.enum(['stop', 'length', 'tool_calls', 'other']),
  usage: usageSchema,
});
export type CompletionResponse = z.infer<typeof completionResponseSchema>;

export const embeddingRequestSchema = z.object({
  model: z.string().trim().min(1),
  input: z.union([z.string(), z.array(z.string()).min(1)]),
});
export type EmbeddingRequest = z.infer<typeof embeddingRequestSchema>;

export const embeddingResponseSchema = z.object({
  model: z.string().min(1),
  embeddings: z.array(z.array(z.number())),
  usage: z.object({ promptTokens: z.number().int().nonnegative() }).optional(),
});
export type EmbeddingResponse = z.infer<typeof embeddingResponseSchema>;

export const modelDescriptorSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  capabilities: z.array(z.enum(['completion', 'streaming', 'embedding', 'tools'])),
  contextWindow: z.number().int().positive().optional(),
});
export type ModelDescriptor = z.infer<typeof modelDescriptorSchema>;

export const completionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({ type: z.literal('done'), usage: usageSchema.optional() }),
]);
export type CompletionEvent = z.infer<typeof completionEventSchema>;
