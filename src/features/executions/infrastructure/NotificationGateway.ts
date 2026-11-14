import { isIP } from 'node:net';

import { AppError } from '../../../shared/errors/AppError.js';
import type { NotificationGateway, NotificationRequest } from '../domain/notification.gateway.js';

function isUnsafeHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (isIP(normalized) === 4) {
    const [first = -1, second = -1] = normalized.split('.').map(Number);
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  return isIP(normalized) === 6 && (normalized === '::1' || normalized.startsWith('fc'));
}

export class HttpNotificationGateway implements NotificationGateway {
  async deliver(request: NotificationRequest, signal: AbortSignal) {
    if (request.channel === 'inApp') {
      return { channel: 'inApp' as const, delivered: true, destination: 'Nexus inbox' };
    }
    if (!request.webhookUrl) {
      throw new AppError('A webhook URL is required.', 422, 'WEBHOOK_URL_REQUIRED');
    }
    const url = new URL(request.webhookUrl);
    if (url.protocol !== 'https:' || isUnsafeHost(url.hostname)) {
      throw new AppError('Webhook URL must be a public HTTPS endpoint.', 422, 'UNSAFE_WEBHOOK_URL');
    }
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'workflow.briefing.created', message: request.message }),
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}.`);
    return { channel: 'webhook' as const, delivered: true, destination: url.hostname };
  }
}
