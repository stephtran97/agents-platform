import type { Pool } from 'pg';
import { defaultKnowledgeBaseId } from '../ids.js';
import type { TenantScopeRepository } from '../ports/tenant-scope-repository.js';
import type { TenantContext } from '../tenant-context.js';

export class PostgresTenantScopeRepository implements TenantScopeRepository {
  constructor(private readonly pool: Pool) {}

  async ensureTenant(context: TenantContext): Promise<void> {
    await this.pool.query('INSERT INTO tenants (id, name) VALUES ($1::uuid, $1::text) ON CONFLICT (id) DO NOTHING', [context.tenantId]);
  }

  async ensureDefaultKnowledgeBase(context: TenantContext): Promise<string> {
    await this.ensureTenant(context);
    const id = defaultKnowledgeBaseId(context.tenantId);
    await this.pool.query(
      `INSERT INTO knowledge_bases (id, tenant_id, name) VALUES ($1, $2, 'Default')
       ON CONFLICT (id) DO NOTHING`,
      [id, context.tenantId],
    );
    return id;
  }
}
