import type { Request, Response } from 'express';

import type { DashboardService } from '../application/DashboardService.js';

export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  get = async (_request: Request, response: Response) => {
    response.json({ data: await this.service.get() });
  };
}
