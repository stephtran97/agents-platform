import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MinioObjectStore } from './minio-object-store.js';

const bucket = `task3-${randomUUID()}`;
const store = new MinioObjectStore({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  bucket,
  accessKey: process.env.S3_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
});

beforeAll(async () => { await store.createBucket(); });
afterAll(async () => { await store.deleteBucket(); });

it('round trips bytes through a tenant/document-scoped opaque key', async () => {
  const tenantId = randomUUID();
  const documentId = randomUUID();
  const key = await store.put(tenantId, documentId, Buffer.from('hello'), 'text/plain');
  expect(key).toContain(tenantId);
  expect(key).toContain(documentId);
  expect((await store.get(key)).toString()).toBe('hello');
  await store.delete(key);
  await expect(store.get(key)).rejects.toThrow();
});
