import { AppError } from '../../../shared/errors/AppError.js';
import { assertPublicHttpsUrl } from '../../../shared/security/public-url.policy.js';
import type {
  HttpRequestGateway,
  HttpRequestInput,
  HttpRequestResult,
} from '../domain/http-request.gateway.js';

const maxResponseBytes = 1_000_000;

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes)
    throw new AppError('HTTP response exceeds 1 MB.', 422, 'HTTP_RESPONSE_TOO_LARGE');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxResponseBytes) {
      await reader.cancel();
      throw new AppError('HTTP response exceeds 1 MB.', 422, 'HTTP_RESPONSE_TOO_LARGE');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(body);
}

function parseBody(text: string, contentType: string | null): unknown {
  if (!text) return null;
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AppError('HTTP endpoint returned invalid JSON.', 422, 'INVALID_HTTP_JSON');
    }
  }
  return text;
}

export class SecureHttpRequestGateway implements HttpRequestGateway {
  async send(input: HttpRequestInput): Promise<HttpRequestResult> {
    const url = await assertPublicHttpsUrl(input.url, 'HTTP request URL');
    const timeout = AbortSignal.timeout(input.timeoutMs);
    const signal = AbortSignal.any([input.signal, timeout]);
    const startedAt = performance.now();
    const response = await fetch(url, {
      body: input.method === 'GET' ? undefined : input.body,
      headers: input.headers,
      method: input.method,
      redirect: 'error',
      signal,
    });
    const text = await readLimitedBody(response);
    if (!response.ok) {
      throw new AppError(
        `HTTP endpoint returned status ${response.status}.`,
        422,
        'HTTP_REQUEST_FAILED',
        { status: response.status, body: text.slice(0, 2_000) },
      );
    }
    const safeHeaders = Object.fromEntries(
      ['content-type', 'etag', 'last-modified']
        .map((name) => [name, response.headers.get(name)] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== null),
    );
    return {
      body: parseBody(text, response.headers.get('content-type')),
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      headers: safeHeaders,
      status: response.status,
      url: url.toString(),
    };
  }
}
