import { describe, expect, it, vi } from 'vitest';

import type { HttpRequestGateway } from '../domain/http-request.gateway.js';
import { HttpRequestExecutor } from './nodeExecutors.js';

describe('HttpRequestExecutor', () => {
  it('interpolates incoming values into URL, headers, and body', async () => {
    const send = vi.fn<HttpRequestGateway['send']>().mockResolvedValue({
      body: { accepted: true },
      durationMs: 12,
      headers: { 'content-type': 'application/json' },
      status: 200,
      url: 'https://api.example.com/weather/21',
    });
    const output = await new HttpRequestExecutor({ send }).execute(
      {
        id: 'http',
        kind: 'http',
        title: 'HTTP',
        description: '',
        meta: '',
        position: { x: 0, y: 0 },
        config: {
          url: 'https://api.example.com/weather/{{weather.temperature}}',
          method: 'POST',
          headers: { 'x-condition': '{{weather.condition}}', 'content-type': 'application/json' },
          body: '{"temperature":{{weather.temperature}}}',
          timeoutMs: 5_000,
        },
      },
      {
        allOutputs: {},
        input: [
          {
            weather: {
              condition: 'Clear sky',
              isLive: true,
              temperature: 21,
              unit: 'celsius',
              weatherCode: 0,
            },
          },
        ],
        runId: 'run',
        signal: new AbortController().signal,
        workflowId: 'workflow',
      },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '{"temperature":21}',
        headers: expect.objectContaining({ 'x-condition': 'Clear sky' }),
        method: 'POST',
        url: 'https://api.example.com/weather/21',
      }),
    );
    expect(output.http?.status).toBe(200);
  });
});
