import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { AppError } from '../errors/AppError.js';

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(
        new AppError('Request validation failed.', 422, 'VALIDATION_ERROR', result.error.flatten()),
      );
      return;
    }
    request.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(
        new AppError('Request validation failed.', 422, 'VALIDATION_ERROR', result.error.flatten()),
      );
      return;
    }
    request.params = result.data as typeof request.params;
    next();
  };
}
