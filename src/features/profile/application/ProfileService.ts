import type { ProfileRepository } from '../domain/profile.repository.js';
import type { WorkspaceProfileDraft } from '../domain/profile.types.js';

export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  get() {
    return this.repository.getOrCreate();
  }

  async update(draft: WorkspaceProfileDraft) {
    await this.repository.getOrCreate();
    return this.repository.update(draft);
  }
}
