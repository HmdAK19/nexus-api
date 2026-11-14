import type { NodeOutput, WorkflowRun } from './execution.types.js';
import type { WorkflowNode } from '../../workflows/domain/workflow.types.js';

export interface RunRepository {
  complete: (runId: string, result: Record<string, unknown>) => Promise<WorkflowRun>;
  create: (workflowId: string) => Promise<WorkflowRun>;
  fail: (runId: string, error: string) => Promise<WorkflowRun>;
  findById: (runId: string) => Promise<WorkflowRun | null>;
  listByWorkflow: (workflowId: string) => Promise<WorkflowRun[]>;
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
}
