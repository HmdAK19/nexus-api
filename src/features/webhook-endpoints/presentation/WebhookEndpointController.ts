import type { Request, Response } from 'express';

import type { WebhookEndpointService } from '../application/WebhookEndpointService.js';

function endpointId(request: Request) {
  const { id } = request.params;
  return typeof id === 'string' ? id : '';
}

export class WebhookEndpointController {
  constructor(private readonly service: WebhookEndpointService) {}

  list = async (_request: Request, response: Response) => {
    response.json({ data: await this.service.list() });
  };

  create = async (request: Request, response: Response) => {
    response.status(201).json({ data: await this.service.create(request.body) });
  };

  update = async (request: Request, response: Response) => {
    response.json({ data: await this.service.update(endpointId(request), request.body) });
  };

  remove = async (request: Request, response: Response) => {
    await this.service.remove(endpointId(request));
    response.status(204).send();
  };

  test = async (request: Request, response: Response) => {
    response.json({ data: await this.service.test(endpointId(request)) });
  };
}
