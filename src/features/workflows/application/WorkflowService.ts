import { AppError } from '../../../shared/errors/AppError.js';
import type { WorkflowRepository } from '../domain/workflow.repository.js';
import type { WorkflowDraft } from '../domain/workflow.types.js';

export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  list() {
    return this.repository.findAll();
  }

  async get(id: string) {
    const workflow = await this.repository.findById(id);
    if (!workflow) throw new AppError('Workflow was not found.', 404, 'WORKFLOW_NOT_FOUND');
    return workflow;
  }

  create(draft: WorkflowDraft) {
    return this.repository.create(draft);
  }

  async update(id: string, draft: WorkflowDraft) {
    await this.get(id);
    return this.repository.update(id, draft);
  }

  async delete(id: string) {
    await this.get(id);
    await this.repository.delete(id);
  }

  async setFavorite(id: string, isFavorite: boolean) {
    await this.get(id);
    return this.repository.setFavorite(id, isFavorite);
  }

  async setEnabled(id: string, isEnabled: boolean) {
    await this.get(id);
    return this.repository.setEnabled(id, isEnabled);
  }
}
