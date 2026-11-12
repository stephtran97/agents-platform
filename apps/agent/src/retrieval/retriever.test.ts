import { describe, expect, it, vi } from 'vitest';
import { VectorRetriever } from './vector-retriever.js';

const result = (id: string, score: number, filename?: string) => ({
  id,
  documentId: `doc-${id}`,
  knowledgeBaseId: 'kb',
  ordinal: 0,
  text: `text ${id}`,
  score,
  filename
});

describe('VectorRetriever', () => {
  it('forwards tenant and knowledge-base scope and embeds the query', async () => {
    const search = vi.fn(async () => [result('a', 0.9)]);
    const embed = vi.fn(async () => ({
      model: 'm',
      embeddings: [[0.1, 0.2]],
      usage: { promptTokens: 1 }
    }));
    await new VectorRetriever({ search } as never, { embed } as never).search({
      tenantId: 't1',
      knowledgeBaseIds: ['kb1', 'kb2'],
      query: 'hello',
      limit: 3
    });
    expect(embed).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: 'hello' });
    expect(search).toHaveBeenCalledWith('t1', ['kb1', 'kb2'], [0.1, 0.2], 3);
  });

  it('keeps the store ordering and uses the filename when known', async () => {
    const search = vi.fn(async () => [result('a', 0.9, 'handbook.txt'), result('b', 0.5)]);
    const embed = async () => ({ model: 'm', embeddings: [[1]], usage: { promptTokens: 1 } });
    const chunks = await new VectorRetriever({ search } as never, { embed } as never).search({
      tenantId: 't',
      knowledgeBaseIds: ['kb'],
      query: 'q',
      limit: 2
    });
    expect(chunks.map((chunk) => chunk.chunkId)).toEqual(['a', 'b']);
    expect(chunks[0]).toMatchObject({
      filename: 'handbook.txt',
      content: 'text a',
      documentId: 'doc-a'
    });
    expect(chunks[1]!.filename).toBe('doc-b');
  });
});
