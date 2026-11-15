export const workflowNodeKinds = [
  'trigger',
  'context',
  'intelligence',
  'condition',
  'delay',
  'http',
  'action',
] as const;
export type WorkflowNodeKind = (typeof workflowNodeKinds)[number];

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  description: string;
  meta: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  isFavorite: boolean;
  isEnabled: boolean;
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: Date;
  updatedAt: Date;
}

export type WorkflowDraft = Pick<
  WorkflowDefinition,
  'name' | 'description' | 'tags' | 'nodes' | 'edges'
>;
