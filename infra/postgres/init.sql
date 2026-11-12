-- Runs once on first container start (docker-entrypoint-initdb.d). Migrations create the schema.
CREATE EXTENSION IF NOT EXISTS vector;
