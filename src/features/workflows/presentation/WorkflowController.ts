import type { Request, Response } from 'express';

import type { WorkflowService } from '../application/WorkflowService.js';

export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  list = async (_request: Request, response: Response) => {
    response.json({ data: await this.service.list() });
  };

  get = async (request: Request, response: Response) => {
    response.json({ data: await this.service.get(String(request.params.id)) });
  };

  create = async (request: Request, response: Response) => {
    response.status(201).json({ data: await this.service.create(request.body) });
  };

  update = async (request: Request, response: Response) => {
    response.json({ data: await this.service.update(String(request.params.id), request.body) });
  };

  delete = async (request: Request, response: Response) => {
    await this.service.delete(String(request.params.id));
    response.status(204).send();
  };

  setFavorite = async (request: Request, response: Response) => {
    response.json({
      data: await this.service.setFavorite(String(request.params.id), request.body.isFavorite),
    });
  };

  setEnabled = async (request: Request, response: Response) => {
    response.json({
      data: await this.service.setEnabled(String(request.params.id), request.body.isEnabled),
    });
  };
}
