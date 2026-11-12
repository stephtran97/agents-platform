import type { TenantContext } from '../tenant-context.js';

export interface TenantScopeRepository {
  /** Idempotently create the tenant row (needed by foreign keys). */
  ensureTenant(context: TenantContext): Promise<void>;
  /** Idempotently create the tenant and its default knowledge base; returns the knowledge base id. */
  ensureDefaultKnowledgeBase(context: TenantContext): Promise<string>;
}
