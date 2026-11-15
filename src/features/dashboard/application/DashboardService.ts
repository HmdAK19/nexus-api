import type { DashboardRepository } from '../domain/dashboard.repository.js';

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}
  get() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    return this.repository.getSummary(since);
  }
}
