import type { CorsOptions } from 'cors';

import { env } from './env.js';

const configuredOrigins = new Set(
  env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/;

export const corsOptions: CorsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    const isServerToServerRequest = !origin;
    const isConfiguredOrigin = origin ? configuredOrigins.has(origin) : false;
    const isLocalDevelopmentRequest =
      env.NODE_ENV !== 'production' && origin ? localDevelopmentOrigin.test(origin) : false;

    if (isServerToServerRequest || isConfiguredOrigin || isLocalDevelopmentRequest) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
};
