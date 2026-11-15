import type { Prisma, PrismaClient } from '@prisma/client';

import type { RunRepository } from '../domain/run.repository.js';
import type {
  ActivityPage,
  ActivityStatus,
  NodeOutput,
  RunStatus,
  StepStatus,
  WorkflowRun,
} from '../domain/execution.types.js';
import type { WorkflowNode } from '../../workflows/domain/workflow.types.js';

const runInclude = {
  steps: { orderBy: { startedAt: 'asc' as const } },
} satisfies Prisma.WorkflowRunInclude;
type RunRecord = Prisma.WorkflowRunGetPayload<{ include: typeof runInclude }>;

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function mapRun(record: RunRecord): WorkflowRun {
  return {
    id: record.id,
    workflowId: record.workflowId,
    status: record.status as RunStatus,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    error: record.error,
    result: parseJson(record.result) as Record<string, unknown> | null,
    steps: record.steps.map((step) => ({
      id: step.id,
      nodeId: step.nodeId,
      kind: step.kind,
      status: step.status as StepStatus,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      input: parseJson(step.input),
      output: parseJson(step.output),
      error: step.error,
    })),
  };
}

export class PrismaRunRepository implements RunRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(workflowId: string) {
    return mapRun(
      await this.client.workflowRun.create({
        data: { workflowId, status: 'running' },
        include: runInclude,
      }),
    );
  }

  async delete(runId: string) {
    await this.client.workflowRun.delete({ where: { id: runId } });
  }

  async complete(runId: string, result: Record<string, unknown>) {
    return mapRun(
      await this.client.workflowRun.update({
        where: { id: runId },
        data: { status: 'succeeded', completedAt: new Date(), result: JSON.stringify(result) },
        include: runInclude,
      }),
    );
  }

  async fail(runId: string, error: string) {
    return mapRun(
      await this.client.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date(), error },
        include: runInclude,
      }),
    );
  }

  async findById(runId: string) {
    const record = await this.client.workflowRun.findUnique({
      where: { id: runId },
      include: runInclude,
    });
    return record ? mapRun(record) : null;
  }

  async listByWorkflow(workflowId: string) {
    const records = await this.client.workflowRun.findMany({
      where: { workflowId },
      include: runInclude,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return records.map(mapRun);
  }

  async listActivity(
    status: ActivityStatus,
    limit: number,
    cursor?: string,
    from?: Date,
    to?: Date,
    query?: string,
    order: 'newest' | 'oldest' = 'newest',
  ): Promise<ActivityPage> {
    const records = await this.client.workflowRun.findMany({
      where: {
        ...(status === 'all' ? {} : { status }),
        ...(from || to
          ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(query ? { workflow: { name: { contains: query } } } : {}),
      },
      include: { ...runInclude, workflow: { select: { name: true } } },
      orderBy: [
        { startedAt: order === 'newest' ? 'desc' : 'asc' },
        { id: order === 'newest' ? 'desc' : 'asc' },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = records.length > limit;
    const items = records.slice(0, limit).map((record) => ({
      ...mapRun(record),
      workflowName: record.workflow.name,
    }));
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async recordSuccessfulStep(
    runId: string,
    node: WorkflowNode,
    input: NodeOutput[],
    output: NodeOutput,
  ) {
    await this.client.workflowRunStep.create({
      data: {
        runId,
        nodeId: node.id,
        kind: node.kind,
        status: 'succeeded',
        completedAt: new Date(),
        input: JSON.stringify(input),
        output: JSON.stringify(output),
      },
    });
  }

  async recordFailedStep(runId: string, node: WorkflowNode, input: NodeOutput[], error: string) {
    await this.client.workflowRunStep.create({
      data: {
        runId,
        nodeId: node.id,
        kind: node.kind,
        status: 'failed',
        completedAt: new Date(),
        input: JSON.stringify(input),
        error,
      },
    });
  }

  async recordSkippedStep(runId: string, node: WorkflowNode, reason: string) {
    await this.client.workflowRunStep.create({
      data: {
        runId,
        nodeId: node.id,
        kind: node.kind,
        status: 'skipped',
        completedAt: new Date(),
        error: reason,
      },
    });
  }
}
