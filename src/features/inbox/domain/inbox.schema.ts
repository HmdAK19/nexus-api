import { z } from 'zod';

export const inboxActionSchema = z.object({
  action: z.enum(['read', 'unread', 'archive', 'restore']),
});

export const bulkInboxActionSchema = z.object({
  action: z.enum(['read', 'unread', 'archive', 'restore', 'delete']),
  ids: z.array(z.string().cuid()).min(1).max(100),
});

export type InboxAction = z.infer<typeof inboxActionSchema>['action'];
export type BulkInboxAction = z.infer<typeof bulkInboxActionSchema>['action'];
