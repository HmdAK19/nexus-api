import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { prisma } from './shared/database/prisma.js';

const workflowDraft = {
  name: 'Morning intelligence',
  description: 'Build a useful morning briefing.',
  nodes: [
    {
      id: 'trigger',
      kind: 'trigger',
      title: 'Daily trigger',
      description: 'Start now',
      meta: 'NOW',
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: 'weather',
      kind: 'context',
      title: 'Weather',
      description: 'Live weather',
      meta: 'LIVE',
      position: { x: 240, y: 0 },
      config: { latitude: 35.6892, longitude: 51.389 },
    },
    {
      id: 'planner',
      kind: 'intelligence',
      title: 'Planner',
      description: 'Build the plan',
      meta: 'AI',
      position: { x: 480, y: 0 },
      config: {
        goal: 'Ship the Nexus workflow editor',
        priorities: ['Finish API integration', 'Review the UX'],
        focusMinutes: 45,
        breakMinutes: 10,
        planLength: 5,
        tone: 'direct',
      },
    },
    {
      id: 'briefing',
      kind: 'action',
      title: 'Briefing',
      description: 'Create briefing',
      meta: 'DONE',
      position: { x: 720, y: 0 },
      config: {
        channel: 'inApp',
        greeting: 'Your focused day is ready.',
        includeWeather: true,
        includePlan: true,
        webhookUrl: '',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger', target: 'weather' },
    { id: 'e2', source: 'weather', target: 'planner' },
    { id: 'e3', source: 'planner', target: 'briefing' },
  ],
};

describe('Nexus API', () => {
  const app = createApp();

  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.workflowRunStep.deleteMany();
    await prisma.workflowRun.deleteMany();
    await prisma.workflowEdge.deleteMany();
    await prisma.workflowNode.deleteMany();
    await prisma.workflow.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports service health', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('validates malformed workflows', async () => {
    const response = await request(app)
      .post('/api/v1/workflows')
      .send({ name: '', nodes: [], edges: [] })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates, executes, and persists a workflow run', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ current: { temperature_2m: 19.4, weather_code: 1 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const createResponse = await request(app)
      .post('/api/v1/workflows')
      .send(workflowDraft)
      .expect(201);
    const workflowId = createResponse.body.data.id as string;

    const runResponse = await request(app).post(`/api/v1/workflows/${workflowId}/runs`).expect(201);

    expect(runResponse.body.data.status).toBe('succeeded');
    expect(runResponse.body.data.steps).toHaveLength(4);
    expect(runResponse.body.data.result.briefing).toContain('19°C');
    expect(runResponse.body.data.result.outputs.planner.plan).toHaveLength(5);
    expect(runResponse.body.data.result.outputs.planner.planning.provider).toBe('rules');
    expect(runResponse.body.data.result.outputs.briefing.notification).toMatchObject({
      delivered: true,
      channel: 'inApp',
    });

    const historyResponse = await request(app)
      .get(`/api/v1/workflows/${workflowId}/runs`)
      .expect(200);
    expect(historyResponse.body.data).toHaveLength(1);
    expect(historyResponse.body.data[0].steps).toHaveLength(4);
  });
});
