import { createHash } from 'node:crypto';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const namespace = Buffer.from('6f3f1d0e9a4b4c7d8e2a5b1c0d9f8e7a', 'hex');

/** Deterministic RFC 4122 version-5 UUID, so the same name always maps to the same id. */
export function deterministicUuid(name: string): string {
  const hash = createHash('sha1').update(namespace).update(name).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Tenant keys such as `local` are mapped to stable UUIDs; UUID tenant ids pass through lowercased. */
export function toTenantUuid(tenantKey: string): string {
  return uuidPattern.test(tenantKey)
    ? tenantKey.toLowerCase()
    : deterministicUuid(`tenant:${tenantKey}`);
}

/** Id of the implicit default knowledge base each tenant owns. */
export function defaultKnowledgeBaseId(tenantId: string): string {
  return deterministicUuid(`knowledge-base:default:${tenantId}`);
}
