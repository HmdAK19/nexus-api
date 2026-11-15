import type { Request, Response } from 'express';

import type { PrismaWorkspaceExportRepository } from '../infrastructure/PrismaWorkspaceExportRepository.js';

export class WorkspaceExportController {
  constructor(private readonly repository: PrismaWorkspaceExportRepository) {}

  get = async (_request: Request, response: Response) => {
    response.json({ data: await this.repository.export() });
  };
}
