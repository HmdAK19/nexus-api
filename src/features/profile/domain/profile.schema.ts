import { z } from 'zod';

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const workspaceProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  initials: z
    .string()
    .trim()
    .min(1)
    .max(3)
    .regex(/^[\p{L}\p{N}]+$/u),
  timezone: z.string().trim().refine(isTimeZone, 'Timezone must be a valid IANA timezone.'),
});
