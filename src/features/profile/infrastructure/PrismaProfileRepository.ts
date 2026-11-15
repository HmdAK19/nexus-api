import type { PrismaClient } from '@prisma/client';

import type { ProfileRepository } from '../domain/profile.repository.js';
import type { WorkspaceProfileDraft } from '../domain/profile.types.js';

const PROFILE_ID = 'default';

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly client: PrismaClient) {}

  getOrCreate() {
    return this.client.workspaceProfile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID },
      update: {},
    });
  }

  update(draft: WorkspaceProfileDraft) {
    return this.client.workspaceProfile.update({ where: { id: PROFILE_ID }, data: draft });
  }
}
