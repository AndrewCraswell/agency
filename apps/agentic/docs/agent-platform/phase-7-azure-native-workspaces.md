# Phase 7: Azure-Native Workspaces

Status: Optional, gated by feasibility and operating-cost evidence

Depends on: [Phase 6](phase-6-azure-control-plane.md)

Produces: An `AgentWorkspace` implementation hosted on Azure, selected only when it matches the required isolation,
persistence, resume, startup, concurrency, security, and cost behavior without changing LangGraph role contracts.

## 1. Objective

Determine whether replacing Daytona is justified and feasible, then implement the smallest Azure-native workspace
runtime that passes the existing provider contract. This phase begins with a disposable proof. It must not commit the
system to AKS, Container Apps Jobs, or a persistent-volume design before the proof measures their actual constraints.

## 2. Entry gate

Do not begin implementation unless at least one recorded driver exists:

- Daytona cost exceeds the agreed workload threshold.
- Required data residency or network control cannot be met with Daytona.
- Daytona reliability, quota, or startup behavior fails Phase 6 objectives.
- Operating a workspace runtime is strategically required and has an assigned owner.

If no driver exists, retain Daytona and mark this phase deferred.

## 3. Candidate runtimes

Evaluate in this order:

1. Azure Container Apps Jobs with a workspace persisted independently in Azure Files or Blob-backed snapshots.
2. Azure Kubernetes Service Jobs or Pods with per-workspace persistent volume claims when live filesystem reattachment
   or stronger scheduling control is required.

The candidate must support an OpenHands Agent Server process, outbound GitHub and model access, controlled command
execution, durable repository state, and a secure control channel. It must not expose the Agent Server publicly.

## 4. Architecture constraint

LangGraph calls only `AgentWorkspace`. Provider-specific scheduling, credentials, volume attachment, command transport,
and lifecycle details stay inside `AzureWorkspace`. Graph state stores a serializable `WorkspaceHandle` whose provider
discriminator is `azure`.

## 5. Granular implementation tasks

### 5.1 Feasibility spike

- [ ] P7-001 Record the entry driver, target workload, security constraints, success thresholds, time box, and maximum
      experiment spend.
- [ ] P7-002 Pin the OpenHands Agent Server image already proven in Daytona.
- [ ] P7-003 Build a minimal TypeScript probe that creates one Azure worker execution without LangGraph integration.
- [ ] P7-004 Provide a private control endpoint or queue-command channel from the orchestrator to the worker.
- [ ] P7-005 Start OpenHands Agent Server in the worker and verify health from the control path.
- [ ] P7-006 Clone one fixture repository at an immutable SHA.
- [ ] P7-007 Run one no-op agent request and one bounded repair request.
- [ ] P7-008 Stop the execution while preserving repository and OpenHands state.
- [ ] P7-009 Recreate or resume compute, reattach or restore the workspace, and verify Git, untracked files, context,
      and conversation state.
- [ ] P7-010 Measure cold start, warm resume, snapshot, restore, stop, and delete times.
- [ ] P7-011 Measure CPU, memory, storage transactions, network egress, and per-hour retained-workspace cost.
- [ ] P7-012 Attempt ten concurrent isolated workspaces and record quota, scheduling, mount, and startup behavior.
- [ ] P7-013 Test process termination, node loss where applicable, control-channel loss, and partial snapshot failure.
- [ ] P7-014 Record whether Container Apps Jobs satisfies every threshold or which concrete limitation requires AKS
      evaluation.
- [ ] P7-015 Stop the phase and retain Daytona if neither candidate passes the spike thresholds within the time box.

### 5.2 Runtime decision record

- [ ] P7-016 Compare Daytona, Container Apps Jobs, and AKS against startup, resume, isolation, persistence, concurrency,
      operations, security, and monthly cost criteria.
- [ ] P7-017 Identify which component is authoritative for live filesystem state and which is authoritative for archived
      snapshots.
- [ ] P7-018 Define failure domains and recovery behavior for compute, volume, registry, network, and regional service
      loss.
- [ ] P7-019 Estimate ongoing patching, scaling, incident-response, and platform-engineering labor.
- [ ] P7-020 Select one runtime or formally defer the phase.
- [ ] P7-021 Approve no graph, role contract, or webhook contract changes as part of the provider decision.

### 5.3 Azure worker image

- [ ] P7-022 Create a dedicated worker image from a pinned base and pinned OpenHands Agent Server image or package.
- [ ] P7-023 Include Git, required language toolchains, certificate roots, a non-root user, and a TypeScript worker
      bootstrap.
- [ ] P7-024 Keep repository-specific dependencies out of the base image unless measured startup data justifies a
      versioned cache layer.
- [ ] P7-025 Add an init step that validates workspace identity, mount ownership, and assignment digest.
- [ ] P7-026 Start Agent Server only after the repository and immutable context bundle are ready.
- [ ] P7-027 Add readiness that proves command transport and Agent Server health, not only process existence.
- [ ] P7-028 Add graceful termination that rejects new commands, waits within a bound, flushes evidence, and checkpoints
      workspace metadata.
- [ ] P7-029 Scan the image and publish it to ACR by immutable digest.

### 5.4 Workspace persistence

- [ ] P7-030 Allocate a unique storage identity and namespace for every workspace.
- [ ] P7-031 Use a filesystem suitable for repository metadata, executable bits, symlinks, rename semantics, file
      locking, and expected small-file workloads.
- [ ] P7-032 Benchmark Git status, checkout, dependency install, test, and patch operations against the chosen storage.
- [ ] P7-033 Keep context bundles read-only and separate from writable repository state.
- [ ] P7-034 Store large immutable logs and patches in Blob Storage rather than on the live filesystem alone.
- [ ] P7-035 Define `stop` as compute removal with workspace state preserved.
- [ ] P7-036 Define `archive` as a verified immutable snapshot or bundle plus digest, not merely a stopped process.
- [ ] P7-037 Define `restore` to create compute, attach or hydrate state, verify digests, and start Agent Server.
- [ ] P7-038 Define `destroy` to remove compute, live storage, snapshots, network endpoints, identities, and leases
      idempotently.
- [ ] P7-039 Verify workspace state after every snapshot and restore using Git SHA, status digest, selected file
      digests, and manifest version.
- [ ] P7-040 Add retention and garbage collection for live volumes, snapshots, and abandoned partial resources.

### 5.5 Private control channel

- [ ] P7-041 Keep each Agent Server endpoint private to the Azure network.
- [ ] P7-042 Give each workspace a unique short-lived control credential or workload identity.
- [ ] P7-043 Authenticate every start, command, upload, download, stop, archive, and delete operation.
- [ ] P7-044 Bind commands to workspace ID, run ID, role attempt, assignment digest, and expiry.
- [ ] P7-045 Prevent command replay with operation IDs and persisted idempotency records.
- [ ] P7-046 Limit command payload size and store large inputs in Blob Storage with digest verification.
- [ ] P7-047 Return bounded command summaries and immutable artifact references.
- [ ] P7-048 Encrypt traffic in transit and verify service identity.
- [ ] P7-049 Record control-plane operations without logging command secrets, source content, or credentials.

### 5.6 AzureWorkspace adapter

- [ ] P7-050 Implement `AzureWorkspace` against the Phase 2 `AgentWorkspace` interface.
- [ ] P7-051 Map Azure resource identifiers into the existing serializable `WorkspaceHandle` schema.
- [ ] P7-052 Implement idempotent `create` using run and role labels plus persisted operation IDs.
- [ ] P7-053 Implement `start` and wait for verified worker readiness.
- [ ] P7-054 Implement structured command execution with working directory, environment references, timeout,
      cancellation, and exit evidence.
- [ ] P7-055 Implement binary-safe upload and download through the selected control or Blob path.
- [ ] P7-056 Implement `stop`, `archive`, and `destroy` against the lifecycle definitions.
- [ ] P7-057 Translate Azure API, scheduling, storage, image, identity, timeout, and quota failures into
      provider-neutral typed failures.
- [ ] P7-058 Preserve provider diagnostics as artifacts without leaking credentials.
- [ ] P7-059 Add retries only for operations proven idempotent by an operation ID or observed resource state.

### 5.7 Isolation and security

- [ ] P7-060 Assign distinct compute and writable storage to each active workspace.
- [ ] P7-061 Use a non-root runtime and remove unnecessary Linux capabilities.
- [ ] P7-062 Apply CPU, memory, process, disk, execution-time, and network limits.
- [ ] P7-063 Restrict outbound network access to approved GitHub, package, model, artifact, and telemetry endpoints
      where technically practical.
- [ ] P7-064 Block Azure Instance Metadata Service access unless a scoped workload identity requires it.
- [ ] P7-065 Ensure one workspace cannot list, attach, read, or delete another workspace's storage or compute.
- [ ] P7-066 Keep GitHub and model credentials short-lived or brokered and out of persistent workspace files.
- [ ] P7-067 Scan retained artifacts and logs for known secret formats before long-term storage.
- [ ] P7-068 Produce a threat model covering malicious repository code, dependency scripts, lateral movement,
      control-channel replay, storage crossover, and resource exhaustion.

### 5.8 Scheduling and capacity

- [ ] P7-069 Reuse the Phase 3 global concurrency lease as the admission-control authority.
- [ ] P7-070 Add Azure subscription, regional CPU, IP, volume, node, and job quota checks before admission.
- [ ] P7-071 Queue work when no compliant capacity is available.
- [ ] P7-072 Cap runtime autoscaling to ten active workspaces initially.
- [ ] P7-073 Pre-provision no idle worker compute unless measured startup objectives require a bounded warm pool.
- [ ] P7-074 Ensure stopped workspaces consume storage but no worker CPU or memory.
- [ ] P7-075 Add metrics for queue time, scheduling time, image pull, mount or hydrate, Agent Server readiness, and
      provider failures.

### 5.9 Contract, recovery, and parity tests

- [ ] P7-076 Run the complete `AgentWorkspace` contract suite unchanged against Daytona and Azure.
- [ ] P7-077 Test duplicate create, start, stop, archive, restore, and destroy requests.
- [ ] P7-078 Test orchestrator termination during each lifecycle operation and reconcile from observed Azure state.
- [ ] P7-079 Test worker termination during command execution and classify result without claiming completion.
- [ ] P7-080 Test storage detachment or snapshot failure and retain recoverable evidence.
- [ ] P7-081 Test cross-workspace filesystem and control-channel access is denied.
- [ ] P7-082 Run the Phase 1 no-op, repair, and blocked fixtures unchanged.
- [ ] P7-083 Run the Phase 4 approved, repaired, and exhausted workflows unchanged.
- [ ] P7-084 Run ten concurrent workflows and verify the eleventh queues.
- [ ] P7-085 Compare patch, validation, conversation-recovery, startup, completion, and failure outcomes with Daytona
      baselines.
- [ ] P7-086 Run a soak test long enough to exercise scheduled stop, archive, restore, secret rotation, and garbage
      collection.

### 5.10 Provider rollout and rollback

- [ ] P7-087 Add a typed workspace-provider configuration that defaults to Daytona.
- [ ] P7-088 Select the provider when a workflow is created and persist it for that workflow's lifetime.
- [ ] P7-089 Do not switch a live workflow between providers unless a separate migration design has been validated.
- [ ] P7-090 Run Azure workspaces for internal fixture repositories before production repositories.
- [ ] P7-091 Add a percentage or repository allowlist rollout gate.
- [ ] P7-092 Compare reliability, latency, completion rate, intervention rate, and cost during the trial.
- [ ] P7-093 Keep Daytona credentials and adapter operational throughout the rollback window.
- [ ] P7-094 Roll back new workflows to Daytona when Azure error, latency, isolation, or cost thresholds are breached.
- [ ] P7-095 Reconcile and retain already active Azure workflows rather than abandoning them during rollback.
- [ ] P7-096 Remove the Daytona dependency only through a later explicit decision after the rollback window and
      retention obligations expire.

### 5.11 Operations

- [ ] P7-097 Create dashboards for Azure workspace lifecycle, capacity, storage, Agent Server health, command execution,
      failures, and cost.
- [ ] P7-098 Alert on orphaned compute, unattached live volumes, failed snapshots, stale leases, capacity exhaustion,
      control-channel errors, and cross-workspace access denials.
- [ ] P7-099 Write runbooks for workspace recovery, forced stop, archive restore, node or job failure, leaked credential
      response, quota exhaustion, and garbage-collection repair.
- [ ] P7-100 Assign ownership for base-image updates, OpenHands upgrades, cluster or job runtime patching, storage
      integrity, and incident response.
- [ ] P7-101 Measure fully loaded monthly platform cost, including engineering operations, rather than comparing compute
      prices alone.

## 6. Acceptance criteria

1. The entry gate and runtime decision are documented with measured evidence.
2. `AzureWorkspace` passes the same provider contract tests as Daytona.
3. A stopped workspace can resume with verified repository, context, and conversation state or a typed
   conversation-recovery path.
4. Ten workspaces run concurrently with unique compute, storage, identity, conversation, branch, and artifact state.
5. Cross-workspace access and public Agent Server access are denied.
6. Existing Phase 4 workflows run without graph or role-contract changes.
7. Lifecycle interruption, capacity, persistence, and soak tests pass.
8. Rollout can return new workflows to Daytona without losing active workflow state.
9. Measured reliability, startup, recovery, security, operations, and cost meet the recorded thresholds.

## 7. Non-goals

- Rewriting OpenHands.
- Changing LangGraph role semantics to accommodate the provider.
- Migrating an in-progress workspace between Daytona and Azure without a separate proven design.
- Multi-region workspace replication.
- Automatic merge or human-approval workflows.

## 8. Completion evidence

Retain the feasibility report, decision record, provider contract output, threat model, image digests, lifecycle and
isolation evidence, ten-run and soak reports, cost comparison, dashboards, runbooks, rollout metrics, and rollback
proof. If the phase is deferred, retain the measured failed thresholds and the decision to continue using Daytona.
