export interface NotificationRequest {
  channel: 'inApp' | 'webhook';
  message: string;
  webhookUrl?: string;
}

export interface NotificationResult {
  channel: 'inApp' | 'webhook';
  delivered: boolean;
  destination: string;
}

export interface NotificationGateway {
  deliver: (request: NotificationRequest, signal: AbortSignal) => Promise<NotificationResult>;
}
