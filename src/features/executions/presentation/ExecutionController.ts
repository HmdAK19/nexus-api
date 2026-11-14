import type { Request, Response } from 'express';

import type { ExecutionService } from '../application/ExecutionService.js';

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

  get = async (request: Request, response: Response) => {
    response.json({ data: await this.service.getRun(String(request.params.runId)) });
  };
}
