import type { Request, Response } from 'express';

import type { ProfileService } from '../application/ProfileService.js';

export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  get = async (_request: Request, response: Response) => {
    response.json({ data: await this.service.get() });
  };

  update = async (request: Request, response: Response) => {
    response.json({ data: await this.service.update(request.body) });
  };
}
