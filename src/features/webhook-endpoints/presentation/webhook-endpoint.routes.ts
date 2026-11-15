import { Router } from 'express';

import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { validateBody, validateParams } from '../../../shared/http/validate.js';
import {
  webhookEndpointIdSchema,
  webhookEndpointSchema,
} from '../domain/webhook-endpoint.schema.js';
import type { WebhookEndpointController } from './WebhookEndpointController.js';

export function createWebhookEndpointRouter(controller: WebhookEndpointController) {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.post('/', validateBody(webhookEndpointSchema), asyncHandler(controller.create));
  router.put(
    '/:id',
    validateParams(webhookEndpointIdSchema),
    validateBody(webhookEndpointSchema),
    asyncHandler(controller.update),
  );
  router.delete('/:id', validateParams(webhookEndpointIdSchema), asyncHandler(controller.remove));
  router.post('/:id/test', validateParams(webhookEndpointIdSchema), asyncHandler(controller.test));
  return router;
}
