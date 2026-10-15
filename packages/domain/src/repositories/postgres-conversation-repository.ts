import type { Pool, QueryResultRow } from 'pg';
import type { Conversation, ConversationMessage } from '../entities.js';
import type { TenantContext } from '../tenant-context.js';
import type { ConversationRepository, NewConversation, NewConversationMessage } from '../ports/conversation-repository.js';

interface ConversationRow extends QueryResultRow {
  id: string; tenant_id: string; title: string | null; created_at: Date; updated_at: Date;
}

interface MessageRow extends QueryResultRow {
  id: string; tenant_id: string; conversation_id: string;
  message: ConversationMessage['message']; citations: ConversationMessage['citations'] | null;
  created_at: Date; updated_at: Date;
}

function toConversation(row: ConversationRow): Conversation {
  return { id: row.id, tenantId: row.tenant_id, title: row.title ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}

function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id, tenantId: row.tenant_id, conversationId: row.conversation_id,
    message: row.message, citations: row.citations ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly pool: Pool) {}

  async create(context: TenantContext, conversation: NewConversation): Promise<Conversation> {
    const result = await this.pool.query<ConversationRow>(
      'INSERT INTO conversations (id, tenant_id, title) VALUES ($1, $2, $3) RETURNING *',
      [conversation.id, context.tenantId, conversation.title ?? null],
    );
    return toConversation(result.rows[0]!);
  }

  async getById(context: TenantContext, id: string): Promise<Conversation | null> {
    const result = await this.pool.query<ConversationRow>('SELECT * FROM conversations WHERE tenant_id = $1 AND id = $2', [context.tenantId, id]);
    return result.rows[0] ? toConversation(result.rows[0]) : null;
  }

  async addMessage(context: TenantContext, message: NewConversationMessage): Promise<ConversationMessage> {
    const result = await this.pool.query<MessageRow>(
      `INSERT INTO messages (id, tenant_id, conversation_id, message, citations)
       SELECT $1, c.tenant_id, c.id, $4::jsonb, $5::jsonb
       FROM conversations c WHERE c.tenant_id = $2 AND c.id = $3 RETURNING *`,
      [message.id, context.tenantId, message.conversationId,
        JSON.stringify(message.message), JSON.stringify(message.citations ?? null)],
    );
    if (!result.rows[0]) throw new Error('Conversation not found in tenant');
    return toMessage(result.rows[0]);
  }

  async listMessages(context: TenantContext, conversationId: string): Promise<ConversationMessage[]> {
    const result = await this.pool.query<MessageRow>(
      'SELECT * FROM messages WHERE tenant_id = $1 AND conversation_id = $2 ORDER BY created_at, id',
      [context.tenantId, conversationId],
    );
    return result.rows.map(toMessage);
  }
}
