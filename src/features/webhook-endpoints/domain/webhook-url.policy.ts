import { parsePublicHttpsUrl } from '../../../shared/security/public-url.policy.js';

export function parsePublicWebhookUrl(value: string) {
  return parsePublicHttpsUrl(value, 'Webhook URL');
}
