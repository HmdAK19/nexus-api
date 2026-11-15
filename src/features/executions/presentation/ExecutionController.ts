import type { Request, Response } from 'express';

import type { ExecutionService } from '../application/ExecutionService.js';
import { activityQuerySchema } from '../domain/activity.schema.js';
import { AppError } from '../../../shared/errors/AppError.js';

export class ExecutionController {
  constructor(private readonly service: ExecutionService) {}

  execute = async (request: Request, response: Response) => {
    const controller = new AbortController();
    request.once('aborted', () => controller.abort());
    const run = await this.service.execute(String(request.params.id), controller.signal);
    response.status(201).json({ data: run });
  };

  list = async (request: Request, response: Response) => {
    response.json({ data: await this.service.listRuns(String(request.params.id)) });
  };

  activity = async (request: Request, response: Response) => {
    const query = activityQuerySchema.safeParse(request.query);
    if (!query.success) {
      throw new AppError(
        'Activity query validation failed.',
        422,
        'VALIDATION_ERROR',
        query.error.flatten(),
      );
    }
    response.json({ data: await this.service.listActivity(query.data) });
  };

  get = async (request: Request, response: Response) => {
    response.json({ data: await this.service.getRun(String(request.params.runId)) });
  };

  delete = async (request: Request, response: Response) => {
    await this.service.deleteRun(String(request.params.id), String(request.params.runId));
    response.status(204).send();
  };
}
