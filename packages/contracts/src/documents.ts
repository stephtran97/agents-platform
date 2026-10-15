import { z } from 'zod';
import { tenantIdSchema, traceIdSchema, uploadMetadataSchema } from './common.js';

export const documentStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const ingestionJobStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed']);
export type IngestionJobStatus = z.infer<typeof ingestionJobStatusSchema>;

export const uploadDocumentRequestSchema = z.object({
  tenantId: tenantIdSchema,
  knowledgeBaseId: z.string().trim().min(1),
  metadata: uploadMetadataSchema,
  traceId: traceIdSchema.optional(),
});
export type UploadDocumentRequest = z.infer<typeof uploadDocumentRequestSchema>;

export const documentSchema = z.object({
  id: z.string().min(1),
  tenantId: tenantIdSchema,
  knowledgeBaseId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  status: documentStatusSchema,
  createdAt: z.string().datetime(),
});
export type DocumentDto = z.infer<typeof documentSchema>;

export const ingestionJobSchema = z.object({
  id: z.string().min(1),
  tenantId: tenantIdSchema,
  documentId: z.string().min(1),
  status: ingestionJobStatusSchema,
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type IngestionJobDto = z.infer<typeof ingestionJobSchema>;
