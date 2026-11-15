import { AppError } from '../../../shared/errors/AppError.js';
import type { NodeExecutor, NodeOutput } from '../domain/execution.types.js';
import type { HttpRequestGateway, HttpRequestMethod } from '../domain/http-request.gateway.js';
import type { NotificationGateway } from '../domain/notification.gateway.js';
import type { PlanningGateway } from '../domain/planning.gateway.js';
import type { WeatherGateway } from '../infrastructure/OpenMeteoWeatherGateway.js';

function stringConfig(config: Record<string, unknown>, key: string, fallback: string) {
  return typeof config[key] === 'string' ? config[key] : fallback;
}

function numberConfig(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = config[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function booleanConfig(config: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof config[key] === 'boolean' ? config[key] : fallback;
}

function abortableDelay(durationMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(
        signal.reason instanceof Error ? signal.reason : new Error('Execution was cancelled.'),
      );
      return;
    }
    const timer = setTimeout(resolve, durationMs);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(
          signal.reason instanceof Error ? signal.reason : new Error('Execution was cancelled.'),
        );
      },
      { once: true },
    );
  });
}

function stringArrayConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function interpolate(template: string, inputs: ReadonlyArray<NodeOutput>) {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path: string) => {
    const value = inputs
      .map((input) => valueAtPath(input, path))
      .find((item) => item !== undefined);
    if (value === undefined)
      throw new AppError(
        `HTTP template value "${path}" was not found.`,
        422,
        'HTTP_TEMPLATE_VALUE_MISSING',
      );
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

function stringRecordConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function matchesCondition(actual: unknown, operator: string, expected: unknown) {
  if (operator === 'exists') return actual !== undefined && actual !== null;
  if (operator === 'equals') return String(actual) === String(expected);
  if (operator === 'notEquals') return String(actual) !== String(expected);
  if (operator === 'contains') return String(actual).includes(String(expected));
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
  return operator === 'greaterThan' ? actualNumber > expectedNumber : actualNumber < expectedNumber;
}

export class TriggerExecutor implements NodeExecutor {
  readonly kind = 'trigger' as const;
  async execute(node: Parameters<NodeExecutor['execute']>[0]) {
    return {
      startedAt: new Date().toISOString(),
      schedule: {
        mode: booleanConfig(node.config, 'scheduleEnabled', false)
          ? ('scheduled' as const)
          : ('manual' as const),
        startedAt: new Date().toISOString(),
      },
    };
  }
}

export class WeatherExecutor implements NodeExecutor {
  readonly kind = 'context' as const;
  constructor(private readonly weather: WeatherGateway) {}
  async execute(
    node: Parameters<NodeExecutor['execute']>[0],
    context: Parameters<NodeExecutor['execute']>[1],
  ) {
    const latitude = numberConfig(node.config, 'latitude', 35.6892, -90, 90);
    const longitude = numberConfig(node.config, 'longitude', 51.389, -180, 180);
    const result = await this.weather.getCurrent(latitude, longitude, context.signal);
    const unit = stringConfig(node.config, 'temperatureUnit', 'celsius');
    return {
      weather: {
        ...result,
        unit: unit === 'fahrenheit' ? ('fahrenheit' as const) : ('celsius' as const),
        temperature:
          result.temperature !== null && unit === 'fahrenheit'
            ? (result.temperature * 9) / 5 + 32
            : result.temperature,
      },
    };
  }
}

export class PlannerExecutor implements NodeExecutor {
  readonly kind = 'intelligence' as const;
  constructor(private readonly planning: PlanningGateway) {}

  async execute(
    node: Parameters<NodeExecutor['execute']>[0],
    context: Parameters<NodeExecutor['execute']>[1],
  ): Promise<NodeOutput> {
    const weather = Object.values(context.allOutputs).find((output) => output.weather)?.weather;
    const focusMinutes = numberConfig(node.config, 'focusMinutes', 50, 15, 120);
    const planLength = numberConfig(node.config, 'planLength', 4, 2, 8);
    const result = await this.planning.createPlan(
      {
        goal: stringConfig(node.config, 'goal', 'Make meaningful progress today'),
        priorities: stringArrayConfig(node.config, 'priorities').slice(0, 5),
        focusMinutes,
        breakMinutes: numberConfig(node.config, 'breakMinutes', 10, 5, 30),
        planLength,
        tone: stringConfig(node.config, 'tone', 'calm') as 'calm' | 'direct' | 'energizing',
        weather,
      },
      context.signal,
    );
    return {
      plan: result.plan,
      planning: {
        provider: result.provider,
        summary: result.summary,
        estimatedMinutesSaved: Math.max(10, Math.round(focusMinutes * planLength * 0.12)),
      },
    };
  }
}

export class ConditionExecutor implements NodeExecutor {
  readonly kind = 'condition' as const;

  async execute(
    node: Parameters<NodeExecutor['execute']>[0],
    context: Parameters<NodeExecutor['execute']>[1],
  ): Promise<NodeOutput> {
    const field = stringConfig(node.config, 'field', 'weather.temperature');
    const actual = context.input
      .map((input) => valueAtPath(input, field))
      .find((value) => value !== undefined);
    const operator = stringConfig(node.config, 'operator', 'greaterThan');
    return {
      condition: {
        matched: matchesCondition(actual, operator, node.config.value),
        actual: actual ?? null,
      },
    };
  }
}

export class DelayExecutor implements NodeExecutor {
  readonly kind = 'delay' as const;

  async execute(
    node: Parameters<NodeExecutor['execute']>[0],
    context: Parameters<NodeExecutor['execute']>[1],
  ): Promise<NodeOutput> {
    const duration = numberConfig(node.config, 'duration', 5, 1, 86_400);
    const unit = stringConfig(node.config, 'unit', 'seconds');
    const multiplier = unit === 'hours' ? 3_600_000 : unit === 'minutes' ? 60_000 : 1_000;
    const durationMs = duration * multiplier;
    await abortableDelay(durationMs, context.signal);
    return { delay: { durationMs, completedAt: new Date().toISOString() } };
  }
}

export class HttpRequestExecutor implements NodeExecutor {
  readonly kind = 'http' as const;

  constructor(private readonly gateway: HttpRequestGateway) {}

  async execute(
    node: Parameters<NodeExecutor['execute']>[0],
    context: Parameters<NodeExecutor['execute']>[1],
  ): Promise<NodeOutput> {
    const method = stringConfig(node.config, 'method', 'GET') as HttpRequestMethod;
    const headers = Object.fromEntries(
      Object.entries(stringRecordConfig(node.config, 'headers')).map(([name, value]) => [
        name,
        interpolate(value, context.input),
      ]),
    );
    const bodyTemplate = stringConfig(node.config, 'body', '');
    const result = await this.gateway.send({
      body:
        method === 'GET' || !bodyTemplate ? undefined : interpolate(bodyTemplate, context.input),
      headers: { Accept: 'application/json, text/plain;q=0.9', ...headers },
      method,
      signal: context.signal,
      timeoutMs: numberConfig(node.config, 'timeoutMs', 10_000, 1_000, 30_000),
      url: interpolate(stringConfig(node.config, 'url', ''), context.input),
    });
    return { http: result };
  }
}

export class BriefingExecutor implements NodeExecutor {
  readonly kind = 'action' as const;
  constructor(private readonly notifications: NotificationGateway) {}

  async execute(
    node: Parameters<NodeExecutor['execute']>[0],
    context: Parameters<NodeExecutor['execute']>[1],
  ): Promise<NodeOutput> {
    const weather = Object.values(context.allOutputs).find((output) => output.weather)?.weather;
    const plan = Object.values(context.allOutputs).find((output) => output.plan)?.plan ?? [];
    const includeWeather = booleanConfig(node.config, 'includeWeather', true);
    const includePlan = booleanConfig(node.config, 'includePlan', true);
    const weatherSummary =
      includeWeather && weather?.isLive && weather.temperature !== null
        ? ` Local weather is ${Math.round(weather.temperature)}°${weather.unit === 'fahrenheit' ? 'F' : 'C'} and ${weather.condition.toLowerCase()}.`
        : includeWeather
          ? ' Local weather is temporarily unavailable.'
          : '';
    const planSummary = includePlan
      ? ` Your plan has ${plan.length} focused steps and starts with: ${plan[0] ?? 'Review your priorities'}.`
      : '';
    const briefing = `${stringConfig(node.config, 'greeting', 'Good morning.')}${weatherSummary}${planSummary}`;
    const channel = stringConfig(node.config, 'channel', 'inApp') as 'inApp' | 'webhook';
    const notification = await this.notifications.deliver(
      {
        channel,
        message: briefing,
        runId: context.runId,
        title: node.title.startsWith('node.') ? 'Workflow briefing' : node.title,
        webhookEndpointId: stringConfig(node.config, 'webhookEndpointId', '') || undefined,
        workflowId: context.workflowId,
      },
      context.signal,
    );
    return { briefing, notification };
  }
}
