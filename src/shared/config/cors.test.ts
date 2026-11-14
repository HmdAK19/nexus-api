import { describe, expect, it } from 'vitest';

import { corsOptions } from './cors.js';

function checkOrigin(origin: string | undefined) {
  return new Promise<boolean>((resolve, reject) => {
    if (typeof corsOptions.origin !== 'function') {
      reject(new Error('CORS origin callback is not configured.'));
      return;
    }
    corsOptions.origin(origin, (error, allowed) => {
      if (error) reject(error);
      else resolve(Boolean(allowed));
    });
  });
}

describe('CORS policy', () => {
  it.each(['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5199'])(
    'allows local Vite origin %s in development',
    async (origin) => {
      await expect(checkOrigin(origin)).resolves.toBe(true);
    },
  );

  it('rejects an unrelated origin', async () => {
    await expect(checkOrigin('https://untrusted.example')).rejects.toThrow('not allowed by CORS');
  });
});
