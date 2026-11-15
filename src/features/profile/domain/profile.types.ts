export interface WorkspaceProfile {
  createdAt: Date;
  displayName: string;
  id: string;
  initials: string;
  timezone: string;
  updatedAt: Date;
}

export type WorkspaceProfileDraft = Pick<WorkspaceProfile, 'displayName' | 'initials' | 'timezone'>;
