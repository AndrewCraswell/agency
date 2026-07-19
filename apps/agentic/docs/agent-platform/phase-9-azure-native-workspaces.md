# Phase 9: Azure-Native Workspaces

Status: Deferred on 2026-07-19; no qualifying Azure workspace entry driver

Depends on: [Phase 8](phase-8-microsoft-hosted-agent-runtime.md)

Produces: An `AgentWorkspace` implementation hosted on Azure, selected only when it matches the required isolation,
persistence, resume, startup, concurrency, security, and cost behavior without changing orchestration or role contracts.

## Decision record

Decision code: `no-qualifying-azure-workspace-entry-driver`

No measured Daytona cost, residency, network-control, reliability, quota, startup, or strategic-ownership condition
meets the entry gate below. Daytona SDK 0.196.0 remains the workspace provider and no Azure workspace spike is
authorized.

The persisted runtime selector records Daytona for each workflow and rejects `WORKSPACE_PROVIDER=azure` at startup. This
prevents an implicit provider switch while preserving the provider-neutral handle schema for a future evidence-backed
spike. Reopen this phase only after recording a qualifying driver, owner, thresholds, time box, and experiment budget.
This formal deferral satisfies the optional provider decision; it is not Azure workspace parity evidence.

## 1. Objective

Determine whether replacing Daytona is justified and feasible, then implement the smallest Azure-native workspace
runtime that passes the existing provider contract. This phase begins with a disposable proof. It must not commit the
system to AKS, Container Apps Jobs, or a persistent-volume design before the proof measures their actual constraints.

## 2. Entry gate

Do not begin implementation unless at least one recorded driver exists:

- Daytona cost exceeds the agreed workload threshold.
- Required data residency or network control cannot be met with Daytona.
- Daytona reliability, quota, or startup behavior fails the measured Phase 7 and Phase 8 production objectives.
- Operating a workspace runtime is strategically required and has an assigned owner.

If no driver exists, retain Daytona and mark this phase deferred.

## 3. Candidate runtimes

Evaluate in this order:

1. Azure Container Apps Jobs with a workspace persisted independently in Azure Files or Blob-backed snapshots.
2. Azure Kubernetes Service Jobs or Pods with per-workspace persistent volume claims when live filesystem reattachment
   or stronger scheduling control is required.

The candidate must support controlled command execution, durable repository state, a secure control channel, and any
workspace-resident service required by the active Phase 8 agent runtime. It must not expose workspace control or agent
endpoints publicly.

## 4. Architecture constraint

The active orchestration runtime calls only `AgentWorkspace`. Provider-specific scheduling, credentials, volume
attachment, command transport, and lifecycle details stay inside `AzureWorkspace`. Workflow state stores a serializable
`WorkspaceHandle` whose provider discriminator is `azure`.

## 5. Granular implementation tasks

### 5.1 Feasibility spike

- [ ] P9-001 Record the entry driver, target workload, security constraints, success thresholds, time box, and maximum
      experiment spend.
- [ ] P9-002 Pin the worker image, workspace bootstrap, and any workspace-resident agent service already proven with
      Daytona.
- [ ] P9-003 Build a minimal TypeScript probe that creates one Azure worker execution without orchestration integration.
- [ ] P9-004 Provide a private control endpoint or queue-command channel from the orchestrator to the worker.
- [ ] P9-005 Start the worker control service and any configured agent service, then verify health from the control
      path.
- [ ] P9-006 Clone one fixture repository at an immutable SHA.
- [ ] P9-007 Run one no-op agent request and one bounded repair request.
- [ ] P9-008 Stop the execution while preserving repository and workspace-resident runtime state.
- [ ] P9-009 Recreate or resume compute, reattach or restore the workspace, and verify Git, untracked files, context,
      and the active role runtime's continuation state.
- [ ] P9-010 Measure cold start, warm resume, snapshot, restore, stop, and delete times.
- [ ] P9-011 Measure CPU, memory, storage transactions, network egress, and per-hour retained-workspace cost.
- [ ] P9-012 Attempt ten concurrent isolated workspaces and record quota, scheduling, mount, and startup behavior.
- [ ] P9-013 Test process termination, node loss where applicable, control-channel loss, and partial snapshot failure.
- [ ] P9-014 Record whether Container Apps Jobs satisfies every threshold or which concrete limitation requires AKS
      evaluation.
- [ ] P9-015 Stop the phase and retain Daytona if neither candidate passes the spike thresholds within the time box.

### 5.2 Runtime decision record

- [ ] P9-016 Compare Daytona, Container Apps Jobs, and AKS against startup, resume, isolation, persistence, concurrency,
      operations, security, and monthly cost criteria.
- [ ] P9-017 Identify which component is authoritative for live filesystem state and which is authoritative for archived
      snapshots.
- [ ] P9-018 Define failure domains and recovery behavior for compute, volume, registry, network, and regional service
      loss.
- [ ] P9-019 Estimate ongoing patching, scaling, incident-response, and platform-engineering labor.
- [x] P9-020 Select one runtime or formally defer the phase.
- [ ] P9-021 Approve no graph, role contract, or webhook contract changes as part of the provider decision.

### 5.3 Azure worker image

- [ ] P9-022 Create a dedicated worker image from a pinned base and the pinned services required by the active Phase 8
      runtime.
- [ ] P9-023 Include Git, required language toolchains, certificate roots, a non-root user, and a TypeScript worker
      bootstrap.
- [ ] P9-024 Keep repository-specific dependencies out of the base image unless measured startup data justifies a
      versioned cache layer.
- [ ] P9-025 Add an init step that validates workspace identity, mount ownership, and assignment digest.
- [ ] P9-026 Start any workspace-resident agent service only after the repository and immutable context bundle are
      ready.
- [ ] P9-027 Add readiness that proves command transport and configured agent-service health, not only process
      existence.
- [ ] P9-028 Add graceful termination that rejects new commands, waits within a bound, flushes evidence, and checkpoints
      workspace metadata.
- [ ] P9-029 Scan the image and publish it to ACR by immutable digest.

### 5.4 Workspace persistence

- [ ] P9-030 Allocate a unique storage identity and namespace for every workspace.
- [ ] P9-031 Use a filesystem suitable for repository metadata, executable bits, symlinks, rename semantics, file
      locking, and expected small-file workloads.
- [ ] P9-032 Benchmark Git status, checkout, dependency install, test, and patch operations against the chosen storage.
- [ ] P9-033 Keep context bundles read-only and separate from writable repository state.
- [ ] P9-034 Store large immutable logs and patches in Blob Storage rather than on the live filesystem alone.
- [ ] P9-035 Define `stop` as compute removal with workspace state preserved.
- [ ] P9-036 Define `archive` as a verified immutable snapshot or bundle plus digest, not merely a stopped process.
- [ ] P9-037 Define `restore` to create compute, attach or hydrate state, verify digests, and start required services.
- [ ] P9-038 Define `destroy` to remove compute, live storage, snapshots, network endpoints, identities, and leases
      idempotently.
- [ ] P9-039 Verify workspace state after every snapshot and restore using Git SHA, status digest, selected file
      digests, and manifest version.
- [ ] P9-040 Add retention and garbage collection for live volumes, snapshots, and abandoned partial resources.

### 5.5 Private control channel

- [ ] P9-041 Keep every workspace control and agent-service endpoint private to the Azure network.
- [ ] P9-042 Give each workspace a unique short-lived control credential or workload identity.
- [ ] P9-043 Authenticate every start, command, upload, download, stop, archive, and delete operation.
- [ ] P9-044 Bind commands to workspace ID, run ID, role attempt, assignment digest, and expiry.
- [ ] P9-045 Prevent command replay with operation IDs and persisted idempotency records.
- [ ] P9-046 Limit command payload size and store large inputs in Blob Storage with digest verification.
- [ ] P9-047 Return bounded command summaries and immutable artifact references.
- [ ] P9-048 Encrypt traffic in transit and verify service identity.
- [ ] P9-049 Record control-plane operations without logging command secrets, source content, or credentials.

### 5.6 AzureWorkspace adapter

- [ ] P9-050 Implement `AzureWorkspace` against the Phase 2 `AgentWorkspace` interface.
- [ ] P9-051 Map Azure resource identifiers into the existing serializable `WorkspaceHandle` schema.
- [ ] P9-052 Implement idempotent `create` using run and role labels plus persisted operation IDs.
- [ ] P9-053 Implement `start` and wait for verified worker readiness.
- [ ] P9-054 Implement structured command execution with working directory, environment references, timeout,
      cancellation, and exit evidence.
- [ ] P9-055 Implement binary-safe upload and download through the selected control or Blob path.
- [ ] P9-056 Implement `stop`, `archive`, and `destroy` against the lifecycle definitions.
- [ ] P9-057 Translate Azure API, scheduling, storage, image, identity, timeout, and quota failures into
      provider-neutral typed failures.
- [ ] P9-058 Preserve provider diagnostics as artifacts without leaking credentials.
- [ ] P9-059 Add retries only for operations proven idempotent by an operation ID or observed resource state.

### 5.7 Isolation and security

- [ ] P9-060 Assign distinct compute and writable storage to each active workspace.
- [ ] P9-061 Use a non-root runtime and remove unnecessary Linux capabilities.
- [ ] P9-062 Apply CPU, memory, process, disk, execution-time, and network limits.
- [ ] P9-063 Restrict outbound network access to approved GitHub, package, model, artifact, and telemetry endpoints
      where technically practical.
- [ ] P9-064 Block Azure Instance Metadata Service access unless a scoped workload identity requires it.
- [ ] P9-065 Ensure one workspace cannot list, attach, read, or delete another workspace's storage or compute.
- [ ] P9-066 Keep GitHub and model credentials short-lived or brokered and out of persistent workspace files.
- [ ] P9-067 Scan retained artifacts and logs for known secret formats before long-term storage.
- [ ] P9-068 Produce a threat model covering malicious repository code, dependency scripts, lateral movement,
      control-channel replay, storage crossover, and resource exhaustion.

### 5.8 Scheduling and capacity

- [ ] P9-069 Reuse the Phase 4 global concurrency lease as the admission-control authority.
- [ ] P9-070 Add Azure subscription, regional CPU, IP, volume, node, and job quota checks before admission.
- [ ] P9-071 Queue work when no compliant capacity is available.
- [ ] P9-072 Cap runtime autoscaling to ten active workspaces initially.
- [ ] P9-073 Pre-provision no idle worker compute unless measured startup objectives require a bounded warm pool.
- [ ] P9-074 Ensure stopped workspaces consume storage but no worker CPU or memory.
- [ ] P9-075 Add metrics for queue time, scheduling time, image pull, mount or hydrate, worker readiness, and provider
      failures.

### 5.9 Contract, recovery, and parity tests

- [ ] P9-076 Run the complete `AgentWorkspace` contract suite unchanged against Daytona and Azure.
- [ ] P9-077 Test duplicate create, start, stop, archive, restore, and destroy requests.
- [ ] P9-078 Test orchestrator termination during each lifecycle operation and reconcile from observed Azure state.
- [ ] P9-079 Test worker termination during command execution and classify result without claiming completion.
- [ ] P9-080 Test storage detachment or snapshot failure and retain recoverable evidence.
- [ ] P9-081 Test cross-workspace filesystem and control-channel access is denied.
- [ ] P9-082 Run the Phase 1 no-op, repair, and blocked fixtures unchanged.
- [ ] P9-083 Run the Phase 8 approved, repaired, exhausted, and webhook-triggered workflows unchanged.
- [ ] P9-084 Run ten concurrent workflows and verify the eleventh queues.
- [ ] P9-085 Compare patch, validation, role-runtime recovery, startup, completion, and failure outcomes with Daytona
      baselines.
- [ ] P9-086 Run a soak test long enough to exercise scheduled stop, archive, restore, secret rotation, and garbage
      collection.

### 5.10 Provider rollout and rollback

- [x] P9-087 Add a typed workspace-provider configuration that defaults to Daytona.
- [x] P9-088 Select the provider when a workflow is created and persist it for that workflow's lifetime.
- [x] P9-089 Do not switch a live workflow between providers unless a separate migration design has been validated.
- [ ] P9-090 Run Azure workspaces for internal fixture repositories before production repositories.
- [ ] P9-091 Add a percentage or repository allowlist rollout gate.
- [ ] P9-092 Compare reliability, latency, completion rate, intervention rate, and cost during the trial.
- [ ] P9-093 Keep Daytona credentials and adapter operational throughout the rollback window.
- [ ] P9-094 Roll back new workflows to Daytona when Azure error, latency, isolation, or cost thresholds are breached.
- [ ] P9-095 Reconcile and retain already active Azure workflows rather than abandoning them during rollback.
- [ ] P9-096 Remove the Daytona dependency only through a later explicit decision after the rollback window and
      retention obligations expire.

### 5.11 Operations

- [ ] P9-097 Create dashboards for Azure workspace lifecycle, capacity, storage, worker-service health, command
      execution, failures, and cost.
- [ ] P9-098 Alert on orphaned compute, unattached live volumes, failed snapshots, stale leases, capacity exhaustion,
      control-channel errors, and cross-workspace access denials.
- [ ] P9-099 Write runbooks for workspace recovery, forced stop, archive restore, node or job failure, leaked credential
      response, quota exhaustion, and garbage-collection repair.
- [ ] P9-100 Assign ownership for base-image updates, agent-runtime integration, cluster or job runtime patching,
      storage integrity, and incident response.
- [ ] P9-101 Measure fully loaded monthly platform cost, including engineering operations, rather than comparing compute
      prices alone.

## 6. Acceptance criteria

1. The entry gate and runtime decision are documented with measured evidence.
2. `AzureWorkspace` passes the same provider contract tests as Daytona.
3. A stopped workspace can resume with verified repository, context, and role-runtime continuation state or a typed
   recovery path.
4. Ten workspaces run concurrently with unique compute, storage, identity, role-execution, branch, and artifact state.
5. Cross-workspace access and public workspace control or agent-service access are denied.
6. Existing Phase 8 workflows run without orchestration, role, webhook, or publication contract changes.
7. Lifecycle interruption, capacity, persistence, and soak tests pass.
8. Rollout can return new workflows to Daytona without losing active workflow state.
9. Measured reliability, startup, recovery, security, operations, and cost meet the recorded thresholds.

## 7. Non-goals

- Rewriting or changing the active Phase 8 agent runtime.
- Changing orchestration or role semantics to accommodate the provider.
- Migrating an in-progress workspace between Daytona and Azure without a separate proven design.
- Multi-region workspace replication.
- Automatic merge or human-approval workflows.

## 8. Completion evidence

Retain the feasibility report, decision record, provider contract output, threat model, image digests, lifecycle and
isolation evidence, ten-run and soak reports, cost comparison, dashboards, runbooks, rollout metrics, and rollback
proof. If the phase is deferred, retain the measured failed thresholds and the decision to continue using Daytona.
