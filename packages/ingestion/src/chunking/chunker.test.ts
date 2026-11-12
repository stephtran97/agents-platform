import { describe, expect, it } from 'vitest';
import { chunkText } from './chunker.js';

describe('chunkText', () => {
  const options = {
    documentId: '11111111-1111-4111-8111-111111111111',
    maxCharacters: 4,
    overlapCharacters: 1
  };

  it('creates stable ordered IDs, bounded chunks, overlap, and source offsets', () => {
    const first = chunkText('abcdefghij', options);
    expect(
      first.map(({ ordinal, text, startOffset, endOffset }) => ({
        ordinal,
        text,
        startOffset,
        endOffset
      }))
    ).toEqual([
      { ordinal: 0, text: 'abcd', startOffset: 0, endOffset: 4 },
      { ordinal: 1, text: 'defg', startOffset: 3, endOffset: 7 },
      { ordinal: 2, text: 'ghij', startOffset: 6, endOffset: 10 }
    ]);
    expect(first).toEqual(chunkText('abcdefghij', options));
    expect(first.map((chunk) => chunk.id)).toEqual([...new Set(first.map((chunk) => chunk.id))]);
    expect(
      first.every((chunk) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(chunk.id)
      )
    ).toBe(true);
  });

  it('rejects empty text and invalid chunk settings', () => {
    expect(() => chunkText('   ', options)).toThrow();
    expect(() => chunkText('abc', { ...options, overlapCharacters: 4 })).toThrow();
    expect(() => chunkText('abc', { ...options, maxCharacters: 0 })).toThrow();
  });

  it('keeps Unicode scalar values intact while preserving UTF-16 source offsets', () => {
    const chunks = chunkText('A🙂B', { ...options, maxCharacters: 3, overlapCharacters: 0 });
    expect(chunks.map((chunk) => [chunk.text, chunk.startOffset, chunk.endOffset])).toEqual([
      ['A🙂', 0, 3],
      ['B', 3, 4]
    ]);
  });
});
