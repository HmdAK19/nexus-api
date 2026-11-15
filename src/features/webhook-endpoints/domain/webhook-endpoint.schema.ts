import { z } from 'zod';

import { parsePublicWebhookUrl } from './webhook-url.policy.js';

export const webhookEndpointSchema = z.object({
  name: z.string().trim().min(2).max(80),
  url: z
    .string()
    .trim()
    .max(2048)
    .superRefine((value, context) => {
      try {
        parsePublicWebhookUrl(value);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'Webhook URL is invalid.',
        });
      }
    }),
  enabled: z.boolean().default(true),
});

export const webhookEndpointIdSchema = z.object({ id: z.string().cuid() });
