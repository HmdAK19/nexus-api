export const inboxStatuses = ['unread', 'read', 'archived'] as const;
export type InboxStatus = (typeof inboxStatuses)[number];
export type InboxFilter = 'active' | 'unread' | 'archived';

export interface InboxMessage {
  archivedAt: Date | null;
  body: string;
  createdAt: Date;
  id: string;
  readAt: Date | null;
  runId: string;
  status: InboxStatus;
  title: string;
  workflowId: string;
}

export interface CreateInboxMessage {
  body: string;
  runId: string;
  title: string;
  workflowId: string;
}
