import type { ActivityPage, ActivityStatus, NodeOutput, WorkflowRun } from './execution.types.js';
import type { WorkflowNode } from '../../workflows/domain/workflow.types.js';

export interface RunRepository {
  complete: (runId: string, result: Record<string, unknown>) => Promise<WorkflowRun>;
  create: (workflowId: string) => Promise<WorkflowRun>;
  delete: (runId: string) => Promise<void>;
  fail: (runId: string, error: string) => Promise<WorkflowRun>;
  findById: (runId: string) => Promise<WorkflowRun | null>;
  listByWorkflow: (workflowId: string) => Promise<WorkflowRun[]>;
  listActivity: (
    status: ActivityStatus,
    limit: number,
    cursor?: string,
    from?: Date,
    to?: Date,
    query?: string,
    order?: 'newest' | 'oldest',
  ) => Promise<ActivityPage>;
  recordFailedStep: (
    runId: string,
    node: WorkflowNode,
    input: NodeOutput[],
    error: string,
  ) => Promise<void>;
  recordSuccessfulStep: (
    runId: string,
    node: WorkflowNode,
    input: NodeOutput[],
    output: NodeOutput,
  ) => Promise<void>;
  recordSkippedStep: (runId: string, node: WorkflowNode, reason: string) => Promise<void>;
}
