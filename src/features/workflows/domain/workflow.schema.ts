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
  retryAttempts: z.number().int().min(0).max(5).default(0),
  retryDelayMs: z.number().int().min(100).max(30_000).default(1_000),
});

const httpHeadersSchema = z
  .record(
    z
      .string()
      .trim()
      .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
    z.string().max(2_000),
  )
  .refine((headers) => Object.keys(headers).length <= 20, 'Use at most 20 HTTP headers.')
  .refine(
    (headers) =>
      Object.keys(headers).every(
        (name) =>
          !['authorization', 'cookie', 'host', 'proxy-authorization', 'x-api-key'].includes(
            name.toLowerCase(),
          ),
      ),
    'Secret and transport-controlled headers are not allowed.',
  );

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
  condition: sharedConfigSchema.extend({
    field: z.string().trim().min(1).max(160).default('weather.temperature'),
    operator: z
      .enum(['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'exists'])
      .default('greaterThan'),
    value: z.union([z.string(), z.number(), z.boolean()]).default(20),
  }),
  delay: sharedConfigSchema.extend({
    duration: z.number().int().min(1).max(86_400).default(5),
    unit: z.enum(['seconds', 'minutes', 'hours']).default('seconds'),
  }),
  http: sharedConfigSchema.extend({
    url: z.string().trim().min(1).max(2_000).startsWith('https://'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
    headers: httpHeadersSchema.default({}),
    body: z.string().max(20_000).default(''),
    timeoutMs: z.number().int().min(1_000).max(30_000).default(10_000),
  }),
  action: sharedConfigSchema.extend({
    channel: z.enum(['inApp', 'webhook']).default('inApp'),
    greeting: z.string().trim().min(1).max(200).default('Good morning.'),
    includeWeather: z.boolean().default(true),
    includePlan: z.boolean().default(true),
    webhookEndpointId: z.string().max(120).default(''),
  }),
} as const;

export const workflowDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(''),
    tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
    nodes: z.array(nodeSchema).max(200),
    edges: z.array(edgeSchema).max(500),
  })
  .superRefine((workflow, context) => {
    const nodeIds = new Set(workflow.nodes.map((node) => node.id));
    const nodeKinds = new Map(workflow.nodes.map((node) => [node.id, node.kind]));
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
      if (
        nodeKinds.get(edge.source) === 'condition' &&
        edge.sourceHandle !== 'true' &&
        edge.sourceHandle !== 'false' &&
        edge.sourceHandle !== 'error'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'sourceHandle'],
          message: 'Condition edges must use the true, false, or error output handle.',
        });
      }
      if (edge.sourceHandle === 'error' && nodeKinds.get(edge.source) === 'trigger') {
        context.addIssue({
          code: 'custom',
          path: ['edges', index, 'sourceHandle'],
          message: 'Trigger nodes cannot expose an error path.',
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
    const triggers = workflow.nodes
      .filter((node) => node.kind === 'trigger')
      .map((node) => node.id);
    if (!triggers.length) {
      context.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'A workflow requires a trigger.',
      });
    }
    if (!workflow.nodes.some((node) => node.kind === 'action')) {
      context.addIssue({
        code: 'custom',
        path: ['nodes'],
        message: 'A workflow requires an action.',
      });
    }
    const outgoing = new Map<string, string[]>();
    const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
    workflow.edges.forEach((edge) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target)
        return;
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    });
    const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
    let visited = 0;
    while (queue.length) {
      const id = queue.shift();
      if (!id) continue;
      visited += 1;
      for (const target of outgoing.get(id) ?? []) {
        const degree = (indegree.get(target) ?? 1) - 1;
        indegree.set(target, degree);
        if (degree === 0) queue.push(target);
      }
    }
    if (visited !== workflow.nodes.length) {
      context.addIssue({
        code: 'custom',
        path: ['edges'],
        message: 'Workflow connections must be acyclic.',
      });
    }
    const reachable = new Set<string>();
    const pending = [...triggers];
    while (pending.length) {
      const id = pending.shift();
      if (!id || reachable.has(id)) continue;
      reachable.add(id);
      pending.push(...(outgoing.get(id) ?? []));
    }
    if (triggers.length && workflow.nodes.some((node) => !reachable.has(node.id))) {
      context.addIssue({
        code: 'custom',
        path: ['edges'],
        message: 'Every node must be reachable from a trigger.',
      });
    }
  });

export type WorkflowDraftInput = z.infer<typeof workflowDraftSchema>;

export const workflowFavoriteSchema = z.object({ isFavorite: z.boolean() });
export const workflowEnabledSchema = z.object({ isEnabled: z.boolean() });
