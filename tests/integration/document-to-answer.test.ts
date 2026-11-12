import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

// Integration test: needs the full Docker stack (`docker compose up -d --build --wait`) with
// LLM_PROVIDER=mock. It is skipped automatically when the API is not reachable.
const apiUrl = process.env.API_URL ?? 'http://localhost:4100';
const fixture = readFileSync(`${process.cwd()}/tests/evaluation/fixtures/handbook.txt`);

describe('document to answer (integration)', () => {
  let reachable = false;
  beforeAll(async () => {
    reachable = await fetch(`${apiUrl}/health`).then(
      (r) => r.ok,
      () => false
    );
  });
  const headers = { 'content-type': 'application/json', 'x-tenant-id': `e2e-${randomUUID()}` };
  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${apiUrl}${path}`, { ...init, headers });

  it('uploads, ingests, and answers with a citation and trace id', async (ctx) => {
    if (!reachable) return ctx.skip();
    const upload = await call('/v1/documents', {
      method: 'POST',
      body: JSON.stringify({
        filename: 'handbook.txt',
        contentType: 'text/plain',
        sizeBytes: fixture.length,
        contentBase64: fixture.toString('base64')
      })
    });
    expect(upload.status).toBe(201);
    const { id } = (await upload.json()) as { id: string };

    let status = 'pending';
    for (
      const deadline = Date.now() + 60_000;
      Date.now() < deadline && !['ready', 'failed'].includes(status);
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      status = ((await (await call(`/v1/documents/${id}`)).json()) as { status: string }).status;
    }
    expect(status).toBe('ready');

    const created = await call('/v1/conversations', { method: 'POST', body: '{}' });
    expect(created.status).toBe(201);
    const conversation = (await created.json()) as { id: string };
    const reply = await call(`/v1/conversations/${conversation.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message: 'How many vacation days do full-time employees accrue per year?'
      })
    });
    expect(reply.status).toBe(200);
    const body = (await reply.json()) as {
      answer: string;
      traceId: string;
      citations: { documentId: string; text?: string }[];
    };
    expect(body.traceId).toBeTruthy();
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.citations.every((citation) => citation.documentId === id)).toBe(true);
    expect(body.answer).toContain('25 days of paid vacation');
  }, 90_000);

  it("does not expose one tenant's documents to another", async (ctx) => {
    if (!reachable) return ctx.skip();
    const other = await fetch(`${apiUrl}/v1/documents`, {
      headers: { 'x-tenant-id': `e2e-${randomUUID()}` }
    });
    expect(await other.json()).toEqual([]);
  });
});
