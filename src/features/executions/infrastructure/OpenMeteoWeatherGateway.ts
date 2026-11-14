import { z } from 'zod';

const weatherResponseSchema = z.object({
  current: z.object({ temperature_2m: z.number(), weather_code: z.number() }),
});

export interface WeatherGateway {
  getCurrent: (
    latitude: number,
    longitude: number,
    signal: AbortSignal,
  ) => Promise<{
    condition: string;
    isLive: boolean;
    temperature: number | null;
    unit: 'celsius' | 'fahrenheit';
    weatherCode: number | null;
    warning?: string;
  }>;
}

const conditions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  51: 'Light drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  80: 'Rain showers',
  95: 'Thunderstorm',
};

export class OpenMeteoWeatherGateway implements WeatherGateway {
  constructor(private readonly baseUrl: string) {}

  async getCurrent(latitude: number, longitude: number, signal: AbortSignal) {
    const url = new URL(`${this.baseUrl}/forecast`);
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,weather_code',
      timezone: 'auto',
    }).toString();
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}.`);
    const payload = weatherResponseSchema.parse(await response.json());
    const weatherCode = payload.current.weather_code;
    return {
      temperature: payload.current.temperature_2m,
      weatherCode,
      condition: conditions[weatherCode] ?? 'Mixed conditions',
      isLive: true,
      unit: 'celsius' as const,
    };
  }
}

export class ResilientWeatherGateway implements WeatherGateway {
  constructor(
    private readonly primary: WeatherGateway,
    private readonly timeoutMs = 5_000,
  ) {}

  async getCurrent(latitude: number, longitude: number, signal: AbortSignal) {
    try {
      const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
      const requestSignal = AbortSignal.any([signal, timeoutSignal]);
      return await this.primary.getCurrent(latitude, longitude, requestSignal);
    } catch (error) {
      if (signal.aborted) throw error;

      return {
        condition: 'Weather temporarily unavailable',
        isLive: false,
        temperature: null,
        unit: 'celsius' as const,
        weatherCode: null,
        warning: error instanceof Error ? error.message : 'Weather provider is unavailable.',
      };
    }
  }
}
