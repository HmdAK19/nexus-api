import type { NodeOutput } from './execution.types.js';

export interface PlanningRequest {
  breakMinutes: number;
  focusMinutes: number;
  goal: string;
  planLength: number;
  priorities: string[];
  tone: 'calm' | 'direct' | 'energizing';
  weather?: NodeOutput['weather'];
}

export interface PlanningResult {
  plan: string[];
  provider: 'openai' | 'rules';
  summary: string;
}

export interface PlanningGateway {
  createPlan: (request: PlanningRequest, signal: AbortSignal) => Promise<PlanningResult>;
}
