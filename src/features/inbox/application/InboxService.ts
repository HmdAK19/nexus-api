import { AppError } from '../../../shared/errors/AppError.js';
import type { InboxRepository } from '../domain/inbox.repository.js';
import type { BulkInboxAction, InboxAction } from '../domain/inbox.schema.js';
import type { InboxFilter, InboxStatus } from '../domain/inbox.types.js';

const statusByAction: Record<InboxAction, InboxStatus> = {
  read: 'read',
  unread: 'unread',
  archive: 'archived',
  restore: 'read',
};

export class InboxService {
  constructor(private readonly repository: InboxRepository) {}

  list(filter: InboxFilter, limit: number, query: string, order: 'newest' | 'oldest') {
    return this.repository.list(filter, Math.min(Math.max(limit, 1), 100), query.trim(), order);
  }

  async summary() {
    return { unreadCount: await this.repository.unreadCount() };
  }

  async update(id: string, action: InboxAction) {
    await this.requireMessage(id);
    return this.repository.updateStatus(id, statusByAction[action]);
  }

  async delete(id: string) {
    await this.requireMessage(id);
    await this.repository.delete(id);
  }

  async bulk(ids: string[], action: BulkInboxAction) {
    const uniqueIds = [...new Set(ids)];
    if ((await this.repository.countByIds(uniqueIds)) !== uniqueIds.length) {
      throw new AppError('One or more inbox messages were not found.', 404, 'INBOX_NOT_FOUND');
    }
    const affected =
      action === 'delete'
        ? await this.repository.bulkDelete(uniqueIds)
        : await this.repository.bulkUpdateStatus(uniqueIds, statusByAction[action]);
    return { affected };
  }

  private async requireMessage(id: string) {
    const message = await this.repository.findById(id);
    if (!message) throw new AppError('Inbox message was not found.', 404, 'INBOX_NOT_FOUND');
    return message;
  }
}
