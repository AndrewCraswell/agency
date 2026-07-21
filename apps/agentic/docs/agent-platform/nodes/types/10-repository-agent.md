# Repository Agent Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Kind | `repository_agent` |
| Version and phase | Version 1, Phase 4 |
| Category | AI |
| Execution class | Workspace |
| Mutation policy | None |
| Capabilities | `repository.read`, `workspace.create` |
| Registry ports | Required `context` object in; required `result` object out |
| Registered error | Generic `{ code, message, retryable? }` object |

The node runs a repository-hosted `.agent.md` definition in an isolated Daytona workspace through OpenHands. It can
modify a detached checkout and return a patch, but it does not push or otherwise mutate the external repository, so
`mutationPolicy: none` is accurate only for external effects. Workspace creation, model spend, command execution, and
temporary repository mutation are still consequential effects that need explicit policy and evidence.

Primary evidence: [repositoryAgents.ts](../../../../src/workflows/repositoryAgents.ts),
[repositoryAgentExecutor.ts](../../../../src/workflows/repositoryAgentExecutor.ts), and
[runner.ts](../../../../src/prototype/runner.ts).

## Job and mental model

The intended job is: run one publication-approved repository specialist against an immutable commit in an isolated,
bounded workspace, validate its work, and return reviewable evidence. Authors should think in terms of delegated work
with a declared change envelope, not an unrestricted chat prompt.

The current editor presents only agent selection and supplemental instructions. The actual contract also includes
allowed and forbidden paths, validation commands, token/turn/time budgets, requested tools/model, workspace lifecycle,
artifact production, and post-run policy enforcement. Hiding those controls makes the node appear safer and simpler
than it is.

## Current contract

### Agent discovery and publication snapshot

Discovery uses a sealed GitHub repository resource, resolves the requested ref to a commit, walks at most 10,000 tree
entries, finds at most 100 `.github/**/*.agent.md` files, and limits each definition to 131,072 bytes. The parser accepts
only name, description, model, and tools frontmatter. A reference records connection/resource identity, ref, commit SHA,
blob SHA, content digest, source URL, metadata, and requested model/tools.

Validation, publication, and draft testing resolve the blob by SHA, verify the content digest and metadata, parse it,
and seal the complete snapshot in the execution package. The compiler requires exactly referenced snapshots and rejects
unreferenced ones. This is a strong provenance baseline.

### Runtime-only configuration

The registry declares only `agentReference` and optional `instructions`. The executor additionally accepts these hidden
fields because its schema is passthrough:

| Field | Default | Runtime bound |
| --- | --- | --- |
| `validationCommands` | `git diff --check` | 1-20 commands; each timeout at most 3,600,000 ms |
| `allowedPaths` | `**/*` | 1-100 patterns |
| `forbiddenPaths` | `.git/**` | 0-100 patterns |
| `budgets.maxTurns` | 40 | 1-200 |
| `budgets.maxTokens` | 100,000 | 1,000-1,000,000 |
| `budgets.maxElapsedMs` | 1,800,000 | 60,000-3,600,000 |

The assignment pins the base commit to the agent snapshot's observed commit, derives a deterministic role-execution ID
from activation/attempt, hashes the input context bundle, and sets zero repair attempts. The objective concatenates
instructions or description with serialized context, then silently truncates the combined string at 50,000 characters.

### Output and failure

On completion, `result` includes status, base/resulting commit SHAs, changed files, patch artifact path, compact
workspace identity, command status, worker usage, artifact descriptors, and failure. Any worker status other than
`completed` is thrown as a generic step failure. Failure details, classification, retryability, partial patch,
validation output, metrics, and workspace identity are therefore not committed to the attempt output.

The workflow-level failure policy does not automatically retry. Operator retry creates another attempt and another
workspace. There is no workspace-effect reservation or idempotency record preventing duplicate model spend.

## Authoring experience

The inspector shows the workflow repository, discovers agents on demand at `HEAD` unless a current reference supplies a
ref, selects an immutable content digest, displays description/observed commit/source link, and edits instructions. It
does not expose effective tools/model, base commit policy, paths, commands, budgets, workspace resources, cost estimate,
timeout, retention, cancellation, or output shape.

The card shows editable title, AI category, generic description, and unlabeled handles. Registry `ui.fields` is empty;
all useful controls and defaults are hard-coded in editor and executor. The editor cannot preview the complete effective
assignment that will be sent to the worker.

## Runtime, workspace safety, persistence, and evidence

The worker checks repository identity against an allowlist, creates an isolated Daytona workspace, clones the approved
repository, fetches and checks out the pinned commit, verifies a clean checkout, uploads a digest-verified read-only
context bundle, configures OpenHands, runs the agent, executes validation commands, and collects status/diff/patch
artifacts. Workspaces are stopped after execution, retained for one day, and expire after seven days.

There are material enforcement gaps:

- effective model and tools are included in the system prompt, but this path does not demonstrate hard enforcement of
  the selected model/tool allowlist by the OpenHands profile;
- path policy is evaluated only after the agent and validation commands finish, so it detects but does not prevent
  out-of-scope writes during execution;
- the default allowed path is the entire checkout;
- workflow cancellation is not passed as an abort signal through the repository-agent executor in this dispatch path;
- progress is written to process stdout rather than journaled as durable node progress;
- the worker image is identified by the string `openhands-agent-server-pinned`, not an image digest in the package.

On success, compact worker evidence is persisted inside generic attempt output. Artifact descriptors are not emitted as
workflow artifact data records, so run detail cannot reliably link them through the common artifact model. On failure,
the dispatcher persists only generic error code/message. The workspace itself is an effect, but it is not journaled in
the workflow effect ledger or reconciled after an unknown outcome.

The source agent and base commit are reproducible. Full execution is not: platform model selection, provider routing,
worker image semantics, OpenHands implementation, and executable node code are not immutably identified; model sampling
can vary; and a retry creates a fresh workspace.

## Validation, tests, and gaps

Tests cover parsing/discovery bounds and content verification, compiler snapshot pinning, service resolution and
deduplication, one successful executor assignment, missing snapshot failure, worker repository allowlisting, context
digests, path-policy matching, validation, and workspace lifecycle. Editor tests cover discovery, immutable selection,
empty state, error state, source link, and draft persistence.

Important gaps:

- no executor tests for hidden defaults, invalid policy, objective truncation, worker failure preservation, cancellation,
  timeout, duplicate dispatch, or artifact registration;
- no proof that requested tools/model are enforced rather than narrated;
- no workflow-level test for out-of-policy changes, failed validation, partial artifacts, or unknown workspace outcome;
- no cost preflight or failed-attempt usage accounting;
- no isolated safe mock/fixture mode for authoring tests;
- no browser evidence for guardrail authoring, progress, cancellation, diff review, artifact access, or recovery.

Per the documentation-only task, no tests or browser verification were run for this review.

## Behavior matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid run | Pinned checkout, isolated worker, validation, compact result | Preview assignment; stream durable progress; return typed result and linked artifacts |
| Missing snapshot | Compilation/runtime fails closed | Keep failure and offer Refresh agent reference before publish |
| Agent content changes | Resolution rejects digest mismatch | Show immutable old/new diff and require explicit re-selection |
| Empty context | Runs with `{}` context | Validate against an optional declared context schema and show rendered assignment |
| Oversized context/objective | Serialized objective is sliced at 50,000 characters | Fail preflight or use a bounded artifact manifest; never silently truncate |
| Broad path policy | Defaults to `**/*` | Default to no writes or explicitly selected paths based on agent role |
| Forbidden edit | Detected after execution | Prevent where possible; always fail with preserved patch and policy evidence |
| Validation failure | Worker returns failure; executor discards compact result | Preserve command/artifact/usage evidence and route Failed validation |
| Worker timeout | Worker failure becomes generic `step_failed` | Typed Timeout outcome with workspace cleanup/reconciliation evidence |
| Cancellation | Journal can cancel while worker has no propagated signal | Abort model/workspace work, stop workspace, and journal final disposition |
| Retry | Fresh workspace and repeated spend | Show retry impact; reuse immutable inputs; use effect reservation/reconciliation |
| Unknown worker outcome | No workspace effect state | Record workspace dispatch and reconcile before another attempt |

## Expert judgments

### Competitive Expert

n8n, Make, and Power Automate usually expose AI actions as connector operations and often lack a first-class isolated
repository workspace. Agency's durable, pinned workspace is a meaningful differentiator. That advantage is lost unless
guardrails, progress, cancellation, artifacts, and retry semantics are visible and enforced like first-class action
policy rather than hidden executor options.

### UX Expert

Agent selection is a good first step, but the inspector omits the choices that determine blast radius. A task-oriented
layout should cover Objective, Scope, Validation, Budget, and Execution policy, followed by a read-only Effective agent
section. The card needs repository/commit, agent, write scope, validation count, and budget badges.

### User Researcher

Users will ask whether the agent can push, what it may change, how much it can spend, what stopped it, and where the
patch and command logs are. They need to inspect failed work, not just successful work. Safe fixtures and dry runs are
essential because a full draft test creates a real paid workspace and model call.

## Findings

### P0

1. **Authorable guardrails are missing.** Broad path, command, and budget defaults execute without editor visibility.
   Promote them into one authoritative contract and require explicit review before publish/test.
2. **Policy is detect-after-write and tool/model restrictions are not proven enforceable.** Enforce capabilities at the
   worker boundary and constrain writes during execution where the workspace engine permits it.
3. **Failure destroys the useful workflow result.** Preserve worker classification, retryability, workspace identity,
   usage, command results, changed files, patch, and artifacts even when the node fails.
4. **Cancellation and unknown workspace outcomes are unsafe.** Propagate cancellation and journal workspace dispatch,
   cleanup, and reconciliation before allowing retry.

### P1

1. Replace silent objective truncation with explicit bounded context/artifact contracts.
2. Register patch, logs, status, diff stat, final response, and validation outputs as common workflow artifacts.
3. Pin actual worker image, profile, model policy, and executable implementation identity.
4. Add model/workspace cost preflight and durable usage for successful and failed attempts.
5. Publish a stable result schema with explicit Completed, Blocked, Validation failed, Policy violation, Timeout, and
   Cancelled outcomes.

### P2

1. Add role presets such as read-only review, bounded edit, and implementation.
2. Add inline diff preview, command summaries, progress timeline, and workspace expiration controls.
3. Support reusable deterministic worker fixtures for authoring and regression tests.

## Target design

### Ports and configuration

- Input: typed `context`, optionally with a declared schema and artifact references.
- Outputs: `completed` typed result, `blocked`, `validationFailed`, `policyViolation`, `timeout`, and standard `error`.
- Basic config: immutable agent reference, objective/instructions, read-only versus edit mode, allowed paths, validation
  plan, maximum elapsed time, token/turn budget, and cleanup policy.
- Advanced config: forbidden paths, command working directories/timeouts, tool/model policy, workspace resources,
  retention, retry/reconciliation, context limits, and raw immutable snapshot.

### Card and inspector

The card retains `Repository agent`, selected agent, repository plus commit, read-only/edit badge, path scope, validation
count, and maximum time/token budget. The inspector previews the exact effective assignment and highlights differences
between agent-requested and platform-approved tools/model. Latest-run tabs show progress, diff, validations, artifacts,
usage/cost, workspace, and recovery actions.

### Testing, evidence, and safe defaults

- Default to read-only. Editing requires explicit allowed paths; never default editable runs to `**/*`.
- Default to a shorter bounded time/token budget and one non-mutating validation; require explicit expansion.
- Isolated tests use a deterministic fake worker and pinned result fixture by default. A clearly labeled live test shows
  workspace and estimated model cost before dispatch.
- Persist assignment digest, agent/content/commit digest, worker image/profile digest, effective model/tools, context
  digest, progress, workspace effect state, commands, patch/artifacts, usage/cost, and cleanup/reconciliation.

## Fix checklist

- [ ] Move paths, validation, budgets, model/tools, cleanup, and context limits into the canonical node manifest.
  Acceptance: registry, compiler, inspector, package, and executor expose and validate the same fields and defaults.
- [ ] Make read-only the default and require explicit edit scope.
  Acceptance: a new node cannot modify files until at least one allowed path is selected and confirmed.
- [ ] Enforce effective model/tools and write policy at the worker boundary.
  Acceptance: disallowed tool/model requests and out-of-scope writes are blocked or fail with deterministic evidence.
- [ ] Propagate cancellation and journal the workspace lifecycle as a reconcilable effect.
  Acceptance: cancellation stops active work, records cleanup state, and prevents unsafe redispatch after unknown outcome.
- [ ] Preserve typed failure results and artifacts.
  Acceptance: every terminal worker status retains classification, retryability, workspace, usage, commands, changed
  files, and linked artifacts in run detail.
- [ ] Eliminate silent objective truncation.
  Acceptance: over-limit context fails preflight with measured limits or is supplied through verified artifacts.
- [ ] Pin executable and environment identity.
  Acceptance: package/run evidence includes immutable worker image, profile, executor, agent content, and base commit
  digests.
- [ ] Add safe node tests and cost preflight.
  Acceptance: fixture mode performs no workspace/model call; live mode states maximum budget and requires confirmation.
- [ ] Build guardrail authoring and result inspection.
  Acceptance: desktop/mobile keyboard workflows can configure scope, test safely, monitor/cancel, inspect diff/evidence,
  and recover from every typed outcome.

## Shared dependencies and open decisions

Shared dependencies: canonical manifests, standard expected outcomes, retry/timeout/cancellation enforcement, workspace
effect journaling, common artifacts, executable digests, cost preflight, isolated fixtures, and inline latest-run evidence.

Open decisions:

- Is this node read-only by default with a separate edit mode, or should review and implementation be separate node
  operations/types?
- Which tool/model declarations are requests versus enforceable platform policy, and how are conflicts resolved?
- Can workspace file-system policy prevent writes, or must Agency use snapshots/rollback plus post-run detection?
- What workspace retention is appropriate for sensitive repositories, failures, and operator recovery?
- Which outcomes are routable business outcomes versus execution faults, and when is an operator retry safe?