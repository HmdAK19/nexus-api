export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEndpointDraft {
  name: string;
  url: string;
  enabled: boolean;
}
