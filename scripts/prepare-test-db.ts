import { existsSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const databasePath = resolve('prisma/test.db');
if (existsSync(databasePath)) rmSync(databasePath);

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE "WorkspaceProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "displayName" TEXT NOT NULL DEFAULT 'Nexus User',
    "initials" TEXT NOT NULL DEFAULT 'NU',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );
  CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" DATETIME,
    "lastTestStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );
  CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '',
    "positionX" REAL NOT NULL,
    "positionY" REAL NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "WorkflowNode_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    CONSTRAINT "WorkflowEdge_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "WorkflowNode" ("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    CONSTRAINT "WorkflowEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "WorkflowNode" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
  );
  CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "error" TEXT,
    "result" TEXT,
    CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE TABLE "WorkflowRunStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    CONSTRAINT "WorkflowRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    "archivedAt" DATETIME,
    CONSTRAINT "InboxMessage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboxMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE INDEX "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");
  CREATE INDEX "WebhookEndpoint_enabled_name_idx" ON "WebhookEndpoint"("enabled", "name");
  CREATE INDEX "WorkflowEdge_workflowId_idx" ON "WorkflowEdge"("workflowId");
  CREATE INDEX "WorkflowEdge_sourceNodeId_idx" ON "WorkflowEdge"("sourceNodeId");
  CREATE INDEX "WorkflowEdge_targetNodeId_idx" ON "WorkflowEdge"("targetNodeId");
  CREATE INDEX "WorkflowRun_workflowId_startedAt_idx" ON "WorkflowRun"("workflowId", "startedAt");
  CREATE INDEX "WorkflowRunStep_runId_startedAt_idx" ON "WorkflowRunStep"("runId", "startedAt");
  CREATE INDEX "InboxMessage_status_createdAt_idx" ON "InboxMessage"("status", "createdAt");
  CREATE INDEX "InboxMessage_workflowId_createdAt_idx" ON "InboxMessage"("workflowId", "createdAt");
  CREATE INDEX "InboxMessage_runId_idx" ON "InboxMessage"("runId");
`);
database.close();
