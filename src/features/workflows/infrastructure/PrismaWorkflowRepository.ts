import type { Prisma, PrismaClient } from '@prisma/client';

import type { WorkflowRepository } from '../domain/workflow.repository.js';
import type {
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowNodeKind,
} from '../domain/workflow.types.js';

const workflowInclude = { nodes: true, edges: true } satisfies Prisma.WorkflowInclude;
type WorkflowRecord = Prisma.WorkflowGetPayload<{ include: typeof workflowInclude }>;

function parseConfig(config: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(config);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseTags(tags: string): string[] {
  try {
    const value: unknown = JSON.parse(tags);
    return Array.isArray(value)
      ? value.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

function mapWorkflow(record: WorkflowRecord): WorkflowDefinition {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    version: record.version,
    isFavorite: record.isFavorite,
    isEnabled: record.isEnabled,
    tags: parseTags(record.tags),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    nodes: record.nodes.map((node) => ({
      id: node.id,
      kind: node.kind as WorkflowNodeKind,
      title: node.title,
      description: node.description,
      meta: node.meta,
      position: { x: node.positionX, y: node.positionY },
      config: parseConfig(node.config),
    })),
    edges: record.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
  };
}

function nestedGraph(draft: WorkflowDraft) {
  return {
    nodes: {
      create: draft.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        description: node.description,
        meta: node.meta,
        positionX: node.position.x,
        positionY: node.position.y,
        config: JSON.stringify(node.config),
      })),
    },
    edges: {
      create: draft.edges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
    },
  };
}

export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(draft: WorkflowDraft) {
    return mapWorkflow(
      await this.client.workflow.create({
        data: {
          name: draft.name,
          description: draft.description,
          tags: JSON.stringify(draft.tags),
          ...nestedGraph(draft),
        },
        include: workflowInclude,
      }),
    );
  }

  async findAll() {
    const records = await this.client.workflow.findMany({
      include: workflowInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return records.map(mapWorkflow);
  }

  async findById(id: string) {
    const record = await this.client.workflow.findUnique({
      where: { id },
      include: workflowInclude,
    });
    return record ? mapWorkflow(record) : null;
  }

  async update(id: string, draft: WorkflowDraft) {
    return this.client.$transaction(async (transaction) => {
      await transaction.workflowEdge.deleteMany({ where: { workflowId: id } });
      await transaction.workflowNode.deleteMany({ where: { workflowId: id } });
      const record = await transaction.workflow.update({
        where: { id },
        data: {
          name: draft.name,
          description: draft.description,
          tags: JSON.stringify(draft.tags),
          version: { increment: 1 },
          ...nestedGraph(draft),
        },
        include: workflowInclude,
      });
      return mapWorkflow(record);
    });
  }

  async delete(id: string) {
    await this.client.workflow.delete({ where: { id } });
  }

  async setFavorite(id: string, isFavorite: boolean) {
    return mapWorkflow(
      await this.client.workflow.update({
        where: { id },
        data: { isFavorite },
        include: workflowInclude,
      }),
    );
  }

  async setEnabled(id: string, isEnabled: boolean) {
    return mapWorkflow(
      await this.client.workflow.update({
        where: { id },
        data: { isEnabled },
        include: workflowInclude,
      }),
    );
  }
}
