import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../errors/AppError.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(`Route ${request.method} ${request.path} was not found.`, 404, 'ROUTE_NOT_FOUND'),
  );
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: error.flatten(),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    response
      .status(error.statusCode)
      .json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  console.error(error);
  response
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
};
