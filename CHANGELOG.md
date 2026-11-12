# Changelog

All notable changes to this project are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com). Update this file with every code change (see `AGENTS.md`).

## [Unreleased]

### Fixed
- The web app no longer renders a blank page with `React is not defined`: Vite now uses the automatic JSX runtime.
- The agent service now retrieves from pgvector (it used an empty stub), and the API searches the tenant's default knowledge base when a request names none, so questions are answered from ingested documents.
- Document upload and conversations no longer fail against PostgreSQL: documents are filed under a per-tenant default knowledge base UUID (created on demand) instead of the invalid `'default'`, and non-UUID tenant keys such as `local` are mapped to stable tenant UUIDs.

### Changed
- Compose now uses `bitnamilegacy/minio` for object storage because `minio/minio` is no longer published on Docker Hub.

### Added
- Playwright browser end-to-end tests for the Q&A web app (`pnpm test:e2e`), running against the Vite dev server with the API stubbed so no backend is required.
- Docker Compose now runs every app (api, agent, llm, worker, web) in its own container from a shared multi-target `Dockerfile`, with a `minio-init` job that creates the document bucket.
- Project documentation under `docs/` (architecture, services, API reference, data model, configuration, development guide, known gaps).
