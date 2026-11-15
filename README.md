# Nexus API

Nexus API stores visual workflow graphs, validates node configuration, executes nodes in dependency order, schedules eligible workflows, integrates external providers, and persists every run and step for observability.

## Capabilities

- CRUD and versioning for workflow graphs
- Persistent workflow favorites independent from graph versioning
- Persistent tags stored with each workflow definition
- Persisted automation pause/resume state enforced by the scheduler
- Directed acyclic graph validation and ordered execution
- Required trigger/action boundaries and trigger-reachability validation at the API boundary
- Persistent workflow run and step history
- Conditional true/false routing and persisted skipped branches
- Abort-aware delay nodes, exponential retry policies, and recoverable error paths
- Secure generic HTTP nodes with input interpolation, bounded responses, and SSRF defenses
- Timezone-aware workflow scheduling
- Open-Meteo current weather with timeout and resilient fallback
- OpenAI Structured Outputs planning with deterministic fallback
- In-app result and managed public HTTPS webhook delivery
- Persistent webhook endpoint CRUD, enable/disable lifecycle, and live connection testing
- Persistent inbox messages with unread, read, and archived lifecycle
- Request validation, rate limiting, CORS, Helmet, request IDs, and centralized errors

## Technology

- Node.js 22, Express 5, and strict TypeScript
- Prisma 6 with SQLite for local development
- Zod validation
- Vitest and Supertest

All source, test, tooling, and supported configuration code is TypeScript. JavaScript, JSX, MJS, and CJS source files are not used.

## Getting started

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

The default API base URL is `http://localhost:4000/api/v1`.

## Environment variables

| Variable                | Required | Default                         | Purpose                                 |
| ----------------------- | -------- | ------------------------------- | --------------------------------------- |
| `NODE_ENV`              | No       | `development`                   | Runtime environment                     |
| `PORT`                  | No       | `4000`                          | HTTP port                               |
| `DATABASE_URL`          | No       | `file:./dev.db`                 | Prisma database connection              |
| `CORS_ORIGIN`           | No       | `http://localhost:5173`         | Allowed production origin               |
| `OPEN_METEO_BASE_URL`   | No       | `https://api.open-meteo.com/v1` | Weather provider base URL               |
| `OPENAI_API_KEY`        | No       | —                               | Enables OpenAI planning                 |
| `OPENAI_MODEL`          | No       | `gpt-5-mini`                    | OpenAI Responses API model              |
| `SCHEDULER_ENABLED`     | No       | `true`                          | Starts the in-process scheduler         |
| `SCHEDULER_INTERVAL_MS` | No       | `30000`                         | Scheduler polling interval, minimum 10s |

Without `OPENAI_API_KEY`, planning uses the deterministic rules provider. Provider errors and timeouts also fall back automatically.

## Commands

| Command                | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start the API in watch mode                   |
| `npm run build`        | Generate Prisma client and compile production |
| `npm start`            | Run compiled output                           |
| `npm run typecheck`    | Run strict TypeScript checks                  |
| `npm run lint`         | Run ESLint without warnings                   |
| `npm test`             | Prepare isolated test DB and run tests        |
| `npm run test:watch`   | Run tests in watch mode                       |
| `npm run format`       | Format supported files                        |
| `npm run format:check` | Check formatting                              |
| `npm run db:generate`  | Generate Prisma client                        |
| `npm run db:push`      | Synchronize local database schema             |
| `npm run db:studio`    | Open Prisma Studio                            |

Tests use `prisma/test.db`; development data in `prisma/dev.db` is never cleared by the test suite.

## API routes

| Method | Route                         | Purpose                                     |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/health`                     | Service health                              |
| GET    | `/dashboard`                  | Read aggregated operational metrics         |
| GET    | `/workspace/export`           | Export a versioned workspace backup         |
| GET    | `/workflows`                  | List workflows                              |
| POST   | `/workflows`                  | Create a workflow graph                     |
| GET    | `/workflows/:id`              | Read one workflow                           |
| PUT    | `/workflows/:id`              | Replace and version a workflow graph        |
| DELETE | `/workflows/:id`              | Delete a workflow and its runs              |
| PATCH  | `/workflows/:id/favorite`     | Pin or unpin a workflow                     |
| PATCH  | `/workflows/:id/enabled`      | Pause or resume scheduled automation        |
| POST   | `/workflows/:id/runs`         | Execute a workflow                          |
| GET    | `/workflows/:id/runs`         | List the latest 50 runs                     |
| GET    | `/workflows/:id/runs/:runId`  | Read a run and its steps                    |
| DELETE | `/workflows/:id/runs/:runId`  | Delete a completed run and dependent data   |
| GET    | `/activity`                   | List cursor-paginated runs across workflows |
| GET    | `/inbox`                      | Filter and search persisted inbox messages  |
| GET    | `/inbox/summary`              | Read the global unread count                |
| PATCH  | `/inbox/:id`                  | Read, unread, archive, or restore           |
| PATCH  | `/inbox/bulk`                 | Apply one action to up to 100 messages      |
| DELETE | `/inbox/:id`                  | Permanently delete an inbox message         |
| GET    | `/profile`                    | Read or initialize the workspace profile    |
| PUT    | `/profile`                    | Update workspace identity and timezone      |
| GET    | `/webhook-endpoints`          | List managed webhook destinations           |
| POST   | `/webhook-endpoints`          | Create a webhook destination                |
| PUT    | `/webhook-endpoints/:id`      | Update or enable/disable a destination      |
| DELETE | `/webhook-endpoints/:id`      | Delete a webhook destination                |
| POST   | `/webhook-endpoints/:id/test` | Send a real connection-test event           |

`GET /activity` accepts `status=all|running|succeeded|failed`, `limit=1..50`, optional UTC ISO `from`/`to` boundaries, and an optional opaque `cursor`. The response contains `{ items, nextCursor }`; every item includes the workflow name and complete run-step details. Invalid query values return `422 VALIDATION_ERROR`.

The workspace profile is persisted as a singleton record. `PUT /profile` validates a 2–60 character display name, 1–3 alphanumeric Unicode initials, and a valid IANA timezone before updating it.

Webhook endpoint mutations accept a name, public HTTPS URL, and enabled flag. Connection tests send a real `nexus.webhook.test` JSON event and persist the latest success or failure. Workflow action nodes store only an endpoint ID; execution resolves the latest URL server-side and rejects missing or disabled destinations.

Successful responses use `{ "data": ... }`. Errors use a centralized envelope containing a stable error code, message, request ID, and optional validation details.

## Architecture

```text
src/
├── app/                     # composition root and versioned routes
├── features/
│   ├── workflows/
│   │   ├── domain/          # graph types, schemas, repository contracts
│   │   ├── application/     # workflow use cases
│   │   ├── infrastructure/  # Prisma workflow repository
│   │   └── presentation/    # controllers and routes
│   ├── executions/
│       ├── domain/          # runner, planning, notification contracts
│       ├── application/     # runner, scheduler, services, executors
│       ├── infrastructure/  # Prisma and external provider adapters
│       └── presentation/    # execution controller
│   └── inbox/
│       ├── domain/          # message lifecycle and repository contract
│       ├── application/     # inbox use cases
│       ├── infrastructure/  # Prisma inbox repository
│       └── presentation/    # inbox controller and routes
│   └── webhook-endpoints/   # managed delivery destinations and SSRF policy
└── shared/                  # config, database, errors, HTTP middleware
```

Dependencies point inward. Application services depend on domain interfaces; infrastructure implements those interfaces. Provider selection and executor registration happen in the composition root.

## Node behavior

- **Trigger:** records execution start and exposes manual/scheduled mode. The scheduler evaluates time, weekday, and IANA timezone configuration.
- **Weather:** fetches current conditions and converts Celsius/Fahrenheit. Provider timeout produces an unavailable output instead of failing the run.
- **Planner:** generates a configured number of focus steps. OpenAI is optional and wrapped by a resilient rules fallback.
- **Action:** composes a briefing and delivers it to persistent Nexus Inbox or through an enabled managed webhook endpoint. Inbox messages use the action node title and reference their workflow and run.
- **Condition:** reads incoming output with a dot-separated field path and activates its `true` or `false` edge.
- **Delay:** waits asynchronously for seconds, minutes, or hours and respects run cancellation.
- **Recovery:** non-trigger nodes support zero to five retries with exponential backoff. An exhausted failure follows a connected `error` edge with structured error output; otherwise the run fails.
- **HTTP request:** sends GET, POST, PUT, PATCH, or DELETE to a public HTTPS endpoint. URL, header, and body templates can consume upstream output. DNS resolution and literal addresses are checked against private ranges, redirects are disabled, responses are capped at 1 MB, and credentials are reserved for the encrypted vault stage.

Webhook destinations must be public HTTPS URLs without embedded credentials. Localhost and known private IP ranges are rejected. Production deployments should additionally enforce DNS-resolution and egress policies at the network layer.

## Operational limits

- The scheduler is in-process and requires the API to remain running.
- In a horizontally scaled production deployment, replace the scheduler dispatch guard with a distributed lease or queue.
- SQLite is intended for local development. Repository boundaries allow PostgreSQL adoption without changing controllers or the runner.

## Documentation policy

Documentation is part of the definition of done. Any behavior, API, environment, architecture, provider, security, or setup change must update this README in the same change. Repository engineering rules are also recorded in `AGENTS.md`.
