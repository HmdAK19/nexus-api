export type HttpRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestInput {
  body?: string;
  headers: Record<string, string>;
  method: HttpRequestMethod;
  signal: AbortSignal;
  timeoutMs: number;
  url: string;
}

export interface HttpRequestResult {
  body: unknown;
  durationMs: number;
  headers: Record<string, string>;
  status: number;
  url: string;
}

export interface HttpRequestGateway {
  send: (input: HttpRequestInput) => Promise<HttpRequestResult>;
}
