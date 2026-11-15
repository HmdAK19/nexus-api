import { Router } from 'express';

import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { validateBody } from '../../../shared/http/validate.js';
import { workspaceProfileSchema } from '../domain/profile.schema.js';
import type { ProfileController } from './ProfileController.js';

export function createProfileRouter(controller: ProfileController) {
  const router = Router();
  router.get('/', asyncHandler(controller.get));
  router.put('/', validateBody(workspaceProfileSchema), asyncHandler(controller.update));
  return router;
}
