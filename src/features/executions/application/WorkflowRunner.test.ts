import { describe, expect, it, vi } from 'vitest';

import type { WorkflowDefinition } from '../../workflows/domain/workflow.types.js';
import type { NodeExecutor } from '../domain/execution.types.js';
import { ConditionExecutor, TriggerExecutor } from './nodeExecutors.js';
import { WorkflowRunner } from './WorkflowRunner.js';

const actionExecutor: NodeExecutor = {
  kind: 'action',
  execute: async (node) => ({
    briefing: node.title,
    notification: { channel: 'inApp', delivered: true, destination: 'test' },
  }),
};

describe('WorkflowRunner branching', () => {
  it('executes only the matching branch and records the other as skipped', async () => {
    const workflow: WorkflowDefinition = {
      id: 'workflow',
      name: 'Branching',
      description: '',
      version: 1,
      tags: [],
      isFavorite: false,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: [
        {
          id: 'trigger',
          kind: 'trigger',
          title: 'Trigger',
          description: '',
          meta: '',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'condition',
          kind: 'condition',
          title: 'Condition',
          description: '',
          meta: '',
          position: { x: 1, y: 0 },
          config: { field: 'schedule.mode', operator: 'equals', value: 'manual' },
        },
        {
          id: 'yes',
          kind: 'action',
          title: 'Yes',
          description: '',
          meta: '',
          position: { x: 2, y: 0 },
          config: {},
        },
        {
          id: 'no',
          kind: 'action',
          title: 'No',
          description: '',
          meta: '',
          position: { x: 2, y: 1 },
          config: {},
        },
      ],
      edges: [
        { id: 'a', source: 'trigger', target: 'condition' },
        { id: 'b', source: 'condition', target: 'yes', sourceHandle: 'true' },
        { id: 'c', source: 'condition', target: 'no', sourceHandle: 'false' },
      ],
    };
    const onStepSkipped = vi.fn(async () => undefined);
    const runner = new WorkflowRunner([
      new TriggerExecutor(),
      new ConditionExecutor(),
      actionExecutor,
    ]);
    const result = await runner.run(
      workflow,
      {
        onStepSucceeded: vi.fn(async () => undefined),
        onStepFailed: vi.fn(async () => undefined),
        onStepSkipped,
      },
      new AbortController().signal,
      'run',
    );
    expect(result.outputs.yes?.briefing).toBe('Yes');
    expect(result.outputs.no).toBeUndefined();
    expect(onStepSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'no' }),
      'No active incoming branch.',
    );
  });

  it('retries a failed node with exponential backoff before succeeding', async () => {
    const execute = vi
      .fn<NodeExecutor['execute']>()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValue({
        weather: {
          condition: 'Clear sky',
          isLive: true,
          temperature: 20,
          unit: 'celsius',
          weatherCode: 0,
        },
      });
    const workflow: WorkflowDefinition = {
      id: 'retry-workflow',
      name: 'Retry',
      description: '',
      version: 1,
      tags: [],
      isFavorite: false,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: [
        {
          id: 'trigger',
          kind: 'trigger',
          title: 'Trigger',
          description: '',
          meta: '',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'context',
          kind: 'context',
          title: 'Context',
          description: '',
          meta: '',
          position: { x: 1, y: 0 },
          config: { retryAttempts: 1, retryDelayMs: 1 },
        },
        {
          id: 'action',
          kind: 'action',
          title: 'Done',
          description: '',
          meta: '',
          position: { x: 2, y: 0 },
          config: {},
        },
      ],
      edges: [
        { id: 'a', source: 'trigger', target: 'context' },
        { id: 'b', source: 'context', target: 'action' },
      ],
    };
    const callbacks = {
      onStepSucceeded: vi.fn(async () => undefined),
      onStepFailed: vi.fn(async () => undefined),
      onStepSkipped: vi.fn(async () => undefined),
    };
    const runner = new WorkflowRunner([
      new TriggerExecutor(),
      { kind: 'context', execute },
      actionExecutor,
    ]);

    await runner.run(workflow, callbacks, new AbortController().signal, 'run');

    expect(execute).toHaveBeenCalledTimes(2);
    expect(callbacks.onStepFailed).not.toHaveBeenCalled();
  });

  it('routes an exhausted failure through the error output', async () => {
    const failingExecutor: NodeExecutor = {
      kind: 'context',
      execute: async () => {
        throw new Error('Provider unavailable');
      },
    };
    const workflow: WorkflowDefinition = {
      id: 'error-workflow',
      name: 'Error recovery',
      description: '',
      version: 1,
      tags: [],
      isFavorite: false,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: [
        {
          id: 'trigger',
          kind: 'trigger',
          title: 'Trigger',
          description: '',
          meta: '',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'context',
          kind: 'context',
          title: 'Context',
          description: '',
          meta: '',
          position: { x: 1, y: 0 },
          config: {},
        },
        {
          id: 'recovery',
          kind: 'action',
          title: 'Recovery',
          description: '',
          meta: '',
          position: { x: 2, y: 0 },
          config: {},
        },
      ],
      edges: [
        { id: 'a', source: 'trigger', target: 'context' },
        { id: 'b', source: 'context', target: 'recovery', sourceHandle: 'error' },
      ],
    };
    const callbacks = {
      onStepSucceeded: vi.fn(async () => undefined),
      onStepFailed: vi.fn(async () => undefined),
      onStepSkipped: vi.fn(async () => undefined),
    };
    const runner = new WorkflowRunner([new TriggerExecutor(), failingExecutor, actionExecutor]);

    const result = await runner.run(workflow, callbacks, new AbortController().signal, 'run');

    expect(result.outputs.context?.error).toEqual({
      attempts: 1,
      message: 'Provider unavailable',
      nodeId: 'context',
    });
    expect(result.outputs.recovery?.briefing).toBe('Recovery');
    expect(callbacks.onStepFailed).toHaveBeenCalledOnce();
  });
});
