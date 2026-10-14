import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand,
  GetObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStore } from '../ports/object-store.js';

interface MinioObjectStoreOptions {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export class MinioObjectStore implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly options: MinioObjectStoreOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
    });
  }

  async createBucket(): Promise<void> {
    await this.client.send(new CreateBucketCommand({ Bucket: this.options.bucket }));
  }

  async deleteBucket(): Promise<void> {
    await this.client.send(new DeleteBucketCommand({ Bucket: this.options.bucket }));
  }

  async put(tenantId: string, documentId: string, contents: Buffer, contentType: string): Promise<string> {
    const key = `${encodeURIComponent(tenantId)}/${encodeURIComponent(documentId)}/${randomUUID()}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucket, Key: key, Body: contents, ContentType: contentType,
    }));
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
    if (!response.Body) throw new Error('Object response has no body');
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }
}
