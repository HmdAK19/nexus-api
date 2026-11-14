# Nexus API engineering rules

- Write source, tests, scripts, and supported configuration in TypeScript (`.ts`). Do not add JavaScript, JSX, MJS, or CJS source files.
- Preserve feature-based domain/application/infrastructure/presentation boundaries and dependency inversion.
- Keep TypeScript strict; do not add `any`, diagnostic suppression, or unsafe non-null assertions.
- Validate all external input and provider output at system boundaries.
- Every behavior, API contract, environment variable, setup, architecture, provider, security, or operational change must update `README.md` in the same change.
- Tests must use the isolated test database and must never delete development data.
- Run `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before handoff.
