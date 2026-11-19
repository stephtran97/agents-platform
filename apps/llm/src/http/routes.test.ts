import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../providers/llm-provider.js';
import { MockProvider } from '../providers/mock-provider.js';
import { buildServer } from './server.js';

const completion = { model: 'mock-chat', messages: [{ role: 'user', content: 'hi' }] };
const failing: LlmProvider = {
  complete: async () => {
    throw new Error('upstream exploded with secret details');
  },
  embed: async () => {
    throw new Error('boom');
  },
  listModels: async () => {
    throw new Error('boom');
  }
};
const hanging: LlmProvider = {
  ...failing,
  complete: () => new Promise(() => {}),
  embed: () => new Promise(() => {})
};

describe('LLM gateway routes', () => {
  it('serves deterministic mock completions and embeddings', async () => {
    const app = await buildServer(new MockProvider());
    const completed = await app.inject({
      method: 'POST',
      url: '/v1/completions',
      payload: completion
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().message.content).toBe('Mock answer: hi');
    const embedded = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      payload: { model: 'm', input: 'hello' }
    });
    expect(embedded.json().embeddings[0]).toHaveLength(768);
  });

  it('rejects requests missing model or input with INVALID_REQUEST', async () => {
    const app = await buildServer(new MockProvider());
    const noModel = await app.inject({
      method: 'POST',
      url: '/v1/completions',
      payload: { messages: completion.messages }
    });
    expect(noModel.statusCode).toBe(400);
    expect(noModel.json().code).toBe('INVALID_REQUEST');
    const noInput = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      payload: { model: 'm' }
    });
    expect(noInput.statusCode).toBe(400);
  });

  it('normalizes provider failures to MODEL_UNAVAILABLE without leaking details', async () => {
    const app = await buildServer(failing);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/completions',
      payload: completion
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: 'MODEL_UNAVAILABLE' });
    expect((await app.inject({ method: 'GET', url: '/v1/models' })).json()).toEqual({
      code: 'MODEL_UNAVAILABLE'
    });
  });

  it('returns MODEL_TIMEOUT within the configured deadline for a hanging provider', async () => {
    const app = await buildServer(hanging, { timeoutMs: 50 });
    const started = Date.now();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/completions',
      payload: completion
    });
    expect(response.statusCode).toBe(504);
    expect(response.json()).toEqual({ code: 'MODEL_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(1000);
    const embed = await app.inject({
      method: 'POST',
      url: '/v1/embeddings',
      payload: { model: 'm', input: 'x' }
    });
    expect(embed.json()).toEqual({ code: 'MODEL_TIMEOUT' });
  });
});
