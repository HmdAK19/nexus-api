import { Router } from 'express';

import {
  executionController,
  inboxController,
  profileController,
  webhookEndpointController,
  dashboardController,
  workflowController,
  workspaceExportController,
} from './container.js';
import { createWorkflowRouter } from '../features/workflows/presentation/workflow.routes.js';
import { createInboxRouter } from '../features/inbox/presentation/inbox.routes.js';
import { asyncHandler } from '../shared/http/asyncHandler.js';
import { createProfileRouter } from '../features/profile/presentation/profile.routes.js';
import { createWebhookEndpointRouter } from '../features/webhook-endpoints/presentation/webhook-endpoint.routes.js';

export function createApiRouter() {
  const router = Router();
  router.get('/health', (_request, response) =>
    response.json({ data: { status: 'ok', timestamp: new Date().toISOString() } }),
  );
  router.use('/workflows', createWorkflowRouter(workflowController, executionController));
  router.get('/activity', asyncHandler(executionController.activity));
  router.use('/inbox', createInboxRouter(inboxController));
  router.use('/profile', createProfileRouter(profileController));
  router.use('/webhook-endpoints', createWebhookEndpointRouter(webhookEndpointController));
  router.get('/dashboard', asyncHandler(dashboardController.get));
  router.get('/workspace/export', asyncHandler(workspaceExportController.get));
  return router;
}
