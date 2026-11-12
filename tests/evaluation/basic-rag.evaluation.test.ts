import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chunkText } from '../../apps/worker/src/chunking/chunker.js';
import { MockProvider } from '../../apps/llm/src/providers/mock-provider.js';
import { BasicRagRuntime, type RetrievedChunk } from '../../apps/agent/src/runtimes/basic-rag-runtime.js';

// Provider-independent evaluation: the handbook fixture is chunked, retrieved with a deterministic
// lexical scorer, and answered by `basic-rag` over the mock LLM provider. No network or database.
const handbook = readFileSync(`${process.cwd()}/tests/evaluation/fixtures/handbook.txt`, 'utf8');
const documentId = 'handbook';
const chunks = chunkText(handbook, { documentId, maxCharacters: 160, overlapCharacters: 20 });
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);

function createRuntime() {
  const llm = new MockProvider();
  return new BasicRagRuntime({
    vectorStore: {
      async search({ query, limit }) {
        const queryWords = words(query);
        return chunks
          .map((chunk): RetrievedChunk => ({
            chunkId: chunk.id, documentId, filename: 'handbook.txt', content: chunk.text,
            score: [...words(chunk.text)].filter((word) => queryWords.has(word)).length,
          }))
          .filter((chunk) => chunk.score > 1)
          .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
          .slice(0, Math.min(limit, 1));
      },
    },
    llm: { complete: (input) => llm.complete({ ...input, tenantId: 't' } as never) as never },
  });
}

describe('basic-rag evaluation (handbook fixture, mock provider)', () => {
  const request = { tenantId: 'tenant-a', knowledgeBaseIds: ['kb'], conversationId: 'c1', messages: [] };

  it('cites the chunk that contains the vacation fact, not the distractor', async () => {
    const response = await createRuntime().answer({ ...request, question: 'How many vacation days do full-time employees accrue per year?' });
    const expected = chunks.find((chunk) => chunk.text.includes('25 days'))!;
    expect(response.citations.map((citation) => citation.chunkId)).toEqual([expected.id]);
    expect(response.citations[0]!.text).toContain('25 days of paid vacation');
    expect(response.answer).toContain('25 days');
    expect(response.answer).not.toContain('200 dollars');
    expect(response.traceId).toBeTruthy();
  });

  it('returns a grounded no-answer with no citations when nothing relevant exists', async () => {
    const response = await createRuntime().answer({ ...request, question: 'zzz qqq xyzzy' });
    expect(response.citations).toEqual([]);
    expect(response.answer).toMatch(/could not find relevant information/i);
  });
});
