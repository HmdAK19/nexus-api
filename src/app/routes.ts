import { Router } from 'express';

import { executionController, workflowController } from './container.js';
import { createWorkflowRouter } from '../features/workflows/presentation/workflow.routes.js';

export function createApiRouter() {
  const router = Router();
  router.get('/health', (_request, response) =>
    response.json({ data: { status: 'ok', timestamp: new Date().toISOString() } }),
  );
  router.use('/workflows', createWorkflowRouter(workflowController, executionController));
  return router;
}
