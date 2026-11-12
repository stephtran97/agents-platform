import { describe, expect, it } from 'vitest';
import { defaultKnowledgeBaseId, deterministicUuid, toTenantUuid } from './ids.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('deterministic ids', () => {
  it('produces stable version-5 UUIDs', () => {
    expect(deterministicUuid('x')).toBe(deterministicUuid('x'));
    expect(deterministicUuid('x')).toMatch(uuid);
    expect(deterministicUuid('x')).not.toBe(deterministicUuid('y'));
  });

  it('maps tenant keys to UUIDs and passes UUID tenants through', () => {
    expect(toTenantUuid('local')).toMatch(uuid);
    expect(toTenantUuid('local')).not.toBe(toTenantUuid('local-2'));
    expect(toTenantUuid('11111111-1111-1111-1111-111111111111')).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('gives each tenant its own default knowledge base UUID', () => {
    const a = defaultKnowledgeBaseId(toTenantUuid('a'));
    expect(a).toMatch(uuid);
    expect(a).toBe(defaultKnowledgeBaseId(toTenantUuid('a')));
    expect(a).not.toBe(defaultKnowledgeBaseId(toTenantUuid('b')));
  });
});
