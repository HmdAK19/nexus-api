import { AppError } from '../../../shared/errors/AppError.js';
import type { WorkflowRepository } from '../../workflows/domain/workflow.repository.js';
import type { RunRepository } from '../domain/run.repository.js';
import type { WorkflowRunner } from './WorkflowRunner.js';
import type { ActivityQuery } from '../domain/activity.schema.js';

export class ExecutionService {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly runs: RunRepository,
    private readonly runner: WorkflowRunner,
  ) {}

  async execute(workflowId: string, signal: AbortSignal) {
    const workflow = await this.workflows.findById(workflowId);
    if (!workflow) throw new AppError('Workflow was not found.', 404, 'WORKFLOW_NOT_FOUND');
    const run = await this.runs.create(workflowId);
    try {
      const result = await this.runner.run(
        workflow,
        {
          onStepSucceeded: (node, input, output) =>
            this.runs.recordSuccessfulStep(run.id, node, input, output),
          onStepFailed: (node, input, error) =>
            this.runs.recordFailedStep(run.id, node, input, error),
          onStepSkipped: (node, reason) => this.runs.recordSkippedStep(run.id, node, reason),
        },
        signal,
        run.id,
      );
      return this.runs.complete(run.id, { briefing: result.briefing, outputs: result.outputs });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workflow execution failed.';
      await this.runs.fail(run.id, message);
      throw new AppError(message, 422, 'WORKFLOW_EXECUTION_FAILED');
    }
  }

  async getRun(runId: string) {
    const run = await this.runs.findById(runId);
    if (!run) throw new AppError('Workflow run was not found.', 404, 'RUN_NOT_FOUND');
    return run;
  }

  listRuns(workflowId: string) {
    return this.runs.listByWorkflow(workflowId);
  }

  listActivity(query: ActivityQuery) {
    return this.runs.listActivity(
      query.status,
      query.limit,
      query.cursor,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
      query.q,
      query.order,
    );
  }

  async deleteRun(workflowId: string, runId: string) {
    const run = await this.getRun(runId);
    if (run.workflowId !== workflowId) {
      throw new AppError('Workflow run was not found.', 404, 'RUN_NOT_FOUND');
    }
    if (run.status === 'running') {
      throw new AppError('A running workflow cannot be deleted.', 409, 'RUN_IN_PROGRESS');
    }
    await this.runs.delete(runId);
  }
}
