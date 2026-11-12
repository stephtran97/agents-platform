import type { Conversation, ConversationMessage } from '../entities.js';
import type { TenantContext } from '../tenant-context.js';

export type NewConversation = Pick<Conversation, 'id'> & Pick<Conversation, 'title'>;
export type NewConversationMessage = Pick<
  ConversationMessage,
  'id' | 'conversationId' | 'message'
> &
  Partial<Pick<ConversationMessage, 'citations'>>;

export interface ConversationRepository {
  create(context: TenantContext, conversation: NewConversation): Promise<Conversation>;
  getById(context: TenantContext, id: string): Promise<Conversation | null>;
  addMessage(context: TenantContext, message: NewConversationMessage): Promise<ConversationMessage>;
  listMessages(context: TenantContext, conversationId: string): Promise<ConversationMessage[]>;
}
