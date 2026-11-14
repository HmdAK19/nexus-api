import type { NodeExecutor, NodeOutput } from '../domain/execution.types.js';
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

function stringArrayConfig(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
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
        webhookUrl: stringConfig(node.config, 'webhookUrl', '') || undefined,
      },
      context.signal,
    );
    return { briefing, notification };
  }
}
