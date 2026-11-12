import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from './http-provider.js';

const request = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] };
const options = {
  baseUrl: 'https://example.test/v1',
  apiKey: 'secret',
  model: 'm',
  embeddingModel: 'e'
};

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiCompatibleProvider', () => {
  it('authenticates OpenAI with a bearer token and Azure with an api-key header', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new OpenAiCompatibleProvider({ ...options, provider: 'openai' }).complete(request);
    await new OpenAiCompatibleProvider({ ...options, provider: 'azure-openai' }).complete(request);
    const [openai, azure] = fetchMock.mock.calls.map(
      (call) => (call as unknown as [string, RequestInit])[1].headers as Record<string, string>
    );
    expect(openai).toMatchObject({ authorization: 'Bearer secret' });
    expect(azure).toMatchObject({ 'api-key': 'secret' });
    expect(azure).not.toHaveProperty('authorization');
  });

  it('maps HTTP errors to MODEL_UNAVAILABLE and aborts slow upstreams as MODEL_TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 }))
    );
    await expect(
      new OpenAiCompatibleProvider({ ...options, provider: 'openai' }).complete(request)
    ).rejects.toThrow('MODEL_UNAVAILABLE');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal!.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      )
    );
    await expect(
      new OpenAiCompatibleProvider({ ...options, provider: 'openai', timeoutMs: 30 }).complete(
        request
      )
    ).rejects.toThrow('MODEL_TIMEOUT');
  });
});
