import { describe, expect, it } from 'vitest';
import { BasicRagRuntime } from './basic-rag-runtime.js';
describe('BasicRagRuntime', () => {
  it('returns a grounded no-answer when retrieval is empty', async () => {
    const runtime = new BasicRagRuntime({
      vectorStore: { search: async () => [] },
      llm: {
        complete: async () => {
          throw new Error('must not call llm');
        }
      }
    });
    const result = await runtime.answer({
      tenantId: 'tenant-1',
      knowledgeBaseIds: ['kb-1'],
      conversationId: 'conversation-1',
      messages: [],
      question: 'Unknown',
      traceId: 'trace-1'
    });
    expect(result.answer).toContain('could not find relevant information');
    expect(result.citations).toEqual([]);
    expect(result.traceId).toBe('trace-1');
  });
  it('returns citations from retrieved chunks', async () => {
    const runtime = new BasicRagRuntime({
      vectorStore: {
        search: async () => [
          {
            chunkId: 'c1',
            documentId: 'd1',
            content: 'Paris is the capital of France',
            filename: 'facts.txt',
            score: 0.9
          }
        ]
      },
      llm: {
        complete: async () => ({
          model: 'mock-chat',
          message: { role: 'assistant', content: 'Paris' },
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
        })
      }
    } as never);
    const result = await runtime.answer({
      tenantId: 't1',
      knowledgeBaseIds: ['kb1'],
      conversationId: 'c',
      messages: [],
      question: 'Capital?'
    });
    expect(result.answer).toBe('Paris');
    expect(result.citations[0].chunkId).toBe('c1');
  });
  it('drops chunks scoring below minScore before prompting and citing', async () => {
    const prompts: string[] = [];
    const runtime = new BasicRagRuntime({
      minScore: 0.6,
      vectorStore: {
        search: async () => [
          { chunkId: 'hi', documentId: 'd1', content: 'relevant', filename: 'a.txt', score: 0.77 },
          { chunkId: 'lo', documentId: 'd2', content: 'noise', filename: 'b.txt', score: 0.45 }
        ]
      },
      llm: {
        complete: async (input: { messages: { content: string }[] }) => {
          prompts.push(input.messages.at(-1)?.content ?? '');
          return {
            model: 'm',
            message: { role: 'assistant', content: 'ok' },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
          };
        }
      }
    } as never);
    const result = await runtime.answer({
      tenantId: 't1',
      knowledgeBaseIds: ['kb1'],
      conversationId: 'c',
      messages: [],
      question: 'Q?'
    });
    expect(result.citations.map((c) => c.chunkId)).toEqual(['hi']);
    expect(prompts[0]).not.toContain('noise');
  });
  it('answers that nothing was found when every chunk is below minScore', async () => {
    const runtime = new BasicRagRuntime({
      minScore: 0.9,
      vectorStore: {
        search: async () => [
          { chunkId: 'lo', documentId: 'd2', content: 'noise', filename: 'b.txt', score: 0.45 }
        ]
      },
      llm: {
        complete: async () => {
          throw new Error('must not call llm');
        }
      }
    } as never);
    const result = await runtime.answer({
      tenantId: 't1',
      knowledgeBaseIds: ['kb1'],
      conversationId: 'c',
      messages: [],
      question: 'Q?'
    });
    expect(result.answer).toContain('could not find relevant information');
    expect(result.citations).toEqual([]);
  });
  it('keeps only chunks within scoreMargin of the best hit, even when all scores are low', async () => {
    const prompts: string[] = [];
    const runtime = new BasicRagRuntime({
      minScore: 0.3,
      scoreMargin: 0.1,
      vectorStore: {
        search: async () => [
          { chunkId: 'best', documentId: 'd1', content: 'a', filename: 'a.txt', score: 0.5 },
          { chunkId: 'near', documentId: 'd2', content: 'b', filename: 'b.txt', score: 0.45 },
          { chunkId: 'far', documentId: 'd3', content: 'noise', filename: 'c.txt', score: 0.35 }
        ]
      },
      llm: {
        complete: async (input: { messages: { content: string }[] }) => {
          prompts.push(input.messages.at(-1)?.content ?? '');
          return {
            model: 'm',
            message: { role: 'assistant', content: 'ok' },
            finishReason: 'stop',
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
          };
        }
      }
    } as never);
    const result = await runtime.answer({
      tenantId: 't1',
      knowledgeBaseIds: ['kb1'],
      conversationId: 'c',
      messages: [],
      question: 'Q?'
    });
    expect(result.citations.map((c) => c.chunkId)).toEqual(['best', 'near']);
    expect(prompts[0]).not.toContain('noise');
  });
});
