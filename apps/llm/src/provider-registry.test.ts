import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlmProvider } from './provider-registry.js';

afterEach(() => vi.unstubAllGlobals());

describe('createLlmProvider', () => {
  it('creates the mock provider', () => {
    expect(createLlmProvider({ provider: 'mock' }).constructor.name).toBe('MockProvider');
  });
  it('creates the ollama provider without an API key and embeds with the local embedding model', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ embedding: [0.5, 0.25] }] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = createLlmProvider({ provider: 'ollama' });
    await expect(provider.listModels()).resolves.toMatchObject([
      { id: 'qwen3:4b', provider: 'ollama' }
    ]);
    const { embeddings } = await provider.embed({ model: 'text-embedding-3-small', input: 'hi' });
    expect(embeddings[0]).toEqual([0.5, 0.25]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/embeddings');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'nomic-embed-text', input: 'hi' });
  });
  it('asks OpenAI for vectors matching the pgvector column size', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ data: [{ embedding: [1] }] }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await createLlmProvider({
      provider: 'openai',
      apiKey: 'k',
      baseUrl: 'https://example.test/v1'
    }).embed({ model: 'text-embedding-3-small', input: 'hi' });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toMatchObject({ dimensions: 768 });
  });
  it('rejects unknown providers', () => {
    expect(() => createLlmProvider({ provider: 'unknown' })).toThrow('MODEL_UNAVAILABLE');
  });
});
