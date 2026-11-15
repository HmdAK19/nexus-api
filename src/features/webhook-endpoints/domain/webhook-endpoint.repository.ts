import type { WebhookEndpoint, WebhookEndpointDraft } from './webhook-endpoint.types.js';

export interface WebhookEndpointRepository {
  list: () => Promise<WebhookEndpoint[]>;
  findById: (id: string) => Promise<WebhookEndpoint | null>;
  create: (draft: WebhookEndpointDraft) => Promise<WebhookEndpoint>;
  update: (id: string, draft: WebhookEndpointDraft) => Promise<WebhookEndpoint>;
  remove: (id: string) => Promise<void>;
  recordTest: (id: string, status: 'succeeded' | 'failed') => Promise<WebhookEndpoint>;
}
