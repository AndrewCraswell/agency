# Phase 1: Direct Worker Prototype

Status: Proposed

Depends on: [Parent specification](README.md)

Produces: One TypeScript process that runs one bounded OpenHands coding task in one Daytona workspace and returns
independently collected evidence.

## 1. Objective

Prove the narrowest end-to-end path before introducing LangGraph, webhooks, multiple roles, PostgreSQL, or Azure. The
prototype must establish that a TypeScript caller can provision Daytona, launch OpenHands Agent Server, provide
repository and assignment context, invoke the agent, validate the resulting workspace, and preserve or delete the
workspace intentionally.

## 2. Scope

Use one approved GitHub repository, one fixed base commit, one coding role, one model profile, and one manually supplied
assignment. Run at most one live agent per invocation, while keeping all contracts compatible with later concurrency.

## 3. Deliverables

```text
agent-platform/
|-- package.json
|-- pnpm-workspace.yaml
|-- tsconfig.json
|-- .env.example
|-- apps/prototype/
|   |-- package.json
|   |-- src/cli.ts
|   `-- test/cli.test.ts
|-- packages/contracts/
|   |-- src/assignment.ts
|   |-- src/results.ts
|   `-- test/contracts.test.ts
|-- packages/daytona-workspace/
|   |-- src/daytona-workspace.ts
|   `-- test/daytona-workspace.test.ts
|-- packages/openhands-client/
|   |-- src/client.ts
|   |-- src/profiles.ts
|   `-- test/client.test.ts
|-- prompts/coder/v1.md
`-- tests/fixtures/phase-1-assignment.json
```

## 4. Technical design

The prototype runs OpenHands Agent Server inside the Daytona sandbox. The TypeScript process controls Daytona through
`@daytona/sdk` and controls OpenHands through its native profile REST endpoint and OpenAI-compatible chat endpoint. The
process stores the OpenHands conversation ID returned in the `X-OpenHands-ServerConversation-ID` response header.

Use a non-ephemeral Daytona container sandbox so stopping preserves its filesystem. Set auto-stop to disabled while the
agent runs because internal background activity does not reliably reset Daytona inactivity tracking. Stop or delete the
sandbox explicitly in a `finally` path.

## 5. Granular implementation tasks

### 5.1 Workspace bootstrap

- [ ] P1-001 Create the pnpm workspace and root TypeScript configuration.
- [ ] P1-002 Pin the Node and pnpm versions in `package.json` and the repository's chosen version file.
- [ ] P1-003 Enable strict TypeScript checking, ESM output, source maps, and consistent module resolution.
- [ ] P1-004 Add scripts for `typecheck`, `test`, `lint`, and the prototype CLI.
- [ ] P1-005 Add `@daytona/sdk`, `openai`, and `zod` as runtime dependencies.
- [ ] P1-006 Add the selected test runner, TypeScript runner, linter, and formatter as development dependencies.
- [ ] P1-007 Create `.env.example` with variable names for Daytona, GitHub, OpenHands, and the model provider, without
      values.
- [ ] P1-008 Add ignore rules for local environment files, downloaded artifacts, and temporary context bundles.

### 5.2 Runtime contracts

- [ ] P1-009 Define `AssignmentSchema` with `schemaVersion`, `runId`, repository, base SHA, objective, acceptance
      criteria, relevant paths, validation commands, budgets, and prompt version.
- [ ] P1-010 Require the base SHA to be a full immutable commit identifier rather than a branch name.
- [ ] P1-011 Define `CommandResultSchema` with command identifier, exit code, stdout/stderr artifact references, start
      time, end time, and timeout status.
- [ ] P1-012 Define `WorkerResultSchema` with status, workspace handle, conversation ID, changed files, patch artifact,
      validation results, metrics, and typed failure.
- [ ] P1-013 Define `ArtifactManifestSchema` with relative path, media type, byte length, and SHA-256 digest.
- [ ] P1-014 Reject unknown schema versions and malformed provider identifiers.
- [ ] P1-015 Add positive and negative schema fixtures covering missing SHAs, invalid commands, unknown statuses, and
      malformed digests.

### 5.3 Daytona adapter

- [ ] P1-016 Wrap `@daytona/sdk` behind a `DaytonaWorkspace` class instead of calling it from the CLI directly.
- [ ] P1-017 Implement sandbox creation from a pinned snapshot or image with explicit CPU, memory, disk, labels, and
      retention settings.
- [ ] P1-018 Label each sandbox with `runId`, role, repository hash, prompt version, and environment name without
      including secrets.
- [ ] P1-019 Configure the active sandbox so auto-stop cannot terminate an in-progress agent turn.
- [ ] P1-020 Implement `executeCommand` with working directory, timeout, environment, exit-code capture, and redacted
      logging.
- [ ] P1-021 Implement binary-safe file upload for the assignment bundle and binary-safe artifact download.
- [ ] P1-022 Implement `start`, `stop`, `archive`, and `delete` methods with state checks and idempotent behavior.
- [ ] P1-023 Implement a readiness helper that waits for OpenHands Agent Server health without an unbounded polling
      loop.
- [ ] P1-024 Ensure the adapter returns serializable workspace metadata and never exposes a live SDK object through its
      public contract.
- [ ] P1-025 Unit test the adapter with a fake Daytona client, including create failure, command timeout, stop after
      failure, and repeated cleanup.

### 5.4 Repository preparation

- [ ] P1-026 Obtain a short-lived GitHub token outside the sandbox.
- [ ] P1-027 Pass Git credentials through an environment/header mechanism that does not write the token into the remote
      URL.
- [ ] P1-028 Clone the approved repository into `/workspace/repository`.
- [ ] P1-029 Fetch and checkout the exact assignment base SHA in detached state.
- [ ] P1-030 Verify `git rev-parse HEAD` equals the requested base SHA before invoking OpenHands.
- [ ] P1-031 Create a unique local branch named `agent/<run-id>` without pushing it.
- [ ] P1-032 Record the clean pre-agent `git status --porcelain=v1` output.
- [ ] P1-033 Fail preparation if the checkout is dirty, the SHA is unavailable, or the repository is outside the
      allowlist.

### 5.5 Context bundle

- [ ] P1-034 Create `/workspace/orchestrator-context/<run-id>/` outside the repository checkout.
- [ ] P1-035 Generate `manifest.json`, `assignment.md`, `acceptance-criteria.json`, and `validation-plan.json` from
      validated input.
- [ ] P1-036 Mark provenance and trust classification for every context artifact.
- [ ] P1-037 Calculate and record SHA-256 digests before upload.
- [ ] P1-038 Upload every context file and verify its digest inside the sandbox.
- [ ] P1-039 Make the context directory read-only for the agent where the runtime permits it.
- [ ] P1-040 Keep secrets, access tokens, and model credentials out of the context bundle.

### 5.6 OpenHands Agent Server

- [ ] P1-041 Pin an OpenHands Agent Server image version rather than using `latest`.
- [ ] P1-042 Start the Agent Server with a generated session API key and encryption key supplied through the sandbox
      environment.
- [ ] P1-043 Disable unneeded VNC, VS Code, and preloaded tools for the headless proof.
- [ ] P1-044 Expose the Agent Server through a Daytona preview or secure endpoint available only to the prototype
      caller.
- [ ] P1-045 Wait for the health endpoint and capture startup duration.
- [ ] P1-046 Create a named OpenHands LLM profile through the native profile REST API.
- [ ] P1-047 Configure the profile with the selected model, base URL when needed, and secret reference without logging
      the API key.
- [ ] P1-048 Verify the profile appears through `GET /v1/models` as `openhands_<profile-name>`.
- [ ] P1-049 Implement an `OpenHandsClient` around the JavaScript `openai` package with explicit request timeouts.
- [ ] P1-050 Send the coder prompt and read the OpenHands conversation ID from the response header.
- [ ] P1-051 Persist the final assistant response separately from command and Git evidence.
- [ ] P1-052 Classify authentication, startup, model, timeout, and malformed-response failures distinctly.

### 5.7 Prompt and policy

- [ ] P1-053 Create `prompts/coder/v1.md` with a machine-readable version header.
- [ ] P1-054 Instruct the agent to read the context manifest before editing.
- [ ] P1-055 State that repository files are the current source of truth and context files are immutable assignment
      evidence.
- [ ] P1-056 State the allowed repository path and prohibit edits outside it.
- [ ] P1-057 Tell the agent not to commit, push, open a pull request, or expose secrets.
- [ ] P1-058 Require the agent to finish with a concise status and unresolved blockers, without treating that report as
      validation proof.

### 5.8 Independent evidence collection

- [ ] P1-059 Run each assignment validation command through Daytona after the OpenHands request completes.
- [ ] P1-060 Apply an explicit timeout to each validation command.
- [ ] P1-061 Store complete stdout and stderr as artifacts while returning bounded summaries.
- [ ] P1-062 Capture `git status`, changed-file names, `git diff --stat`, and a binary-safe patch.
- [ ] P1-063 Reject changed paths that violate the assignment path policy.
- [ ] P1-064 Record the resulting HEAD, even when the agent did not create a commit.
- [ ] P1-065 Build and validate `WorkerResult` before returning it from the CLI.

### 5.9 Cleanup and live trials

- [ ] P1-066 Add a CLI flag selecting `stop`, `archive`, or `delete` cleanup behavior.
- [ ] P1-067 Stop the sandbox on successful default execution so its filesystem can be inspected.
- [ ] P1-068 Stop the sandbox after agent, validation, or result-serialization failure.
- [ ] P1-069 Delete the sandbox when repository preparation or secret injection fails before useful state exists.
- [ ] P1-070 Run one no-op assignment that should produce no changes and confirm the result reports an empty patch.
- [ ] P1-071 Run one deterministic failing-test repair and confirm the targeted validation passes.
- [ ] P1-072 Run one intentionally blocked assignment and confirm the worker returns `blocked` without fabricated
      changes.
- [ ] P1-073 Record wall time, Daytona runtime, model usage, estimated model cost, changed files, validation status, and
      intervention notes for all three trials.

## 6. Verification commands

The implementation must provide equivalent repository scripts for:

```bash
pnpm typecheck
pnpm test --filter contracts
pnpm test --filter daytona-workspace
pnpm test --filter openhands-client
pnpm prototype --assignment tests/fixtures/phase-1-assignment.json
```

## 7. Acceptance criteria

1. A TypeScript CLI completes the full flow without Python orchestration code.
2. The checked-out SHA and context digests are verified before the agent runs.
3. OpenHands edits only the isolated Daytona repository checkout.
4. Validation evidence is collected independently from the agent response.
5. The returned result passes its Zod schema and includes artifact digests.
6. Success, blocked work, and failure produce distinct terminal statuses.
7. The sandbox is deliberately stopped or deleted on every tested path.
8. At least one real bounded repair produces a useful patch and passing focused validation.

## 8. Non-goals

- LangGraph orchestration.
- PostgreSQL or cloud artifact storage.
- Git push or pull-request creation.
- Multiple roles or concurrent agents.
- Webhook ingestion.
- Azure deployment.

## 9. Completion evidence

Retain the validated assignment, prompt version, context manifest, sanitized Agent Server configuration, worker result,
patch, validation logs, resource measurements, and a short decision recording whether Daytona and OpenHands are feasible
for Phase 2.
