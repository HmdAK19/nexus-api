import { AppError } from '../../../shared/errors/AppError.js';
import type { WebhookEndpointRepository } from '../domain/webhook-endpoint.repository.js';
import type { WebhookEndpointDraft } from '../domain/webhook-endpoint.types.js';
import { parsePublicWebhookUrl } from '../domain/webhook-url.policy.js';

export class WebhookEndpointService {
  constructor(private readonly repository: WebhookEndpointRepository) {}

  list() {
    return this.repository.list();
  }

  create(draft: WebhookEndpointDraft) {
    parsePublicWebhookUrl(draft.url);
    return this.repository.create(draft);
  }

  async update(id: string, draft: WebhookEndpointDraft) {
    await this.requireEndpoint(id);
    parsePublicWebhookUrl(draft.url);
    return this.repository.update(id, draft);
  }

  async remove(id: string) {
    await this.requireEndpoint(id);
    await this.repository.remove(id);
  }

  async test(id: string) {
    const endpoint = await this.requireEndpoint(id);
    const url = parsePublicWebhookUrl(endpoint.url);
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'nexus.webhook.test', sentAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`Webhook returned ${response.status}.`);
      const updated = await this.repository.recordTest(id, 'succeeded');
      return { endpoint: updated, statusCode: response.status };
    } catch (error) {
      await this.repository.recordTest(id, 'failed');
      throw new AppError(
        error instanceof Error ? error.message : 'Webhook connection failed.',
        502,
        'WEBHOOK_TEST_FAILED',
      );
    }
  }

  private async requireEndpoint(id: string) {
    const endpoint = await this.repository.findById(id);
    if (!endpoint) throw new AppError('Webhook endpoint not found.', 404, 'WEBHOOK_NOT_FOUND');
    return endpoint;
  }
}
