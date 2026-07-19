# Phase 5: Webhook Automation

Status: Proposed

Depends on: [Phase 4](phase-4-specialized-agent-chain.md)

Produces: Authenticated, idempotent webhook ingestion that starts or resumes workflows asynchronously, plus scheduled
reconciliation that repairs missed or out-of-order events.

## 1. Objective

Replace manual CLI invocation with event-driven operation while preserving the durable graph as the workflow authority.
The HTTP request path must verify, persist, normalize, enqueue, and acknowledge an event quickly. It must never run an
agent, wait for LangGraph completion, or trust webhook text as control-plane policy.

## 2. Components

```text
agent-platform/apps/
|-- webhook-api/
|   |-- src/server.ts
|   |-- src/routes/github-webhook.ts
|   |-- src/security/verify-github-signature.ts
|   `-- src/normalize/github-event.ts
|-- orchestrator/
|   |-- src/dispatcher.ts
|   `-- src/event-router.ts
`-- reconciler/
    |-- src/reconcile-github.ts
    |-- src/reconcile-workflows.ts
    `-- src/scheduler.ts
```

## 3. Event model

Initially support an explicit allowlist of GitHub App webhook events:

| Event           | Action                                        | Behavior                                                           |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `issues`        | configured assignment label added             | Create a workflow if policy accepts the issue.                     |
| `issue_comment` | configured command on an eligible issue or PR | Normalize a command request; never execute arbitrary comment text. |
| `pull_request`  | synchronized or closed                        | Resume or cancel a related workflow when ownership matches.        |
| `check_suite`   | completed                                     | Resume a workflow waiting for independent remote checks.           |
| `check_run`     | completed                                     | Update check evidence and resume if the required set is complete.  |
| `installation`  | created, deleted, suspended, unsuspended      | Update installation eligibility; do not start coding work.         |

All unsupported events are retained according to policy and acknowledged without workflow creation.

## 4. Granular implementation tasks

### 4.1 HTTP service foundation

- [ ] P5-001 Create a Fastify TypeScript application with strict schema validation.
- [ ] P5-002 Add `/health/live`, `/health/ready`, and `/metrics` endpoints without exposing secrets or repository data.
- [ ] P5-003 Configure an exact request-body size limit before reading webhook payloads.
- [ ] P5-004 Capture the raw request bytes required for signature verification before JSON parsing.
- [ ] P5-005 Reject unsupported content types and malformed JSON with bounded error bodies.
- [ ] P5-006 Generate or propagate a request correlation ID for every delivery.
- [ ] P5-007 Add structured logs with provider, delivery ID, event, action, repository, and disposition.
- [ ] P5-008 Redact authorization, cookies, signatures, raw comment bodies, and secret-bearing URLs.

### 4.2 GitHub authentication

- [ ] P5-009 Read the webhook secret from an environment-backed secret provider abstraction.
- [ ] P5-010 Verify `X-Hub-Signature-256` with HMAC-SHA256 over the exact raw body.
- [ ] P5-011 Compare signatures with a constant-time operation.
- [ ] P5-012 Reject missing, malformed, or invalid signatures before parsing event semantics.
- [ ] P5-013 Validate `X-GitHub-Event` and `X-GitHub-Delivery` header format.
- [ ] P5-014 Add a timestamp-based operational alert for unusually old deliveries while relying on delivery IDs for
      replay handling.
- [ ] P5-015 Add test vectors for valid, invalid, truncated, altered, and oversized signed payloads.

### 4.3 Durable inbox

- [ ] P5-016 Create a `webhook_deliveries` table with provider delivery ID as a unique key.
- [ ] P5-017 Store event name, action, installation, repository, received time, signature disposition, payload digest,
      raw artifact URI, normalized artifact URI, processing status, and last error.
- [ ] P5-018 Persist the raw payload in the artifact store before acknowledging an accepted delivery.
- [ ] P5-019 Verify the stored raw payload digest.
- [ ] P5-020 Insert the inbox row and dispatch marker transactionally.
- [ ] P5-021 Return a success response for a duplicate valid delivery without dispatching it twice.
- [ ] P5-022 Return a retriable server response if durable persistence fails.
- [ ] P5-023 Define inbox statuses for received, normalized, dispatched, ignored, failed, and quarantined.
- [ ] P5-024 Add retention policies that preserve security and workflow evidence while expiring unneeded raw payloads.

### 4.4 Event normalization

- [ ] P5-025 Implement `WebhookEnvelopeSchema` in the shared contracts package.
- [ ] P5-026 Normalize each supported event through a dedicated function with typed input fixtures.
- [ ] P5-027 Copy only required identifiers and bounded text into the normalized envelope.
- [ ] P5-028 Mark issue titles, bodies, comments, PR bodies, review text, and external check output as untrusted text.
- [ ] P5-029 Resolve repository installation and allowlist policy before creating a workflow command.
- [ ] P5-030 Resolve actor type and reject bot loops, self-generated events, suspended installations, and untrusted fork
      requests.
- [ ] P5-031 Parse configured comment commands with a strict grammar rather than natural-language intent classification.
- [ ] P5-032 Map each normalized event to `create`, `resume`, `cancel`, `record_evidence`, or `ignore`.
- [ ] P5-033 Persist the normalized envelope and its digest before dispatch.

### 4.5 Workflow correlation and dispatch

- [ ] P5-034 Define a deterministic correlation key from installation, repository, source work item, and workflow
      generation.
- [ ] P5-035 Store source issue, PR, branch, and check identifiers in `workflow_runs`.
- [ ] P5-036 Serialize workflow creation under the correlation key to prevent duplicate runs.
- [ ] P5-037 Verify that a resume event belongs to the same repository and owned branch as the workflow.
- [ ] P5-038 Enqueue the delivery ID for asynchronous processing after the inbox transaction commits.
- [ ] P5-039 Implement a dispatcher that claims inbox rows with a lease and bounded retry policy.
- [ ] P5-040 Pass normalized envelope references, not raw payload bodies, into LangGraph state.
- [ ] P5-041 Record the delivery-to-thread relationship before invoking the graph.
- [ ] P5-042 Mark dispatch complete only after LangGraph has checkpointed the event receipt.
- [ ] P5-043 Ensure repeated dispatch after process failure is idempotent.

### 4.6 Trigger and resume policy

- [ ] P5-044 Define eligible issue states, required labels, allowed organizations, allowed repositories, and
      source-actor policy in typed configuration.
- [ ] P5-045 Resolve the issue's current state and base branch from GitHub at dispatch time rather than trusting only
      webhook payload state.
- [ ] P5-046 Refuse new work for deleted, archived, disabled, or suspended installations.
- [ ] P5-047 Refuse commands that target branches or PRs not owned by the correlated workflow.
- [ ] P5-048 Route eligible new assignments through `normalizeWorkItem` in the Phase 4 graph.
- [ ] P5-049 Route check completions to a deterministic node that evaluates the required check set.
- [ ] P5-050 Route PR closure to cancellation and workspace retention policy.
- [ ] P5-051 Treat force-push or external candidate-branch mutation as a typed ownership conflict.
- [ ] P5-052 Prevent the platform's own issue comments, PR edits, and check updates from retriggering the same action.

### 4.7 Reconciliation

- [ ] P5-053 Create a scheduled reconciler independent from webhook request handling.
- [ ] P5-054 Page through non-terminal workflows and compare their recorded issue, PR, branch, and check state with
      GitHub.
- [ ] P5-055 Page through inbox rows stuck in received, normalized, or dispatched states beyond configured deadlines.
- [ ] P5-056 Redispatch safe unprocessed deliveries using their existing delivery IDs.
- [ ] P5-057 Synthesize a versioned reconciliation event when GitHub state changed without an observed webhook.
- [ ] P5-058 Ensure synthesized events use a separate deterministic identifier namespace.
- [ ] P5-059 Detect deleted branches, closed PRs, superseded commits, and missing required checks.
- [ ] P5-060 Detect workflows whose published commit differs from the current owned branch head.
- [ ] P5-061 Quarantine ambiguous ownership conflicts instead of overwriting external work.
- [ ] P5-062 Emit metrics for delivery lag, duplicates, rejected signatures, dispatch retries, synthesized events, and
      reconciliation drift.

### 4.8 Abuse, rate, and failure controls

- [ ] P5-063 Add per-installation and per-repository request-rate limits after signature verification.
- [ ] P5-064 Add workflow-creation quotas and retain the Phase 3 global concurrency limit.
- [ ] P5-065 Bound retry counts and route exhausted deliveries to quarantine with evidence.
- [ ] P5-066 Implement graceful shutdown that stops accepting traffic and releases inbox leases safely.
- [ ] P5-067 Return acknowledgment within the configured latency target without waiting for graph work.
- [ ] P5-068 Alert on sustained invalid-signature traffic, inbox backlog, dispatch failures, and reconciliation drift.

### 4.9 Tests and live proof

- [ ] P5-069 Unit test signature verification with exact raw bytes.
- [ ] P5-070 Unit test normalization for every supported and ignored event/action pair.
- [ ] P5-071 Test duplicate delivery IDs produce one inbox item and one graph receipt.
- [ ] P5-072 Test two simultaneous assignment-label events create one correlated workflow.
- [ ] P5-073 Test a self-generated bot comment is ignored.
- [ ] P5-074 Test an untrusted fork event cannot start privileged work.
- [ ] P5-075 Test a webhook persistence failure returns a retriable response and creates no dispatch.
- [ ] P5-076 Terminate the dispatcher after graph receipt and verify replay does not apply the event twice.
- [ ] P5-077 Delete a test webhook delivery from the ingestion path, change GitHub state, and verify reconciliation
      synthesizes the missing transition.
- [ ] P5-078 Run a live GitHub App delivery from assignment label through draft PR update.
- [ ] P5-079 Verify the webhook HTTP response precedes workspace provisioning and agent execution.
- [ ] P5-080 Verify all delivery, graph, workspace, trace, commit, and PR identifiers can be correlated.

## 5. Acceptance criteria

1. Invalid signatures never reach event normalization or workflow dispatch.
2. Accepted webhook payloads are durably stored before acknowledgment.
3. Duplicate and concurrently delivered events produce one graph event application.
4. Request handlers return without waiting for agent work.
5. Strict policy blocks self-trigger loops, untrusted forks, and unsupported commands.
6. Reconciliation repairs at least one intentionally missed event.
7. Every external event can be correlated to graph and publication evidence.
8. Focused security, idempotency, failure-injection, and live webhook tests pass.

## 6. Non-goals

- Natural-language command interpretation from comments.
- Arbitrary webhook providers beyond GitHub.
- Human approval or merge authorization.
- Azure deployment.
- Replacing reconciliation with assumptions about webhook delivery guarantees.

## 7. Completion evidence

Retain sanitized webhook fixtures, signature test output, inbox and dispatch records, duplicate-delivery proof,
missed-event reconciliation proof, latency measurements, security rejection evidence, and a live event-to-draft-PR
trace.
