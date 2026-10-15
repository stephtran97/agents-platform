# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm TypeScript monorepo:

- `apps/api` — public Fastify API and tenant-aware orchestration.
- `apps/agent` — agent HTTP service, runtime registry, retrieval, and RAG logic.
- `apps/llm` — LLM gateway and provider adapters.
- `apps/worker` — document extraction, chunking, embedding, and ingestion polling.
- `apps/web` — React/Vite browser application.
- `packages/contracts` — shared Zod transport contracts.
- `packages/domain` — entities, tenant-aware ports, repositories, storage adapters, and SQL migrations.
- `packages/clients` — typed inter-service HTTP clients.
- `packages/config` — environment validation and defaults.
- `packages/observability` — cross-service observability primitives.
- `tests/` — workspace and cross-package tests.
- `docs/` — specifications, implementation plans, and project notes.

Keep feature code in the owning app/package. Add tests beside the implementation unless the test spans multiple packages, in which case use `tests/`. Keep root configuration and sanitized examples at the repository root.

## Build, Test, and Development Commands

Run commands from the repository root with pnpm:

- `pnpm install` — install workspace dependencies.
- `pnpm typecheck` — typecheck all workspace projects.
- `pnpm build` — build all packages and the Vite web bundle.
- `pnpm test` — run the complete Vitest suite; storage integration tests need PostgreSQL and MinIO.
- `pnpm --filter @agents-platform/web dev` — start the Vite web development server on port 5173.
- `docker compose up -d` — start PostgreSQL/pgvector and MinIO.

For an environment without Docker, run the focused non-integration suite documented in `README.md`. Do not treat skipped or unavailable infrastructure tests as application unit-test failures.

Default service ports are API `4100`, agent `4101`, LLM gateway `4102`, and web `5173`. `.env.example` lists the required database, object-storage, tenant, runtime, and provider settings.

## Coding Style & Naming Conventions

Use TypeScript end-to-end with strict compiler settings. Use two-space indentation, `PascalCase` for components/classes, `camelCase` for variables/functions, and `kebab-case` for filenames and directories. Prefer small modules with explicit interfaces and dependency injection at service boundaries. Keep tenant context explicit in repository and service calls.

Use the existing project formatter/linter when one is added; build and typecheck must remain part of normal development workflow.

## Testing Guidelines

Use Vitest. Add regression tests for new behavior and bug fixes. Test names should describe behavior, such as `auth-session.test.ts` or `tenant-isolation.test.ts`.

Every tenant-owned feature should include isolation coverage. Service-boundary tests should use injected fakes rather than network calls. Integration tests may use Docker-backed PostgreSQL/MinIO, but must be clearly identified and should not make unit tests depend on external services.

Before claiming a change is complete, run `pnpm typecheck`, the relevant focused tests, and `pnpm build` when build behavior is affected. Record infrastructure limitations explicitly.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects such as `Add tenant isolation` or `Fix embedding timeout`. Keep unrelated refactors out of feature commits.

Pull requests should explain the change, identify tenant/security implications, list validation commands and results, and include screenshots or example requests for UI/API changes. Note when Docker-backed integration tests were not run.

## Security & Configuration Tips

Never commit credentials, tokens, `.env`, or provider API keys. Use `.env.example` for sanitized configuration. The `x-tenant-id` header is only a local development selector and must not be treated as production authentication. Production deployments need authenticated tenant identity, authorization checks, secret management, request limits, and provider timeout/error handling.
