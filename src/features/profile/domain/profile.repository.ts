import type { WorkspaceProfile, WorkspaceProfileDraft } from './profile.types.js';

export interface ProfileRepository {
  getOrCreate: () => Promise<WorkspaceProfile>;
  update: (draft: WorkspaceProfileDraft) => Promise<WorkspaceProfile>;
}
