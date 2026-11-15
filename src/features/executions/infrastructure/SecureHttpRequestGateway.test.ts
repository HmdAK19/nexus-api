import { afterEach, describe, expect, it, vi } from 'vitest';

import { SecureHttpRequestGateway } from './SecureHttpRequestGateway.js';

describe('SecureHttpRequestGateway', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns bounded JSON from a public HTTPS endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json', etag: 'v1' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new SecureHttpRequestGateway().send({
      headers: {},
      method: 'GET',
      signal: new AbortController().signal,
      timeoutMs: 1_000,
      url: 'https://8.8.8.8/example',
    });

    expect(result).toMatchObject({ body: { ok: true }, status: 200, headers: { etag: 'v1' } });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://8.8.8.8/example'),
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
    );
  });

  it.each(['http://example.com', 'https://127.0.0.1', 'https://192.168.1.10'])(
    'blocks unsafe endpoint %s',
    async (url) => {
      vi.stubGlobal('fetch', vi.fn());
      await expect(
        new SecureHttpRequestGateway().send({
          headers: {},
          method: 'GET',
          signal: new AbortController().signal,
          timeoutMs: 1_000,
          url,
        }),
      ).rejects.toMatchObject({ code: 'UNSAFE_PUBLIC_URL' });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('turns unsuccessful responses into retryable node failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 })));
    await expect(
      new SecureHttpRequestGateway().send({
        headers: {},
        method: 'POST',
        signal: new AbortController().signal,
        timeoutMs: 1_000,
        url: 'https://8.8.8.8/example',
      }),
    ).rejects.toMatchObject({ code: 'HTTP_REQUEST_FAILED' });
  });
});
