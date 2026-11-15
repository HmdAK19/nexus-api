import type { PrismaClient } from '@prisma/client';

export class PrismaWorkspaceExportRepository {
  constructor(private readonly client: PrismaClient) {}

  async export() {
    const [profile, workflows, inbox] = await this.client.$transaction([
      this.client.workspaceProfile.findUnique({ where: { id: 'default' } }),
      this.client.workflow.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          nodes: true,
          edges: true,
          runs: { orderBy: { startedAt: 'asc' }, include: { steps: true } },
        },
      }),
      this.client.inboxMessage.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      format: 'nexus.workspace',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      workflows,
      inbox,
    } as const;
  }
}
