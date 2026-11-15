import { z } from 'zod';

export const activityQuerySchema = z
  .object({
    status: z.enum(['all', 'running', 'succeeded', 'failed']).default('all'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    q: z.string().trim().max(120).default(''),
    order: z.enum(['newest', 'oldest']).default('newest'),
  })
  .refine((query) => !query.from || !query.to || Date.parse(query.from) <= Date.parse(query.to), {
    message: 'The activity start date must be before the end date.',
    path: ['from'],
  });

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
