import type { PrismaClient } from '@prisma/client';

import type { DashboardRepository } from '../domain/dashboard.repository.js';

export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly database: PrismaClient) {}

  async getSummary(since: Date) {
    const [
      totalWorkflows,
      enabledWorkflows,
      runsLast30Days,
      succeededRuns,
      unreadMessages,
      recent,
    ] = await this.database.$transaction([
      this.database.workflow.count(),
      this.database.workflow.count({ where: { isEnabled: true } }),
      this.database.workflowRun.count({ where: { startedAt: { gte: since } } }),
      this.database.workflowRun.count({
        where: { startedAt: { gte: since }, status: 'succeeded' },
      }),
      this.database.inboxMessage.count({ where: { status: 'unread' } }),
      this.database.workflowRun.findMany({
        include: { workflow: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
        take: 5,
      }),
    ]);
    return {
      totalWorkflows,
      enabledWorkflows,
      runsLast30Days,
      successRate: runsLast30Days ? (succeededRuns / runsLast30Days) * 100 : 0,
      unreadMessages,
      recentRuns: recent.map((run) => ({
        id: run.id,
        workflowId: run.workflowId,
        workflowName: run.workflow.name,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      })),
    };
  }
}
