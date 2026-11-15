import type { Request, Response } from 'express';

import type { BulkInboxAction, InboxAction } from '../domain/inbox.schema.js';
import type { InboxFilter } from '../domain/inbox.types.js';
import type { InboxService } from '../application/InboxService.js';

const filters = new Set<InboxFilter>(['active', 'unread', 'archived']);

export class InboxController {
  constructor(private readonly service: InboxService) {}

  list = async (request: Request, response: Response) => {
    const requestedFilter = String(request.query.filter ?? 'active') as InboxFilter;
    const filter = filters.has(requestedFilter) ? requestedFilter : 'active';
    const limit = Number(request.query.limit ?? 50);
    const query = String(request.query.q ?? '').slice(0, 120);
    const order = request.query.order === 'oldest' ? 'oldest' : 'newest';
    response.json({
      data: await this.service.list(filter, Number.isFinite(limit) ? limit : 50, query, order),
    });
  };

  summary = async (_request: Request, response: Response) => {
    response.json({ data: await this.service.summary() });
  };

  bulk = async (request: Request, response: Response) => {
    response.json({
      data: await this.service.bulk(
        request.body.ids as string[],
        request.body.action as BulkInboxAction,
      ),
    });
  };

  update = async (request: Request, response: Response) => {
    const message = await this.service.update(
      String(request.params.id),
      request.body.action as InboxAction,
    );
    response.json({ data: message });
  };

  delete = async (request: Request, response: Response) => {
    await this.service.delete(String(request.params.id));
    response.status(204).send();
  };
}
