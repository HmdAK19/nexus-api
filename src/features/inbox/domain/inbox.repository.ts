import type { CreateInboxMessage, InboxFilter, InboxMessage, InboxStatus } from './inbox.types.js';

export interface InboxRepository {
  bulkDelete: (ids: string[]) => Promise<number>;
  bulkUpdateStatus: (ids: string[], status: InboxStatus) => Promise<number>;
  countByIds: (ids: string[]) => Promise<number>;
  create: (input: CreateInboxMessage) => Promise<InboxMessage>;
  delete: (id: string) => Promise<void>;
  findById: (id: string) => Promise<InboxMessage | null>;
  list: (
    filter: InboxFilter,
    limit: number,
    query: string,
    order: 'newest' | 'oldest',
  ) => Promise<InboxMessage[]>;
  unreadCount: () => Promise<number>;
  updateStatus: (id: string, status: InboxStatus) => Promise<InboxMessage>;
}
