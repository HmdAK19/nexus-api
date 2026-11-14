import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { createApiRouter } from './app/routes.js';
import { corsOptions } from './shared/config/cors.js';
import { errorHandler, notFoundHandler } from './shared/http/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use((request, response, next) => {
    const requestId = request.header('x-request-id') ?? randomUUID();
    response.setHeader('x-request-id', requestId);
    next();
  });
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/api/v1', createApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
