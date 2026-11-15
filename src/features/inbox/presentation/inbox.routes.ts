import { Router } from 'express';

import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { validateBody } from '../../../shared/http/validate.js';
import { bulkInboxActionSchema, inboxActionSchema } from '../domain/inbox.schema.js';
import type { InboxController } from './InboxController.js';

export function createInboxRouter(controller: InboxController) {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/summary', asyncHandler(controller.summary));
  router.patch('/bulk', validateBody(bulkInboxActionSchema), asyncHandler(controller.bulk));
  router.patch('/:id', validateBody(inboxActionSchema), asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.delete));
  return router;
}
