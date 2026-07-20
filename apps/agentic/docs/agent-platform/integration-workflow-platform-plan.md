# Integration Workflow Platform Plan

Status: Authoritative backlog and acceptance plan

Last reviewed: 2026-07-20

This is the only engineering roadmap for the agent platform. It records work that remains. Delivered requirements
belong in code, tests, migrations, and API contracts instead of additional planning documents.

The [workflow editor plan](workflow-editor-plan.md) is the designer-owned working specification for authoring and run
experience. Engineering must preserve its contracts and coordinate before changing its owned surfaces.

## Product target

Agency connects to external services through provider-neutral capabilities, stores mutable workflow drafts and immutable
published versions in PostgreSQL, and executes published graphs from a journal-authoritative runtime. Nango owns
authorization and credential transport. Agency owns provider behavior, workflow semantics, scheduling, execution, and
run evidence.

The local product milestone is complete when a real Linear event starts a published workflow, a repository agent works
in an isolated GitHub workspace, configured provider actions complete safely, and the complete run remains diagnosable
after a controlled process restart.

## Fixed decisions

- PostgreSQL journal records are authoritative for runs, activations, attempts, effects, waits, events, and selected
  outputs. Checkpoints and UI state are projections.
- Published execution packages are immutable. Draft changes cannot alter published triggers or historical runs.
- Workflows use typed ports and explicit mappings. Steps receive only their declared input projection.
- Nango stores and refreshes provider credentials. Credentials never enter Agency workflow records or run evidence.
- GitHub is the first repository provider, Linear is the first task provider, OpenRouter supplies direct model inference,
  Daytona supplies isolated workspaces, and LangGraph remains the selected orchestrator.
- Resources are bound where needed. Connecting an integration does not select a global repository, team, or project.
- Provider mutations use stable effect identities. Unknown outcomes block automatic retry until reconciled.
- Loops, fan-out, joins, retries, waits, and child workflows are bounded and deterministic.
- Human approval and arbitrary model tools remain out of scope until their authorization and durable-resume contracts
  are designed and accepted.
- Local end-to-end acceptance precedes additional Azure deployment work.

## Current position

The repository contains substantial implementation for integrations, workflow drafts and versions, compilation,
journaled execution, provider/model/repository-agent steps, orchestration controls, the React Flow editor, and run
operations. That breadth is not phase completion. Clean-database, immutable-trigger, durable scheduling, generic restart,
real-provider, and browser acceptance gates remain open.

Work should proceed through the milestones below. A later milestone may be developed behind disabled gates, but it is
not accepted until the preceding milestone's evidence exists.

## Milestone 1: stabilize persistence and publication

1. Repair migration `0011_early_sabretooth.sql`, which currently contains incomplete and misplaced workflow run event
   DDL.
2. Add a clean PostgreSQL migration test that applies the full migration chain and exercises workflow persistence.
3. Align workflow creation contracts so name-only and repository-free drafts are valid. Require repository, team, model,
   or provider bindings only when a selected step needs them.
4. Add an integrated API test covering create, update with revision checks, validate, publish, reload, and version
   immutability.
5. Resolve webhook and schedule triggers from the published execution package, never mutable draft steps.
6. Prove that editing a draft cannot change a published trigger, resource snapshot, agent snapshot, model snapshot, or
   historical graph.

Exit gate: a clean database can create and publish a repository-free workflow, and later draft edits do not alter the
published package or its trigger behavior.

## Milestone 2: complete provider-neutral product boundaries

1. Introduce explicit repository and task provider ports resolved by connection and capability.
2. Route repository discovery and task operations through those ports without exposing Nango details.
3. Remove remaining fixed repository, Linear team, and fixed-role assumptions from the generic workflow path.
4. Add provider-fixture contract tests proving a second adapter can implement each capability without changing workflow
   contracts.
5. Provide the API required for a provider-neutral Taskboard: resource selection, URL-backed filters, pagination, task
   details, updates, comments, stale data, and disconnected behavior.
6. Run bounded live read and mutation proofs against dedicated GitHub and Linear test resources.

Exit gate: generic repository and task APIs work without provider-specific client knowledge, and real GitHub and Linear
operations satisfy the same contracts as fixtures.

## Milestone 3: finish durable generic execution

1. Advance generic published workflows through the selected LangGraph/checkpoint boundary rather than a separate
   process-local dispatcher.
2. Apply configured bounded retries, durable next-attempt times, cancellation generations, lease fencing, and recovery
   to every executable step family.
3. Coordinate checkpoint cursors with journal commits so a checkpoint cannot independently claim completion.
4. Stream ordered persisted run events to clients with resumable sequence cursors.
5. Reconstruct run projections after browser refresh and process restart without invoking providers, models, agents, or
   effects.
6. Add failure-injection tests around activation claim, attempt completion, effect dispatch, wait resume, child creation,
   and checkpoint advancement.

Exit gate: a manual multi-step workflow survives termination at each commit boundary without duplicate work, lost
output, or changed history.

## Milestone 4: make events and schedules durable

1. Persist each verified Nango delivery before acknowledgment with a stable identity, payload digest, processing state,
   and redacted evidence reference.
2. Normalize GitHub pull request events and Linear task/comment events asynchronously through provider-owned catalogs.
3. Match published trigger bindings deterministically and start at most one run for each delivery, workflow version, and
   trigger binding.
4. Quarantine identity reuse with a different payload digest.
5. Replace browser-owned schedule timers with persisted interval and CRON fires, timezone handling, overlap policy,
   misfire policy, transactional claims, and restart reconciliation.
6. Reconcile missed, stale, or partially processed deliveries and schedule fires.
7. Prove request handlers return before long-running workflow work begins.

Exit gate: duplicate real deliveries start one run, due schedules survive restart, and reconciliation repairs one
intentionally missed event and one interrupted schedule fire.

## Milestone 5: local product acceptance

1. Start PostgreSQL and required local services from a clean checkout with one documented command.
2. Connect dedicated GitHub and Linear accounts through Nango and bind one repository and one team.
3. Publish a bounded Linear-triggered implementation and review workflow.
4. Execute repository-agent, model, GitHub action, and Linear action steps using the sealed published package.
5. Terminate the process during the run and prove recovery from persisted state.
6. Diagnose the complete run from trigger through terminal outcome, including attempts, mappings, artifacts, effects,
   waits, provider evidence, and usage.
7. Repeat the scenario from a clean local start and inject one provider or agent failure.
8. Retain sanitized evidence with correlation IDs, package digest, commit SHA, provider resources, and terminal result.

Exit gate: the complete path succeeds twice and the retained evidence explains both the successful run and the injected
failure without relying on process memory or secret-bearing logs.

## Designer coordination boundary

The designer currently owns workflow and run presentation work, including:

- Workflows list, visual canvas, ordered outline, settings surfaces, Add step, mappings, and validation navigation.
- Undo/redo, keyboard authoring, focus recovery, responsive behavior, and accessibility acceptance.
- Step configuration UX for repository agents, models, provider operations, and orchestration controls.
- Immutable run graph/outline projection, event history, artifacts, retry/resume/cancel flows, and operator messaging.
- Taskboard information architecture and interface after engineering provides stable provider-neutral APIs.

Engineering work should stay in migrations, stores, provider ports, API contracts, compiler/runtime behavior, scheduling,
webhook processing, and executable acceptance tests. Prefer additive API changes while designer work is active. Coordinate
before renaming step kinds, removing response fields, changing draft shapes, or editing the workflow editor and run page.

## Cross-cutting acceptance

Every milestone must include:

- Focused unit and contract tests followed by `pnpm verify`.
- Runtime validation for persisted and external data.
- Idempotency and failure-injection coverage for side effects.
- Secret redaction and bounded payload, artifact, collection, retry, and execution limits.
- Correlation between delivery, workflow version, package, run, activation, attempt, provider call, workspace, and
  evidence.
- Real-service proof for the external boundary being accepted. Mocks alone do not complete a milestone.
- Integrated browser acceptance for changed customer workflows at desktop and mobile sizes unless the user explicitly
  waives it for that release.

## Deferred runtime decisions

Cloud transition remains deferred until local product acceptance passes. Do not begin new Azure deployment work from
this plan alone.

- Retain LangGraph unless a Microsoft-hosted orchestrator proves equivalent journal authority, deterministic routing,
  cancellation, idempotency, replay, and recovery.
- Retain OpenHands unless another agent runtime proves equivalent workspace, structured-result, evidence, budget, and
  repair behavior.
- Retain Daytona unless an Azure workspace provider proves equivalent isolation, filesystem persistence, command
  transport, stop/resume, recovery, concurrency, and measured cost.
- Decide hosted versus self-hosted Nango from security and operational evidence after the local milestone.