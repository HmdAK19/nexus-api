import { AppError } from '../../../shared/errors/AppError.js';
import type { WorkflowDefinition, WorkflowNode } from '../../workflows/domain/workflow.types.js';
import type {
  NodeExecutor,
  NodeOutput,
  RunnerCallbacks,
  RunnerResult,
} from '../domain/execution.types.js';
import { validateNodeOutput } from '../domain/node.contracts.js';

function numericConfig(node: WorkflowNode, key: string, fallback: number) {
  const value = node.config[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function wait(durationMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(
        signal.reason instanceof Error ? signal.reason : new Error('Execution was cancelled.'),
      );
      return;
    }
    const timer = setTimeout(resolve, durationMs);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(
          signal.reason instanceof Error ? signal.reason : new Error('Execution was cancelled.'),
        );
      },
      { once: true },
    );
  });
}

function executionOrder(workflow: WorkflowDefinition): WorkflowNode[] {
  if (workflow.nodes.length === 0)
    throw new AppError('Workflow has no nodes.', 422, 'EMPTY_WORKFLOW');
  const nodes = new Map(workflow.nodes.map((node) => [node.id, node]));
  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(workflow.nodes.map((node) => [node.id, [] as string[]]));
  workflow.edges.forEach((edge) => {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  });
  const queue = workflow.nodes.filter((node) => indegree.get(node.id) === 0);
  const ordered: WorkflowNode[] = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    ordered.push(node);
    outgoing.get(node.id)?.forEach((targetId) => {
      const value = (indegree.get(targetId) ?? 1) - 1;
      indegree.set(targetId, value);
      const target = nodes.get(targetId);
      if (value === 0 && target) queue.push(target);
    });
  }
  if (ordered.length !== workflow.nodes.length)
    throw new AppError('Workflow contains a cycle.', 422, 'WORKFLOW_CYCLE');
  return ordered;
}

export class WorkflowRunner {
  private readonly executors: ReadonlyMap<string, NodeExecutor>;
  constructor(executors: NodeExecutor[]) {
    this.executors = new Map(executors.map((executor) => [executor.kind, executor]));
  }

  async run(
    workflow: WorkflowDefinition,
    callbacks: RunnerCallbacks,
    signal: AbortSignal,
    runId: string,
  ): Promise<RunnerResult> {
    const outputs: Record<string, NodeOutput> = {};
    for (const node of executionOrder(workflow)) {
      const executor = this.executors.get(node.kind);
      if (!executor)
        throw new AppError(`No executor exists for ${node.kind}.`, 422, 'EXECUTOR_NOT_FOUND');
      const incomingEdges = workflow.edges.filter((edge) => edge.target === node.id);
      const activeEdges = incomingEdges.filter((edge) => {
        const sourceOutput = outputs[edge.source];
        if (!sourceOutput) return false;
        if (sourceOutput.error) return edge.sourceHandle === 'error';
        if (edge.sourceHandle === 'error') return false;
        if (sourceOutput.condition && ['true', 'false'].includes(edge.sourceHandle ?? ''))
          return (edge.sourceHandle === 'true') === sourceOutput.condition.matched;
        return true;
      });
      if (incomingEdges.length > 0 && activeEdges.length === 0) {
        await callbacks.onStepSkipped(node, 'No active incoming branch.');
        continue;
      }
      const input = activeEdges
        .map((edge) => outputs[edge.source])
        .filter((output): output is NodeOutput => output !== undefined);
      try {
        const retryAttempts = numericConfig(node, 'retryAttempts', 0);
        const retryDelayMs = numericConfig(node, 'retryDelayMs', 1_000);
        let attempts = 0;
        let rawOutput: NodeOutput | undefined;
        let lastError: unknown;
        while (attempts <= retryAttempts) {
          attempts += 1;
          try {
            rawOutput = await executor.execute(node, {
              allOutputs: outputs,
              input,
              runId,
              signal,
              workflowId: workflow.id,
            });
            break;
          } catch (error) {
            lastError = error;
            if (attempts > retryAttempts || signal.aborted) break;
            await wait(Math.min(30_000, retryDelayMs * 2 ** (attempts - 1)), signal);
          }
        }
        if (!rawOutput) throw lastError;
        const output = validateNodeOutput(node.kind, rawOutput);
        outputs[node.id] = output;
        await callbacks.onStepSucceeded(node, input, output);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Node execution failed.';
        await callbacks.onStepFailed(node, input, message);
        const errorEdgeExists = workflow.edges.some(
          (edge) => edge.source === node.id && edge.sourceHandle === 'error',
        );
        if (!errorEdgeExists) throw error;
        outputs[node.id] = {
          error: {
            attempts: numericConfig(node, 'retryAttempts', 0) + 1,
            message,
            nodeId: node.id,
          },
        };
      }
    }
    const briefing =
      Object.values(outputs).find((output) => output.briefing)?.briefing ??
      'Workflow completed successfully.';
    return { workflow, outputs, briefing };
  }
}
