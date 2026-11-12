# Changelog

All notable changes to this project are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com). Update this file with every code change (see `AGENTS.md`).

## [Unreleased]

### Changed
- Compose now uses `bitnamilegacy/minio` for object storage because `minio/minio` is no longer published on Docker Hub.

### Added
- Docker Compose now runs every app (api, agent, llm, worker, web) in its own container from a shared multi-target `Dockerfile`, with a `minio-init` job that creates the document bucket.
- Project documentation under `docs/` (architecture, services, API reference, data model, configuration, development guide, known gaps).
