import { describe, expect, it, vi } from 'vitest';

import { ResilientWeatherGateway, type WeatherGateway } from './OpenMeteoWeatherGateway.js';

describe('ResilientWeatherGateway', () => {
  it('returns an unavailable result when the provider cannot be reached', async () => {
    const primary: WeatherGateway = {
      getCurrent: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const gateway = new ResilientWeatherGateway(primary, 100);

    const result = await gateway.getCurrent(35.6892, 51.389, new AbortController().signal);

    expect(result).toMatchObject({
      condition: 'Weather temporarily unavailable',
      isLive: false,
      temperature: null,
      unit: 'celsius',
      weatherCode: null,
      warning: 'offline',
    });
  });

  it('does not hide cancellation requested by the workflow runner', async () => {
    const controller = new AbortController();
    controller.abort();
    const primary: WeatherGateway = {
      getCurrent: vi.fn().mockRejectedValue(new Error('cancelled')),
    };
    const gateway = new ResilientWeatherGateway(primary, 100);

    await expect(gateway.getCurrent(35.6892, 51.389, controller.signal)).rejects.toThrow(
      'cancelled',
    );
  });
});
