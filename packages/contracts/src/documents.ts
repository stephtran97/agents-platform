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
  traceId: traceIdSchema.optional()
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
  createdAt: z.string().datetime()
});
export type DocumentDto = z.infer<typeof documentSchema>;

export const ingestionJobSchema = z.object({
  id: z.string().min(1),
  tenantId: tenantIdSchema,
  documentId: z.string().min(1),
  status: ingestionJobStatusSchema,
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime()
});
export type IngestionJobDto = z.infer<typeof ingestionJobSchema>;

export const documentInspectionChunkSchema = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  text: z.string(),
  /** Source offsets in `extractedText`; null when the stored chunk no longer matches a re-chunk. */
  startOffset: z.number().int().nonnegative().nullable(),
  endOffset: z.number().int().nonnegative().nullable()
});
export type DocumentInspectionChunkDto = z.infer<typeof documentInspectionChunkSchema>;

export const documentInspectionSchema = z.object({
  document: documentSchema,
  /** Text re-extracted from the stored file; null when extraction failed. */
  extractedText: z.string().nullable(),
  extractionError: z.string().optional(),
  chunkOptions: z.object({
    maxCharacters: z.number().int().positive(),
    overlapCharacters: z.number().int().nonnegative()
  }),
  /** The chunks stored for retrieval, i.e. what the agent actually searches. */
  chunks: z.array(documentInspectionChunkSchema)
});
export type DocumentInspectionDto = z.infer<typeof documentInspectionSchema>;
