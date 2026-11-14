import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  OPEN_METEO_BASE_URL: z.url().default('https://api.open-meteo.com/v1'),
  OPENAI_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  OPENAI_MODEL: z.string().min(1).default('gpt-5-mini'),
  SCHEDULER_ENABLED: z.stringbool().default(true),
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(10_000).default(30_000),
});

export const env = envSchema.parse(process.env);
