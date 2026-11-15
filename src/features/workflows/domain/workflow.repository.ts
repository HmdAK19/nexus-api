import type { WorkflowDefinition, WorkflowDraft } from './workflow.types.js';

export interface WorkflowRepository {
  create: (draft: WorkflowDraft) => Promise<WorkflowDefinition>;
  delete: (id: string) => Promise<void>;
  findAll: () => Promise<WorkflowDefinition[]>;
  findById: (id: string) => Promise<WorkflowDefinition | null>;
  update: (id: string, draft: WorkflowDraft) => Promise<WorkflowDefinition>;
  setFavorite: (id: string, isFavorite: boolean) => Promise<WorkflowDefinition>;
  setEnabled: (id: string, isEnabled: boolean) => Promise<WorkflowDefinition>;
}
