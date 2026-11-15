import { z } from 'zod';

import { AppError } from '../../../shared/errors/AppError.js';
import type { WorkflowNodeKind } from '../../workflows/domain/workflow.types.js';
import type { NodeOutput } from './execution.types.js';

const triggerOutputSchema = z.object({
  startedAt: z.iso.datetime(),
  schedule: z.object({ mode: z.enum(['manual', 'scheduled']), startedAt: z.iso.datetime() }),
});

const weatherOutputSchema = z.object({
  weather: z.object({
    condition: z.string(),
    isLive: z.boolean(),
    temperature: z.number().nullable(),
    unit: z.enum(['celsius', 'fahrenheit']),
    weatherCode: z.number().nullable(),
    warning: z.string().optional(),
  }),
});

const plannerOutputSchema = z.object({
  plan: z.array(z.string()),
  planning: z.object({
    estimatedMinutesSaved: z.number().nonnegative(),
    provider: z.enum(['openai', 'rules']),
    summary: z.string(),
  }),
});

const actionOutputSchema = z.object({
  briefing: z.string(),
  notification: z.object({
    channel: z.enum(['inApp', 'webhook']),
    delivered: z.boolean(),
    destination: z.string(),
  }),
});

const conditionOutputSchema = z.object({
  condition: z.object({ matched: z.boolean(), actual: z.unknown() }),
});

const delayOutputSchema = z.object({
  delay: z.object({ durationMs: z.number().int().positive(), completedAt: z.iso.datetime() }),
});

const httpOutputSchema = z.object({
  http: z.object({
    body: z.unknown(),
    durationMs: z.number().nonnegative(),
    headers: z.record(z.string(), z.string()),
    status: z.number().int().min(100).max(599),
    url: z.url(),
  }),
});

export const nodeOutputSchemas = {
  trigger: triggerOutputSchema,
  context: weatherOutputSchema,
  intelligence: plannerOutputSchema,
  condition: conditionOutputSchema,
  delay: delayOutputSchema,
  http: httpOutputSchema,
  action: actionOutputSchema,
} satisfies Record<WorkflowNodeKind, z.ZodType>;

export function validateNodeOutput(kind: WorkflowNodeKind, output: unknown): NodeOutput {
  const result = nodeOutputSchemas[kind].safeParse(output);
  if (!result.success) {
    throw new AppError(
      `The ${kind} node returned an invalid output.`,
      422,
      'INVALID_NODE_OUTPUT',
      result.error.flatten(),
    );
  }
  return result.data;
}
