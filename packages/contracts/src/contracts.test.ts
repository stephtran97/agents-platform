import { describe, expect, it } from 'vitest';
import {
  agentRequestSchema,
  agentResponseSchema,
  citationSchema,
  completionRequestSchema,
  embeddingRequestSchema,
  errorCodeSchema,
  uploadMetadataSchema
} from './index.js';

describe('transport contracts', () => {
  it('accepts valid upload metadata', () => {
    expect(
      uploadMetadataSchema.parse({
        filename: 'guide.pdf',
        contentType: 'application/pdf',
        sizeBytes: 128
      })
    ).toEqual({ filename: 'guide.pdf', contentType: 'application/pdf', sizeBytes: 128 });
  });

  it('accepts agent requests and responses', () => {
    expect(
      agentRequestSchema.parse({
        tenantId: 'tenant-a',
        knowledgeBaseIds: [],
        conversationId: 'conversation-a',
        messages: [{ role: 'user', content: 'How?' }],
        question: 'How?'
      }).tenantId
    ).toBe('tenant-a');
    expect(
      agentResponseSchema.parse({ answer: 'Because.', citations: [], traceId: 'trace-1' }).answer
    ).toBe('Because.');
  });

  it('accepts completion and embedding requests', () => {
    expect(
      completionRequestSchema.parse({ model: 'mock', messages: [{ role: 'user', content: 'Hi' }] })
        .messages
    ).toHaveLength(1);
    expect(embeddingRequestSchema.parse({ model: 'mock', input: ['text'] }).input).toEqual([
      'text'
    ]);
  });

  it('accepts a valid citation', () => {
    expect(
      citationSchema.parse({
        documentId: 'doc-1',
        filename: 'guide.pdf',
        chunkId: 'chunk-1',
        text: 'Answer',
        page: 1
      }).page
    ).toBe(1);
  });

  it('keeps error codes stable and rejects unknown values', () => {
    expect(errorCodeSchema.parse('TENANT_NOT_FOUND')).toBe('TENANT_NOT_FOUND');
    expect(errorCodeSchema.safeParse('SOMETHING_ELSE').success).toBe(false);
  });

  it('rejects agent requests without tenantId', () => {
    expect(agentRequestSchema.safeParse({ question: 'How?' }).success).toBe(false);
  });
});
