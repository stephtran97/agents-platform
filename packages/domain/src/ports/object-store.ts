export interface ObjectStore {
  put(tenantId: string, documentId: string, contents: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
