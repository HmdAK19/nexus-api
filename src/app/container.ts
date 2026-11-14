import { env } from '../shared/config/env.js';
import { prisma } from '../shared/database/prisma.js';
import {
  BriefingExecutor,
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
import {
  OpenAIPlanningGateway,
  ResilientPlanningGateway,
  RuleBasedPlanningGateway,
} from '../features/executions/infrastructure/PlanningGateways.js';
import { ExecutionController } from '../features/executions/presentation/ExecutionController.js';
import { WorkflowService } from '../features/workflows/application/WorkflowService.js';
import { PrismaWorkflowRepository } from '../features/workflows/infrastructure/PrismaWorkflowRepository.js';
import { WorkflowController } from '../features/workflows/presentation/WorkflowController.js';

const workflowRepository = new PrismaWorkflowRepository(prisma);
const runRepository = new PrismaRunRepository(prisma);
const weatherGateway = new ResilientWeatherGateway(
  new OpenMeteoWeatherGateway(env.OPEN_METEO_BASE_URL),
);
const planningGateway = new ResilientPlanningGateway(
  env.OPENAI_API_KEY ? new OpenAIPlanningGateway(env.OPENAI_API_KEY, env.OPENAI_MODEL) : null,
  new RuleBasedPlanningGateway(),
);
const notificationGateway = new HttpNotificationGateway();
const runner = new WorkflowRunner([
  new TriggerExecutor(),
  new WeatherExecutor(weatherGateway),
  new PlannerExecutor(planningGateway),
  new BriefingExecutor(notificationGateway),
]);

export const workflowService = new WorkflowService(workflowRepository);
export const executionService = new ExecutionService(workflowRepository, runRepository, runner);
export const workflowScheduler = new WorkflowScheduler(
  workflowRepository,
  executionService,
  env.SCHEDULER_INTERVAL_MS,
);
export const workflowController = new WorkflowController(workflowService);
export const executionController = new ExecutionController(executionService);
