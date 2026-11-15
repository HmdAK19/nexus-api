import { env } from '../shared/config/env.js';
import { prisma } from '../shared/database/prisma.js';
import {
  BriefingExecutor,
  ConditionExecutor,
  DelayExecutor,
  HttpRequestExecutor,
  PlannerExecutor,
  TriggerExecutor,
  WeatherExecutor,
} from '../features/executions/application/nodeExecutors.js';
import { ExecutionService } from '../features/executions/application/ExecutionService.js';
import { WorkflowRunner } from '../features/executions/application/WorkflowRunner.js';
import { WorkflowScheduler } from '../features/executions/application/WorkflowScheduler.js';
import {
  OpenMeteoWeatherGateway,
  ResilientWeatherGateway,
} from '../features/executions/infrastructure/OpenMeteoWeatherGateway.js';
import { PrismaRunRepository } from '../features/executions/infrastructure/PrismaRunRepository.js';
import { HttpNotificationGateway } from '../features/executions/infrastructure/NotificationGateway.js';
import { SecureHttpRequestGateway } from '../features/executions/infrastructure/SecureHttpRequestGateway.js';
import {
  OpenAIPlanningGateway,
  ResilientPlanningGateway,
  RuleBasedPlanningGateway,
} from '../features/executions/infrastructure/PlanningGateways.js';
import { ExecutionController } from '../features/executions/presentation/ExecutionController.js';
import { WorkflowService } from '../features/workflows/application/WorkflowService.js';
import { PrismaWorkflowRepository } from '../features/workflows/infrastructure/PrismaWorkflowRepository.js';
import { WorkflowController } from '../features/workflows/presentation/WorkflowController.js';
import { InboxService } from '../features/inbox/application/InboxService.js';
import { PrismaInboxRepository } from '../features/inbox/infrastructure/PrismaInboxRepository.js';
import { InboxController } from '../features/inbox/presentation/InboxController.js';
import { ProfileService } from '../features/profile/application/ProfileService.js';
import { PrismaProfileRepository } from '../features/profile/infrastructure/PrismaProfileRepository.js';
import { ProfileController } from '../features/profile/presentation/ProfileController.js';
import { WebhookEndpointService } from '../features/webhook-endpoints/application/WebhookEndpointService.js';
import { PrismaWebhookEndpointRepository } from '../features/webhook-endpoints/infrastructure/PrismaWebhookEndpointRepository.js';
import { WebhookEndpointController } from '../features/webhook-endpoints/presentation/WebhookEndpointController.js';
import { DashboardService } from '../features/dashboard/application/DashboardService.js';
import { PrismaDashboardRepository } from '../features/dashboard/infrastructure/PrismaDashboardRepository.js';
import { DashboardController } from '../features/dashboard/presentation/DashboardController.js';
import { PrismaWorkspaceExportRepository } from '../features/workspace-export/infrastructure/PrismaWorkspaceExportRepository.js';
import { WorkspaceExportController } from '../features/workspace-export/presentation/WorkspaceExportController.js';

const workflowRepository = new PrismaWorkflowRepository(prisma);
const runRepository = new PrismaRunRepository(prisma);
const inboxRepository = new PrismaInboxRepository(prisma);
const profileRepository = new PrismaProfileRepository(prisma);
const webhookEndpointRepository = new PrismaWebhookEndpointRepository(prisma);
const dashboardRepository = new PrismaDashboardRepository(prisma);
const weatherGateway = new ResilientWeatherGateway(
  new OpenMeteoWeatherGateway(env.OPEN_METEO_BASE_URL),
);
const planningGateway = new ResilientPlanningGateway(
  env.OPENAI_API_KEY ? new OpenAIPlanningGateway(env.OPENAI_API_KEY, env.OPENAI_MODEL) : null,
  new RuleBasedPlanningGateway(),
);
const notificationGateway = new HttpNotificationGateway(inboxRepository, webhookEndpointRepository);
const runner = new WorkflowRunner([
  new TriggerExecutor(),
  new WeatherExecutor(weatherGateway),
  new PlannerExecutor(planningGateway),
  new ConditionExecutor(),
  new DelayExecutor(),
  new HttpRequestExecutor(new SecureHttpRequestGateway()),
  new BriefingExecutor(notificationGateway),
]);

export const workflowService = new WorkflowService(workflowRepository);
export const executionService = new ExecutionService(workflowRepository, runRepository, runner);
export const inboxService = new InboxService(inboxRepository);
export const profileService = new ProfileService(profileRepository);
export const webhookEndpointService = new WebhookEndpointService(webhookEndpointRepository);
export const workflowScheduler = new WorkflowScheduler(
  workflowRepository,
  executionService,
  env.SCHEDULER_INTERVAL_MS,
);
export const workflowController = new WorkflowController(workflowService);
export const executionController = new ExecutionController(executionService);
export const inboxController = new InboxController(inboxService);
export const profileController = new ProfileController(profileService);
export const webhookEndpointController = new WebhookEndpointController(webhookEndpointService);
export const dashboardController = new DashboardController(
  new DashboardService(dashboardRepository),
);
export const workspaceExportController = new WorkspaceExportController(
  new PrismaWorkspaceExportRepository(prisma),
);
