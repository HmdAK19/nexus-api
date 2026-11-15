import { describe, expect, it } from 'vitest';

import { validateNodeOutput } from './node.contracts.js';

describe('node output contracts', () => {
  it('accepts a valid trigger output', () => {
    const output = {
      startedAt: '2026-11-15T08:00:00.000Z',
      schedule: { mode: 'manual' as const, startedAt: '2026-11-15T08:00:00.000Z' },
    };
    expect(validateNodeOutput('trigger', output)).toStrictEqual(output);
  });

  it('rejects malformed executor output before it reaches downstream nodes', () => {
    expect(() => validateNodeOutput('context', { weather: { temperature: 'hot' } })).toThrow(
      'The context node returned an invalid output.',
    );
  });
});
