import { describe, expect, it } from 'vitest';
import { BasicRagRuntime } from './basic-rag-runtime.js';
describe('BasicRagRuntime', () => {
  it('returns citations from retrieved chunks', async () => {
    const runtime = new BasicRagRuntime({
      vectorStore: { search: async () => [{ chunkId: 'c1', documentId: 'd1', content: 'Paris is the capital of France', filename: 'facts.txt', score: 0.9 }] },
      llm: { complete: async () => ({ model: 'mock-chat', message: { role: 'assistant', content: 'Paris' }, finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }) },
    } as never);
    const result = await runtime.answer({ tenantId: 't1', knowledgeBaseIds: ['kb1'], conversationId: 'c', messages: [], question: 'Capital?' });
    expect(result.answer).toBe('Paris');
    expect(result.citations[0].chunkId).toBe('c1');
  });
});
