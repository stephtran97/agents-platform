import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'TENANT_NOT_FOUND',
  'DOCUMENT_UNSUPPORTED',
  'INGESTION_FAILED',
  'MODEL_UNAVAILABLE',
  'RETRIEVAL_FAILED',
  'INTERNAL_ERROR'
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    traceId: z.string().min(1).optional()
  })
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
