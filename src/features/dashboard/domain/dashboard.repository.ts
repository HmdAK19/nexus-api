export interface DashboardRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
}

export interface DashboardSummary {
  totalWorkflows: number;
  enabledWorkflows: number;
  runsLast30Days: number;
  successRate: number;
  unreadMessages: number;
  recentRuns: DashboardRun[];
}

export interface DashboardRepository {
  getSummary: (since: Date) => Promise<DashboardSummary>;
}
