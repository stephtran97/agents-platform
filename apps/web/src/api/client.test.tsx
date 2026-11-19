import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDocument } from './client.js';

afterEach(() => vi.unstubAllGlobals());

describe('deleteDocument', () => {
  it('sends no JSON content-type because Fastify rejects an empty JSON body', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await deleteDocument('doc 1');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/v1/documents/doc%201');
    expect(init.method).toBe('DELETE');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-tenant-id']).toBe('local');
    expect(headers).not.toHaveProperty('content-type');
  });
  it('treats 404 as already deleted and surfaces other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 }))
    );
    await expect(deleteDocument('x')).resolves.toBeUndefined();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    );
    await expect(deleteDocument('x')).rejects.toThrow('DELETE_FAILED');
  });
});
