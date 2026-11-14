import { z } from 'zod';

import type {
  PlanningGateway,
  PlanningRequest,
  PlanningResult,
} from '../domain/planning.gateway.js';

const planSchema = z.object({
  plan: z.array(z.string().trim().min(1)).min(2).max(8),
  summary: z.string().trim().min(1).max(300),
});

export class RuleBasedPlanningGateway implements PlanningGateway {
  async createPlan(request: PlanningRequest): Promise<PlanningResult> {
    const priorities = request.priorities.filter(Boolean);
    const steps = priorities.map(
      (priority) => `${request.focusMinutes}-minute focus block: ${priority}`,
    );
    const weatherStep =
      request.weather?.weatherCode !== null &&
      request.weather?.weatherCode !== undefined &&
      request.weather.weatherCode >= 51
        ? 'Prepare for rain before heading outside'
        : 'Take a short outdoor reset between focus blocks';
    const candidates = [
      `Define the outcome for “${request.goal}”`,
      ...steps,
      weatherStep,
      `${request.breakMinutes}-minute recovery break`,
      'Close the day with a quick review and tomorrow’s first action',
    ];
    return {
      plan: candidates.slice(0, request.planLength),
      provider: 'rules',
      summary: `A ${request.tone} plan built around ${Math.max(priorities.length, 1)} priority area${priorities.length === 1 ? '' : 's'}.`,
    };
  }
}

interface OpenAIResponse {
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
}

export class OpenAIPlanningGateway implements PlanningGateway {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async createPlan(request: PlanningRequest, signal: AbortSignal): Promise<PlanningResult> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal,
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        instructions:
          'You are a practical day-planning assistant. Create concise, actionable steps. Never invent appointments or personal facts.',
        input: JSON.stringify(request),
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_plan',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['plan', 'summary'],
              properties: {
                plan: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 8,
                  items: { type: 'string' },
                },
                summary: { type: 'string' },
              },
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`Planning provider returned ${response.status}.`);
    const payload = (await response.json()) as OpenAIResponse;
    const text = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === 'output_text')?.text;
    if (!text) throw new Error('Planning provider returned no structured output.');
    const parsed = planSchema.parse(JSON.parse(text));
    return { ...parsed, provider: 'openai' };
  }
}

export class ResilientPlanningGateway implements PlanningGateway {
  constructor(
    private readonly primary: PlanningGateway | null,
    private readonly fallback: PlanningGateway,
    private readonly timeoutMs = 15_000,
  ) {}

  async createPlan(request: PlanningRequest, signal: AbortSignal) {
    if (!this.primary) return this.fallback.createPlan(request, signal);
    try {
      return await this.primary.createPlan(
        request,
        AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]),
      );
    } catch (error) {
      if (signal.aborted) throw error;
      return this.fallback.createPlan(request, signal);
    }
  }
}
