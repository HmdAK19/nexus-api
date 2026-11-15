import { Router } from 'express';

import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { validateBody } from '../../../shared/http/validate.js';
import type { ExecutionController } from '../../executions/presentation/ExecutionController.js';
import {
  workflowDraftSchema,
  workflowEnabledSchema,
  workflowFavoriteSchema,
} from '../domain/workflow.schema.js';
import type { WorkflowController } from './WorkflowController.js';

export function createWorkflowRouter(
  workflows: WorkflowController,
  executions: ExecutionController,
) {
  const router = Router();
  router.get('/', asyncHandler(workflows.list));
  router.post('/', validateBody(workflowDraftSchema), asyncHandler(workflows.create));
  router.get('/:id', asyncHandler(workflows.get));
  router.put('/:id', validateBody(workflowDraftSchema), asyncHandler(workflows.update));
  router.patch(
    '/:id/favorite',
    validateBody(workflowFavoriteSchema),
    asyncHandler(workflows.setFavorite),
  );
  router.patch(
    '/:id/enabled',
    validateBody(workflowEnabledSchema),
    asyncHandler(workflows.setEnabled),
  );
  router.delete('/:id', asyncHandler(workflows.delete));
  router.post('/:id/runs', asyncHandler(executions.execute));
  router.get('/:id/runs', asyncHandler(executions.list));
  router.get('/:id/runs/:runId', asyncHandler(executions.get));
  router.delete('/:id/runs/:runId', asyncHandler(executions.delete));
  return router;
}
