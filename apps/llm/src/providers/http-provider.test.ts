import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAiCompatibleProvider } from './http-provider.js';

const request = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] };
const options = {
  baseUrl: 'https://example.test/v1',
  apiKey: 'secret',
  model: 'm',
  embeddingModel: 'e'
};

const chatBody = JSON.stringify({
  model: 'm',
  choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
});

afterEach(() => vi.unstubAllGlobals());

describe('OpenAiCompatibleProvider', () => {
  it('authenticates OpenAI with a bearer token and Azure with an api-key header', async () => {
    const fetchMock = vi.fn(async () => new Response(chatBody, { status: 200 }));
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

  it('maps OpenAI chat and embedding responses to the gateway contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(chatBody, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({ ...options, provider: 'openai' });
    await expect(provider.complete({ ...request, maxTokens: 5 })).resolves.toEqual({
      model: 'm',
      message: { role: 'assistant', content: 'hello' },
      finishReason: 'stop',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
      max_tokens: 5
    });
    await expect(provider.embed({ model: 'e', input: 'x' })).resolves.toMatchObject({
      embeddings: [[0.1, 0.2]]
    });
  });

  it('sends no authorization header without an API key and can force the configured model', async () => {
    const fetchMock = vi.fn(async () => new Response(chatBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new OpenAiCompatibleProvider({
      ...options,
      apiKey: '',
      provider: 'ollama',
      forceModel: true
    }).complete({ ...request, model: 'mock-chat' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(init.body as string).model).toBe('m');
  });
});
