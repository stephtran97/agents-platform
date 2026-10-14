import { describe, expect, it } from 'vitest';
import { MockProvider } from './mock-provider.js';

describe('MockProvider', () => {
  it('returns deterministic embeddings and completion responses', async () => {
    const provider = new MockProvider();
    const embedding = await provider.embed({ model: 'mock-embedding', input: 'hello' });
    const completion = await provider.complete({
      model: 'mock-chat',
      messages: [{ role: 'user', content: 'What is hello?' }],
    });
    expect(embedding.embeddings[0]).toHaveLength(1536);
    expect(completion.message.content).toContain('hello');
  });
});
