import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { prisma } from './shared/database/prisma.js';

const workflowDraft = {
  name: 'Morning intelligence',
  description: 'Build a useful morning briefing.',
  tags: ['morning', 'focus'],
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
    await prisma.inboxMessage.deleteMany();
    await prisma.workflowRunStep.deleteMany();
    await prisma.workflowRun.deleteMany();
    await prisma.workflowEdge.deleteMany();
    await prisma.workflowNode.deleteMany();
    await prisma.workflow.deleteMany();
    await prisma.workspaceProfile.deleteMany();
    await prisma.webhookEndpoint.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports service health', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('returns real dashboard aggregates', async () => {
    const response = await request(app).get('/api/v1/dashboard').expect(200);
    expect(response.body.data).toMatchObject({
      totalWorkflows: 0,
      enabledWorkflows: 0,
      runsLast30Days: 0,
      successRate: 0,
      unreadMessages: 0,
      recentRuns: [],
    });
  });

  it('exports a versioned workspace backup without webhook secrets', async () => {
    const response = await request(app).get('/api/v1/workspace/export').expect(200);
    expect(response.body.data).toMatchObject({
      format: 'nexus.workspace',
      version: 1,
      workflows: [],
      inbox: [],
    });
    expect(response.body.data).not.toHaveProperty('webhookEndpoints');
  });

  it('validates malformed workflows', async () => {
    const response = await request(app)
      .post('/api/v1/workflows')
      .send({ name: '', nodes: [], edges: [] })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects cyclic workflow graphs before persistence', async () => {
    await request(app)
      .post('/api/v1/workflows')
      .send({
        ...workflowDraft,
        edges: [...workflowDraft.edges, { id: 'cycle', source: 'briefing', target: 'weather' }],
      })
      .expect(422);
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

    const inboxResponse = await request(app).get('/api/v1/inbox').expect(200);
    expect(inboxResponse.body.data).toHaveLength(1);
    expect(inboxResponse.body.data[0]).toMatchObject({
      status: 'unread',
      title: 'Briefing',
      workflowId,
    });

    const messageId = inboxResponse.body.data[0].id as string;
    const searchedInbox = await request(app).get('/api/v1/inbox?q=Briefing').expect(200);
    expect(searchedInbox.body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/inbox?q=does-not-exist')).body.data).toHaveLength(0);
    const summaryResponse = await request(app).get('/api/v1/inbox/summary').expect(200);
    expect(summaryResponse.body.data.unreadCount).toBe(1);

    const bulkResponse = await request(app)
      .patch('/api/v1/inbox/bulk')
      .send({ ids: [messageId], action: 'read' })
      .expect(200);
    expect(bulkResponse.body.data.affected).toBe(1);
    expect((await request(app).get('/api/v1/inbox/summary')).body.data.unreadCount).toBe(0);

    await request(app).patch(`/api/v1/inbox/${messageId}`).send({ action: 'archive' }).expect(200);
    const archivedResponse = await request(app).get('/api/v1/inbox?filter=archived').expect(200);
    expect(archivedResponse.body.data).toHaveLength(1);

    const historyResponse = await request(app)
      .get(`/api/v1/workflows/${workflowId}/runs`)
      .expect(200);
    expect(historyResponse.body.data).toHaveLength(1);
    expect(historyResponse.body.data[0].steps).toHaveLength(4);

    const activityResponse = await request(app)
      .get('/api/v1/activity?status=succeeded&limit=10')
      .expect(200);
    expect(activityResponse.body.data).toMatchObject({ nextCursor: null });
    expect(activityResponse.body.data.items).toHaveLength(1);
    expect(activityResponse.body.data.items[0]).toMatchObject({
      workflowId,
      workflowName: workflowDraft.name,
      status: 'succeeded',
    });
    const futureActivity = await request(app)
      .get('/api/v1/activity?from=2099-01-01T00%3A00%3A00.000Z')
      .expect(200);
    expect(futureActivity.body.data.items).toHaveLength(0);
    expect(
      (await request(app).get('/api/v1/activity?q=Morning%20intelligence')).body.data.items,
    ).toHaveLength(1);
    expect((await request(app).get('/api/v1/activity?q=missing')).body.data.items).toHaveLength(0);

    await request(app)
      .delete(`/api/v1/workflows/${workflowId}/runs/${String(runResponse.body.data.id)}`)
      .expect(204);
    expect((await request(app).get(`/api/v1/workflows/${workflowId}/runs`)).body.data).toHaveLength(
      0,
    );
    expect((await request(app).get('/api/v1/inbox?filter=archived')).body.data).toHaveLength(0);
  });

  it('validates activity query parameters', async () => {
    const response = await request(app).get('/api/v1/activity?status=unknown').expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    await request(app)
      .get('/api/v1/activity?from=2026-12-02T00%3A00%3A00.000Z&to=2026-12-01T00%3A00%3A00.000Z')
      .expect(422);
  });

  it('persists a workflow favorite independently from graph updates', async () => {
    const created = await request(app).post('/api/v1/workflows').send(workflowDraft).expect(201);
    const id = String(created.body.data.id);
    expect(created.body.data.isFavorite).toBe(false);

    const favorite = await request(app)
      .patch(`/api/v1/workflows/${id}/favorite`)
      .send({ isFavorite: true })
      .expect(200);
    expect(favorite.body.data.isFavorite).toBe(true);
    expect((await request(app).get(`/api/v1/workflows/${id}`)).body.data.isFavorite).toBe(true);
  });

  it('persists workflow automation pause state', async () => {
    const created = await request(app).post('/api/v1/workflows').send(workflowDraft).expect(201);
    const id = String(created.body.data.id);
    const paused = await request(app)
      .patch(`/api/v1/workflows/${id}/enabled`)
      .send({ isEnabled: false })
      .expect(200);
    expect(paused.body.data.isEnabled).toBe(false);
  });

  it('persists and validates the workspace profile', async () => {
    const defaultResponse = await request(app).get('/api/v1/profile').expect(200);
    expect(defaultResponse.body.data).toMatchObject({
      displayName: 'Nexus User',
      initials: 'NU',
      timezone: 'Asia/Tehran',
    });

    const updateResponse = await request(app)
      .put('/api/v1/profile')
      .send({ displayName: 'Hamed Akbari', initials: 'HA', timezone: 'Asia/Tehran' })
      .expect(200);
    expect(updateResponse.body.data).toMatchObject({
      displayName: 'Hamed Akbari',
      initials: 'HA',
    });

    await request(app)
      .put('/api/v1/profile')
      .send({ displayName: 'H', initials: 'H!', timezone: 'Invalid/Zone' })
      .expect(422);
  });

  it('manages and tests persistent webhook endpoints', async () => {
    const createResponse = await request(app)
      .post('/api/v1/webhook-endpoints')
      .send({ name: 'Team automation', url: 'https://hooks.example.com/nexus', enabled: true })
      .expect(201);
    const endpointId = createResponse.body.data.id as string;

    const listResponse = await request(app).get('/api/v1/webhook-endpoints').expect(200);
    expect(listResponse.body.data).toHaveLength(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const testResponse = await request(app)
      .post(`/api/v1/webhook-endpoints/${endpointId}/test`)
      .expect(200);
    expect(testResponse.body.data).toMatchObject({ statusCode: 204 });
    expect(testResponse.body.data.endpoint.lastTestStatus).toBe('succeeded');

    await request(app)
      .put(`/api/v1/webhook-endpoints/${endpointId}`)
      .send({ name: 'Team delivery', url: 'https://hooks.example.com/nexus', enabled: false })
      .expect(200);
    await request(app).delete(`/api/v1/webhook-endpoints/${endpointId}`).expect(204);
    expect((await request(app).get('/api/v1/webhook-endpoints')).body.data).toHaveLength(0);
  });

  it('blocks private webhook destinations', async () => {
    await request(app)
      .post('/api/v1/webhook-endpoints')
      .send({ name: 'Unsafe endpoint', url: 'https://127.0.0.1/hook', enabled: true })
      .expect(422);
  });

  it('delivers an action through its saved webhook endpoint', async () => {
    const endpointResponse = await request(app)
      .post('/api/v1/webhook-endpoints')
      .send({ name: 'Operations', url: 'https://hooks.example.com/ops', enabled: true })
      .expect(201);
    const endpointId = endpointResponse.body.data.id as string;
    const webhookWorkflow = {
      ...workflowDraft,
      nodes: workflowDraft.nodes.map((node) =>
        node.kind === 'action'
          ? {
              ...node,
              config: {
                channel: 'webhook',
                greeting: 'Ready.',
                includeWeather: false,
                includePlan: true,
                webhookEndpointId: endpointId,
              },
            }
          : node,
      ),
    };
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = String(input);
      return Promise.resolve(
        url.includes('open-meteo')
          ? new Response(JSON.stringify({ current: { temperature_2m: 18, weather_code: 0 } }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          : new Response(null, { status: 202 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const workflowResponse = await request(app)
      .post('/api/v1/workflows')
      .send(webhookWorkflow)
      .expect(201);
    const runResponse = await request(app)
      .post(`/api/v1/workflows/${String(workflowResponse.body.data.id)}/runs`)
      .expect(201);

    expect(runResponse.body.data.result.outputs.briefing.notification).toMatchObject({
      channel: 'webhook',
      destination: 'Operations',
      delivered: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'hooks.example.com' }),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
