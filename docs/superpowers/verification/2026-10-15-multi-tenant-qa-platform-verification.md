# Multi-Tenant Q&A Platform — Verification Note

Recorded 2026-11-12 against the Docker Compose stack (`docker compose up -d --build --wait`), `LLM_PROVIDER=mock`, `AGENT_RUNTIME=basic-rag`.

## Commands and results

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS, no errors |
| `pnpm build` | PASS (web bundle built) |
| `DATABASE_URL=postgres://agents:agents@localhost:5433/agents pnpm test:integration` (serial, whole suite) | PASS — 27 files, 75 tests |
| `pnpm exec vitest run tests/evaluation tests/integration` | PASS — evaluation (2) and document-to-answer (2) |
| `pnpm test:e2e` (Playwright) | PASS — 8 tests: 6 stubbed UI tests, 1 real-stack upload→ready→answer→citation test, 1 unsupported-file test |

## Clean start

On 2026-11-13, after confirmation, `docker compose down` and removal of only `agents-platform_postgres_data` and `agents-platform_minio_data` (names confirmed with `docker volume ls`), then `docker compose up -d --build --wait` brought every service healthy from empty volumes. Typecheck, build, `pnpm test:integration` (75/75) and `pnpm test:e2e` (8/8) all passed afterwards.

## Replaceability

`createAgentRuntime(name, deps)` selects the runtime from `AGENT_RUNTIME`; an unknown name fails fast with `AGENT_RUNTIME_UNAVAILABLE` (`apps/agent/src/runtime-registry.test.ts`). `createLlmProvider` selects the provider from `LLM_PROVIDER` and rejects unknown names or missing credentials (`apps/llm/src/provider-registry.test.ts`). Both are configuration changes in `.env`/Compose, not source edits. Only the `mock` provider and `basic-rag` runtime were exercised end to end; the OpenAI/Azure adapter was verified only with a faked `fetch` (auth header, error and timeout mapping), never against a real endpoint.

## Failure paths

| Path | Evidence |
|---|---|
| Unsupported upload | Live stack: uploading `a.png` produced a document with `status: failed`; the worker logged `DOCUMENT_UNSUPPORTED`. Unit: `process-ingestion-job.test.ts`. Browser: the uploader rejects unsupported types before any API call. |
| Failed embedding / extraction | `process-ingestion-job.test.ts` asserts `INGESTION_FAILED` is persisted. |
| LLM timeout | `apps/llm/src/http/routes.test.ts` (hanging provider → `504 MODEL_TIMEOUT` inside the deadline) and `http-provider.test.ts` (abort → `MODEL_TIMEOUT`). |
| Provider failure | `routes.test.ts`: provider errors become `503 MODEL_UNAVAILABLE` with no upstream detail leaked. |
| Empty retrieval | Live stack: a tenant with no documents got the grounded no-answer with `citations: []`. Unit and evaluation tests cover it too. |
| Duplicate job retry | `process-ingestion-job.test.ts` (retry does not duplicate chunks) and the Postgres adapter test (a job is claimed once). |
| Cross-tenant data | `apps/api/src/conversation-history.test.ts` (body and query tenant ids ignored; other tenant gets 404/empty), `tests/integration/document-to-answer.test.ts`, and the Postgres adapter isolation test. |

## Bugs found by this verification and fixed

- The web client sent `Content-Type: application/json` with an empty body when creating a conversation; the API rejected it with 400. The stubbed browser tests hid it.
- The web client sent `knowledgeBaseIds: ["default"]`, which is not a UUID, so retrieval failed in the real stack. The client now omits it and the API maps `"default"` to the tenant default knowledge base.
- Retrieval citations used the document ID as the filename; the vector search now joins the document filename.
- Azure OpenAI used a bearer header; it now sends `api-key`.
- The LLM gateway returned 503 for invalid requests; it now returns 400 `INVALID_REQUEST`.
- Conversation messages were never persisted and history was never sent to the agent; both now happen.

## Known limitations

- A local Windows PostgreSQL listens on port 5432 on the verification machine and shadows the container. Set `POSTGRES_PORT` (for example `5433`) and point `DATABASE_URL` at it for host-side integration tests.
- The Postgres job-claim test and the end-to-end test share a database with the live worker, which also claims jobs. Run integration tests serially (`pnpm test:integration`) rather than in the parallel `pnpm test`, or stop the worker.
- Plan deviation: the API keeps its handlers in `apps/api/src/index.ts` and `store.ts` rather than the planned `auth/`, `services/` and `http/routes/` files. Behavior and tenant-isolation tests are covered.
- Still open from `docs/known-gaps.md`: no document delete route or streaming endpoint, no retry of failed ingestion jobs or reclaim of stuck `processing` jobs, flat error bodies, and `x-tenant-id` is a development selector, not authentication.

## Recommended next sub-project

Production authentication and multi-tenancy: authenticated tenant identity, authorization checks, request size limits (documents are base64 in JSON today), rate limiting and secret management.
