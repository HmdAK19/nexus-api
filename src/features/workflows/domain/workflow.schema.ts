import { z } from 'zod';

import { workflowNodeKinds } from './workflow.types.js';

const nodeSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(workflowNodeKinds),
  title: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  meta: z.string().max(20).default(''),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  config: z.record(z.string(), z.unknown()).default({}),
});

const edgeSchema = z.object({
  id: z.string().min(1).max(120),
  source: z.string().min(1).max(120),
  target: z.string().min(1).max(120),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

const sharedConfigSchema = z.object({
  accent: z.string().optional(),
  customTitle: z.string().max(120).optional(),
  titleKey: z.string().optional(),
});

const configSchemas = {
  trigger: sharedConfigSchema.extend({
    scheduleEnabled: z.boolean().default(false),
    scheduleTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default('07:00'),
    scheduleDays: z.array(z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])).default([]),
    timezone: z.string().min(1).max(80).default('Asia/Tehran'),
  }),
  context: sharedConfigSchema.extend({
    city: z.string().trim().min(1).max(80).default('Tehran'),
    latitude: z.number().min(-90).max(90).default(35.6892),
    longitude: z.number().min(-180).max(180).default(51.389),
    temperatureUnit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  intelligence: sharedConfigSchema.extend({
    goal: z.string().trim().min(1).max(300).default('Make meaningful progress today'),
    priorities: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
    focusMinutes: z.number().int().min(15).max(120).default(50),
    breakMinutes: z.number().int().min(5).max(30).default(10),
    planLength: z.number().int().min(2).max(8).default(4),
    tone: z.enum(['calm', 'direct', 'energizing']).default('calm'),
  }),
  action: sharedConfigSchema.extend({
    channel: z.enum(['inApp', 'webhook']).default('inApp'),
    greeting: z.string().trim().min(1).max(200).default('Good morning.'),
    includeWeather: z.boolean().default(true),
    includePlan: z.boolean().default(true),
    webhookUrl: z.union([z.literal(''), z.url().startsWith('https://')]).default(''),
  }),
} as const;

export const workflowDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(''),
    nodes: z.array(nodeSchema).max(200),
    edges: z.array(edgeSchema).max(500),
  })
  .superRefine((workflow, context) => {
    const nodeIds = new Set(workflow.nodes.map((node) => node.id));
    if (nodeIds.size !== workflow.nodes.length) {
      context.addIssue({ code: 'custom', path: ['nodes'], message: 'Node IDs must be unique.' });
    }
    workflow.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'Every edge must reference existing nodes.',
        });
      }
      if (edge.source === edge.target) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index],
          message: 'A node cannot connect to itself.',
        });
      }
    });
    workflow.nodes.forEach((node, index) => {
      const result = configSchemas[node.kind].safeParse(node.config);
      if (!result.success) {
        result.error.issues.forEach((issue) =>
          context.addIssue({
            code: 'custom',
            path: ['nodes', index, 'config', ...issue.path],
            message: issue.message,
          }),
        );
      }
    });
  });

export type WorkflowDraftInput = z.infer<typeof workflowDraftSchema>;
