import type { WorkflowRepository } from '../../workflows/domain/workflow.repository.js';
import type { WorkflowDefinition } from '../../workflows/domain/workflow.types.js';
import type { ExecutionService } from './ExecutionService.js';

const weekdayMap: Record<string, string> = {
  Sun: 'sun',
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
};

function scheduleKey(workflow: WorkflowDefinition, now: Date) {
  const trigger = workflow.nodes.find((node) => node.kind === 'trigger');
  if (!trigger || trigger.config.scheduleEnabled !== true) return null;
  const timezone =
    typeof trigger.config.timezone === 'string' ? trigger.config.timezone : 'Asia/Tehran';
  const scheduleTime =
    typeof trigger.config.scheduleTime === 'string' ? trigger.config.scheduleTime : '07:00';
  const scheduleDays = Array.isArray(trigger.config.scheduleDays)
    ? trigger.config.scheduleDays
    : [];
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
    const weekday = weekdayMap[parts.weekday ?? ''];
    if (`${parts.hour}:${parts.minute}` !== scheduleTime) return null;
    if (scheduleDays.length > 0 && !scheduleDays.includes(weekday)) return null;
    return `${workflow.id}:${parts.year}-${parts.month}-${parts.day}:${scheduleTime}`;
  } catch {
    return null;
  }
}

export class WorkflowScheduler {
  private interval: NodeJS.Timeout | null = null;
  private readonly dispatched = new Set<string>();
  private ticking = false;

  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly executions: ExecutionService,
    private readonly intervalMs: number,
  ) {}

  start() {
    if (this.interval) return;
    void this.tick();
    this.interval = setInterval(() => void this.tick(), this.intervalMs);
    this.interval.unref();
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async tick(now = new Date()) {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const workflows = await this.workflows.findAll();
      for (const workflow of workflows) {
        if (!workflow.isEnabled) continue;
        const key = scheduleKey(workflow, now);
        if (!key || this.dispatched.has(key)) continue;
        const latest = (await this.executions.listRuns(workflow.id))[0];
        if (latest && now.getTime() - latest.startedAt.getTime() < 60_000) {
          this.dispatched.add(key);
          continue;
        }
        this.dispatched.add(key);
        void this.executions.execute(workflow.id, new AbortController().signal).catch((error) => {
          console.error(`Scheduled workflow ${workflow.id} failed.`, error);
        });
      }
    } finally {
      this.ticking = false;
    }
  }
}
