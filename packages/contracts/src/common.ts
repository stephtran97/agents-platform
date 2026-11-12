import { z } from 'zod';

export const tenantIdSchema = z.string().trim().min(1);
export const traceIdSchema = z.string().trim().min(1);

export const uploadMetadataSchema = z.object({
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive()
});
export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;

export const usageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative()
});
export type Usage = z.infer<typeof usageSchema>;
