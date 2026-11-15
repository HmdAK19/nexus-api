import { AppError } from '../../../shared/errors/AppError.js';
import type { InboxRepository } from '../../inbox/domain/inbox.repository.js';
import type { WebhookEndpointRepository } from '../../webhook-endpoints/domain/webhook-endpoint.repository.js';
import { parsePublicWebhookUrl } from '../../webhook-endpoints/domain/webhook-url.policy.js';
import type { NotificationGateway, NotificationRequest } from '../domain/notification.gateway.js';

export class HttpNotificationGateway implements NotificationGateway {
  constructor(
    private readonly inbox: InboxRepository,
    private readonly webhookEndpoints: WebhookEndpointRepository,
  ) {}

  async deliver(request: NotificationRequest, signal: AbortSignal) {
    if (request.channel === 'inApp') {
      await this.inbox.create({
        body: request.message,
        runId: request.runId,
        title: request.title,
        workflowId: request.workflowId,
      });
      return { channel: 'inApp' as const, delivered: true, destination: 'Nexus inbox' };
    }
    if (!request.webhookEndpointId) {
      throw new AppError('A webhook endpoint is required.', 422, 'WEBHOOK_ENDPOINT_REQUIRED');
    }
    const endpoint = await this.webhookEndpoints.findById(request.webhookEndpointId);
    if (!endpoint) {
      throw new AppError('Webhook endpoint not found.', 422, 'WEBHOOK_NOT_FOUND');
    }
    if (!endpoint.enabled) {
      throw new AppError('Webhook endpoint is disabled.', 422, 'WEBHOOK_DISABLED');
    }
    const url = parsePublicWebhookUrl(endpoint.url);
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'workflow.briefing.created', message: request.message }),
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}.`);
    return { channel: 'webhook' as const, delivered: true, destination: endpoint.name };
  }
}
