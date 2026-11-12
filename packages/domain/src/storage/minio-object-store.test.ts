import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { afterEach, expect, it, vi } from 'vitest';
import { MinioObjectStore } from './minio-object-store.js';

afterEach(() => vi.restoreAllMocks());

it('stores, retrieves, and deletes bytes under a tenant/document-scoped key', async () => {
  const objects = new Map<string, Buffer>();
  const send = vi.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) => {
    if (command instanceof PutObjectCommand) {
      objects.set(command.input.Key!, command.input.Body as Buffer);
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const body = objects.get(command.input.Key!);
      if (!body) throw new Error('Missing object');
      return { Body: { transformToByteArray: async () => body } } as never;
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(command.input.Key!);
      return {};
    }
    throw new Error('Unexpected command');
  });
  const store = new MinioObjectStore({
    endpoint: 'http://localhost:9000',
    bucket: 'test',
    accessKey: 'key',
    secretKey: 'secret'
  });

  const key = await store.put('tenant', 'document', Buffer.from('hello'), 'text/plain');
  expect(key).toMatch(/^tenant\/document\/[^/]+$/);
  expect(await store.get(key)).toEqual(Buffer.from('hello'));
  await store.delete(key);
  expect(objects.has(key)).toBe(false);
  expect(send).toHaveBeenCalledTimes(3);
});
