import type { PrismaClient } from '@prisma/client';

import type { WebhookEndpointRepository } from '../domain/webhook-endpoint.repository.js';
import type { WebhookEndpointDraft } from '../domain/webhook-endpoint.types.js';

export class PrismaWebhookEndpointRepository implements WebhookEndpointRepository {
  constructor(private readonly database: PrismaClient) {}

  list() {
    return this.database.webhookEndpoint.findMany({
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
    });
  }

  findById(id: string) {
    return this.database.webhookEndpoint.findUnique({ where: { id } });
  }

  create(draft: WebhookEndpointDraft) {
    return this.database.webhookEndpoint.create({ data: draft });
  }

  update(id: string, draft: WebhookEndpointDraft) {
    return this.database.webhookEndpoint.update({ where: { id }, data: draft });
  }

  async remove(id: string) {
    await this.database.webhookEndpoint.delete({ where: { id } });
  }

  recordTest(id: string, status: 'succeeded' | 'failed') {
    return this.database.webhookEndpoint.update({
      where: { id },
      data: { lastTestedAt: new Date(), lastTestStatus: status },
    });
  }
}
