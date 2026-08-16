# Milestone 1: Application and local development foundation

## Goal

Create one production-oriented workspace under `apps/legislation` and make every major runtime executable locally.

## Tasks

### Workspace setup

- [ ] **M1.1** Create `apps/legislation/package.json` as a private workspace package.
- [ ] **M1.2** Extend the monorepo TypeScript configuration rather than duplicating compiler settings.
- [ ] **M1.3** Add application scripts for build, type-check, lint, test, coverage, and focused development.
- [ ] **M1.4** Wire those scripts into the existing Turborepo task graph.
- [ ] **M1.5** Add app-scoped oxlint configuration only for exceptions not covered by the shared configuration.
- [ ] **M1.6** Configure Vitest for unit and PostgreSQL integration tests.
- [ ] **M1.7** Configure unused-code analysis for the new workspace.
- [ ] **M1.8** Confirm the workspace participates in the root `pnpm verify` command.

### Runtime entry points

- [ ] **M1.9** Create an MCP server entry point with a health endpoint and graceful shutdown.
- [ ] **M1.10** Create a common CLI entry point for ingestion and maintenance commands.
- [ ] **M1.11** Define commands for Open States import, GovInfo import, Congress sync, document processing, embedding, and
      coverage reporting.
- [ ] **M1.12** Establish dependency injection boundaries so commands can use test databases and provider fixtures.
- [ ] **M1.13** Add consistent exit codes for successful, partially successful, invalid, and failed jobs.

### Configuration and logging

- [ ] **M1.14** Inventory every required environment variable by runtime.
- [ ] **M1.15** Implement validated configuration with separate server, ingestion, database, model, auth, and Azure groups.
- [ ] **M1.16** Prevent secrets from being emitted by configuration errors or logs.
- [ ] **M1.17** Add a checked-in example environment file containing names and safe descriptions only.
- [ ] **M1.18** Implement structured logging with timestamp, level, service, operation, and correlation ID.
- [ ] **M1.19** Define safe log serialization for upstream errors and database failures.

### Local infrastructure

- [ ] **M1.20** Add a local PostgreSQL configuration with pgvector enabled.
- [ ] **M1.21** Add commands to start, stop, reset, and inspect local infrastructure.
- [ ] **M1.22** Add a readiness check that waits for PostgreSQL before migrations or tests run.
- [ ] **M1.23** Document how local Blob Storage behavior is emulated or replaced by a filesystem adapter.
- [ ] **M1.24** Document optional local n8n startup without making it necessary for unit development.
- [ ] **M1.25** Add a smoke test that starts the application against local dependencies.

### Developer documentation

- [ ] **M1.26** Document the application layout and ownership boundary.
- [ ] **M1.27** Document the clean-checkout setup procedure.
- [ ] **M1.28** Document how to run each entry point and the focused verification commands.
- [ ] **M1.29** Document how to reset disposable local legislative data without affecting other monorepo applications.

## Exit criteria

- A clean checkout can install, build, type-check, lint, and test the legislation workspace.
- PostgreSQL with pgvector can be started locally without Azure.
- The server and a placeholder ingestion command start and shut down cleanly.
- Root `pnpm verify` remains clean.

