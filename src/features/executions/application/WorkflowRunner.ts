import { AppError } from '../../../shared/errors/AppError.js';
import type { WorkflowDefinition, WorkflowNode } from '../../workflows/domain/workflow.types.js';
import type {
  NodeExecutor,
  NodeOutput,
  RunnerCallbacks,
  RunnerResult,
} from '../domain/execution.types.js';

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
  ): Promise<RunnerResult> {
    const outputs: Record<string, NodeOutput> = {};
    for (const node of executionOrder(workflow)) {
      const executor = this.executors.get(node.kind);
      if (!executor)
        throw new AppError(`No executor exists for ${node.kind}.`, 422, 'EXECUTOR_NOT_FOUND');
      const sourceIds = workflow.edges
        .filter((edge) => edge.target === node.id)
        .map((edge) => edge.source);
      const input = sourceIds.flatMap((id) => (outputs[id] ? [outputs[id]] : []));
      try {
        const output = await executor.execute(node, { allOutputs: outputs, input, signal });
        outputs[node.id] = output;
        await callbacks.onStepSucceeded(node, input, output);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Node execution failed.';
        await callbacks.onStepFailed(node, input, message);
        throw error;
      }
    }
    const briefing =
      Object.values(outputs).find((output) => output.briefing)?.briefing ??
      'Workflow completed successfully.';
    return { workflow, outputs, briefing };
  }
}
