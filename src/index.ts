import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './shared/config/env.js';
import { prisma } from './shared/database/prisma.js';
import { workflowScheduler } from './app/container.js';

const server = createServer(createApp());

server.listen(env.PORT, () => {
  console.info(`Nexus API listening on http://localhost:${env.PORT}`);
  if (env.SCHEDULER_ENABLED) workflowScheduler.start();
});

async function shutdown(signal: string) {
  console.info(`${signal} received. Shutting down Nexus API.`);
  workflowScheduler.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
