# Phase 4: Durable and Resumable Workspaces

Status: Implemented in source

Depends on: [Phase 3](phase-3-local-specialized-agent-chain.md)

Produces: PostgreSQL-checkpointed workflows that survive orchestrator restarts, reuse retained Daytona workspaces, and
operate safely at up to ten concurrent runs.

## 1. Objective

Make the complete local scrum-master, coder, reviewer, and repairer graph durable without changing its proven role
contracts or routing behavior. Prove that graph state and provider state can be reconciled after process loss, that a
stopped or archived Daytona workspace can be restored, and that ten isolated workflows do not collide in branches,
context, conversations, or artifacts.

## 2. Persistence model

PostgreSQL is authoritative for LangGraph checkpoints, workflow metadata, provider handles, and lifecycle decisions.
Daytona is authoritative for actual sandbox state. GitHub is authoritative for branches and pull requests. Recovery
compares these systems rather than assuming the checkpoint reflects current external state.

## 3. Granular implementation tasks

### 3.1 PostgreSQL foundation

- [ ] P4-001 Add the supported LangGraph PostgreSQL checkpointer package for TypeScript.
- [ ] P4-002 Create a local PostgreSQL development configuration with a persistent volume.
- [ ] P4-003 Define separate database roles for migrations and runtime access.
- [ ] P4-004 Create an application schema for workflow metadata outside tables owned by the LangGraph checkpointer.
- [ ] P4-005 Add a migration tool and a deterministic migration command.
- [ ] P4-006 Create a `workflow_runs` table keyed by run ID and assignment digest.
- [ ] P4-007 Create a `workspace_leases` table containing provider, workspace ID, state, owner run, retention
      timestamps, and version.
- [ ] P4-008 Create an `artifact_records` table containing run, role, artifact type, URI, digest, length, and creation
      timestamp.
- [ ] P4-009 Create a `workflow_events` append-only table for bounded operational events, not full model transcripts.
- [ ] P4-010 Add indexes for active status, repository, pull request, workspace ID, and retention deadline.
- [ ] P4-011 Add optimistic concurrency or row-locking around workspace lease transitions.
- [ ] P4-012 Test migrations from an empty database and rollback/rebuild in a disposable environment.

### 3.2 Durable graph execution

- [ ] P4-013 Replace the memory checkpointer with PostgreSQL behind a configuration switch.
- [ ] P4-014 Use a stable thread ID derived from the workflow run ID.
- [ ] P4-015 Persist the assignment digest and reject a different assignment for an existing thread.
- [ ] P4-016 Persist external identifiers immediately after successful creation and before the next external call.
- [ ] P4-017 Make each side-effecting node inspect existing state before creating external resources.
- [ ] P4-018 Add graph startup logic that lists non-terminal runs and schedules reconciliation.
- [ ] P4-019 Add a lease or leader mechanism so two orchestrator processes cannot advance the same thread
      simultaneously.
- [ ] P4-020 Define retry classes for transient provider errors, rate limits, and network interruption.
- [ ] P4-021 Define non-retryable classes for invalid assignments, policy violations, authentication failures, and
      unsupported schema versions.
- [ ] P4-022 Add bounded exponential backoff with recorded next-attempt timestamps.
- [ ] P4-023 Ensure process termination during a retry wait does not lose the planned retry.

### 3.3 Workspace lifecycle state machine

- [ ] P4-024 Define allowed workspace transitions for creating, started, stopping, stopped, archiving, archived,
      restoring, deleting, deleted, and error states.
- [ ] P4-025 Reject impossible transitions before calling Daytona.
- [ ] P4-026 Query actual Daytona state before resuming a lifecycle operation after restart.
- [ ] P4-027 Implement `ensureStarted` for new, stopped, and archived workspaces.
- [ ] P4-028 Implement `ensureStopped` that waits for command completion and records forced-stop use separately.
- [ ] P4-029 Implement `ensureArchived` only for stopped container workspaces that support archive.
- [ ] P4-030 Implement `ensureDeleted` as an idempotent terminal operation.
- [ ] P4-031 Persist the OpenHands conversation ID and profile name with the workspace lease.
- [ ] P4-032 After a cold restore, verify Agent Server state and conversation availability before attempting a follow-up
      turn.
- [ ] P4-033 If conversation state cannot resume, preserve the workspace and start a new conversation with a generated
      recovery summary rather than silently losing context.
- [ ] P4-034 Refresh or disable Daytona inactivity timers while orchestrated work is active.
- [ ] P4-035 Add retention policy fields for successful, failed, blocked, cancelled, and published runs.

### 3.4 Artifact persistence

- [ ] P4-036 Introduce an `ArtifactStore` interface with put, get, stat, list, and delete operations.
- [ ] P4-037 Implement a local filesystem artifact store for this phase.
- [ ] P4-038 Write artifacts under immutable run/role/attempt prefixes.
- [ ] P4-039 Verify content digests on write and read.
- [ ] P4-040 Store patches, context bundles, command logs, role results, and provider diagnostics through the interface.
- [ ] P4-041 Keep artifact URIs and metadata in PostgreSQL rather than binary payloads.
- [ ] P4-042 Add retention cleanup that deletes only artifacts owned by terminal expired runs.
- [ ] P4-043 Test partial writes, digest mismatch, duplicate writes, and missing artifacts.

### 3.5 Concurrency controls

- [ ] P4-044 Add global, organization, repository, and workflow-role concurrency settings.
- [ ] P4-045 Set the initial global active-workspace limit to ten.
- [ ] P4-046 Add a queue state for runnable work that cannot yet obtain a workspace slot.
- [ ] P4-047 Acquire a concurrency lease transactionally before creating or starting a sandbox.
- [ ] P4-048 Release the lease after stop, delete, cancellation, or terminal provider failure.
- [ ] P4-049 Prevent two active coding workspaces from owning the same branch name.
- [ ] P4-050 Generate unique context and artifact prefixes for every role attempt.
- [ ] P4-051 Add per-run cancellation tokens and propagate cancellation to active OpenHands requests and Daytona
      commands.
- [ ] P4-052 Add a watchdog that detects expired leases and verifies provider state before reclaiming capacity.

### 3.6 Recovery and reconciliation

- [ ] P4-053 Implement a reconciler that loads non-terminal workflow runs in bounded pages.
- [ ] P4-054 Compare checkpoint workspace state with Daytona state.
- [ ] P4-055 Compare publication state with the actual GitHub branch and draft PR.
- [ ] P4-056 Resume the graph only after external state has been normalized into a typed reconciliation result.
- [ ] P4-057 Mark missing but expected workspaces as `workspace_lost` and retain all available evidence.
- [ ] P4-058 Identify unowned Daytona sandboxes by labels and place them in a quarantine report before deletion.
- [ ] P4-059 Reconcile active command timeouts without starting duplicate agent turns.
- [ ] P4-060 Emit metrics for recovered runs, stale leases, orphaned workspaces, and reconciliation failures.

### 3.7 Failure-injection tests

- [ ] P4-061 Terminate the orchestrator after sandbox creation but before the checkpointed next node, then restart and
      verify no duplicate sandbox is created.
- [ ] P4-062 Terminate during OpenHands execution and verify the system resolves the existing conversation or records a
      typed recovery failure.
- [ ] P4-063 Terminate after branch push but before PR state is recorded and verify reconciliation finds or creates only
      one PR.
- [ ] P4-064 Stop and archive a successful sandbox, restore it, and verify repository SHA, uncommitted state, and
      artifacts remain intact.
- [ ] P4-065 Simulate an unavailable Daytona API and verify retries are bounded and durable.
- [ ] P4-066 Simulate PostgreSQL loss during a node and verify no uncheckpointed success is claimed.
- [ ] P4-067 Launch ten isolated fixture assignments concurrently and verify the eleventh queues.
- [ ] P4-068 Verify all ten runs use unique sandboxes, branches, conversations, and artifact prefixes.
- [ ] P4-069 Cancel one of ten runs and verify its capacity is released without affecting the others.
- [ ] P4-070 Measure peak disk, memory, CPU, startup time, restore time, and API rate-limit behavior during the
      concurrency trial.

## 4. Acceptance criteria

1. A workflow resumes after orchestrator process restart without duplicating its sandbox, branch, or PR.
2. A stopped or archived Daytona workspace can be restored with its repository state intact.
3. Conversation loss is detected and handled explicitly rather than hidden.
4. Ten runs execute concurrently with isolated state; an eleventh waits.
5. Cancellation and failure release concurrency leases deterministically.
6. Reconciliation detects orphaned, missing, and externally completed resources.
7. Artifact digests remain valid across process and workspace restarts.
8. Failure-injection and concurrency tests pass with retained evidence.

## 5. Non-goals

- New agent roles or changes to the Phase 3 role contracts.
- Webhook ingestion.
- Azure infrastructure.
- Multi-provider workspace scheduling.
- Automatic merging or approval workflows.

## 6. Completion evidence

Retain migration output, state-machine tests, recovery logs, the ten-run concurrency report, resource measurements,
orphan detection output, and links showing that external resources were not duplicated across injected failures.
