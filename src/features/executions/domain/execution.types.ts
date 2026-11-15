import type { WorkflowDefinition, WorkflowNode } from '../../workflows/domain/workflow.types.js';

export type RunStatus = 'running' | 'succeeded' | 'failed';
export type StepStatus = RunStatus | 'skipped';

export interface NodeOutput extends Record<string, unknown> {
  delay?: { durationMs: number; completedAt: string };
  error?: { message: string; attempts: number; nodeId: string };
  http?: {
    body: unknown;
    durationMs: number;
    headers: Record<string, string>;
    status: number;
    url: string;
  };
  condition?: { actual: unknown; matched: boolean };
  briefing?: string;
  plan?: string[];
  planning?: {
    estimatedMinutesSaved: number;
    provider: 'openai' | 'rules';
    summary: string;
  };
  notification?: {
    channel: 'inApp' | 'webhook';
    delivered: boolean;
    destination: string;
  };
  schedule?: { mode: 'manual' | 'scheduled'; startedAt: string };
  startedAt?: string;
  weather?: {
    condition: string;
    isLive: boolean;
    temperature: number | null;
    unit: 'celsius' | 'fahrenheit';
    weatherCode: number | null;
    warning?: string;
  };
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  result: Record<string, unknown> | null;
  steps: WorkflowRunStep[];
}

export type ActivityStatus = 'all' | RunStatus;

export interface ActivityRun extends WorkflowRun {
  workflowName: string;
}

export interface ActivityPage {
  items: ActivityRun[];
  nextCursor: string | null;
}

export interface WorkflowRunStep {
  id: string;
  nodeId: string;
  kind: string;
  status: StepStatus;
  startedAt: Date;
  completedAt: Date | null;
  input: unknown;
  output: unknown;
  error: string | null;
}

export interface ExecutorContext {
  allOutputs: Readonly<Record<string, NodeOutput>>;
  input: ReadonlyArray<NodeOutput>;
  runId: string;
  signal: AbortSignal;
  workflowId: string;
}

export interface NodeExecutor {
  kind: WorkflowNode['kind'];
  execute: (node: WorkflowNode, context: ExecutorContext) => Promise<NodeOutput>;
}

export interface RunnerCallbacks {
  onStepFailed: (node: WorkflowNode, input: NodeOutput[], error: string) => Promise<void>;
  onStepSucceeded: (node: WorkflowNode, input: NodeOutput[], output: NodeOutput) => Promise<void>;
  onStepSkipped: (node: WorkflowNode, reason: string) => Promise<void>;
}

export interface RunnerResult {
  briefing: string;
  outputs: Record<string, NodeOutput>;
  workflow: WorkflowDefinition;
}
