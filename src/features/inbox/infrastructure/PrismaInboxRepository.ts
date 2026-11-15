import type { InboxMessage as InboxRecord, Prisma, PrismaClient } from '@prisma/client';

import type { InboxRepository } from '../domain/inbox.repository.js';
import type {
  CreateInboxMessage,
  InboxFilter,
  InboxMessage,
  InboxStatus,
} from '../domain/inbox.types.js';

function mapMessage(record: InboxRecord): InboxMessage {
  return { ...record, status: record.status as InboxStatus };
}

function filterWhere(filter: InboxFilter, query: string): Prisma.InboxMessageWhereInput {
  const status =
    filter === 'archived'
      ? { equals: 'archived' }
      : filter === 'unread'
        ? { equals: 'unread' }
        : { in: ['unread', 'read'] };
  return {
    status,
    ...(query ? { OR: [{ title: { contains: query } }, { body: { contains: query } }] } : {}),
  };
}

export class PrismaInboxRepository implements InboxRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateInboxMessage) {
    return mapMessage(await this.client.inboxMessage.create({ data: input }));
  }

  async bulkDelete(ids: string[]) {
    return (await this.client.inboxMessage.deleteMany({ where: { id: { in: ids } } })).count;
  }

  async bulkUpdateStatus(ids: string[], status: InboxStatus) {
    const now = new Date();
    return (
      await this.client.inboxMessage.updateMany({
        where: { id: { in: ids } },
        data: {
          status,
          readAt: status === 'unread' ? null : now,
          archivedAt: status === 'archived' ? now : null,
        },
      })
    ).count;
  }

  countByIds(ids: string[]) {
    return this.client.inboxMessage.count({ where: { id: { in: ids } } });
  }

  async delete(id: string) {
    await this.client.inboxMessage.delete({ where: { id } });
  }

  async findById(id: string) {
    const record = await this.client.inboxMessage.findUnique({ where: { id } });
    return record ? mapMessage(record) : null;
  }

  async list(filter: InboxFilter, limit: number, query: string, order: 'newest' | 'oldest') {
    const records = await this.client.inboxMessage.findMany({
      where: filterWhere(filter, query),
      orderBy: { createdAt: order === 'newest' ? 'desc' : 'asc' },
      take: limit,
    });
    return records.map(mapMessage);
  }

  unreadCount() {
    return this.client.inboxMessage.count({ where: { status: 'unread' } });
  }

  async updateStatus(id: string, status: InboxStatus) {
    const now = new Date();
    return mapMessage(
      await this.client.inboxMessage.update({
        where: { id },
        data: {
          status,
          readAt: status === 'unread' ? null : now,
          archivedAt: status === 'archived' ? now : null,
        },
      }),
    );
  }
}
