# Wait Node Review

Status: Design review

Last reviewed: 2026-07-20

This review covers `wait@1`, including authoring, durable suspension, event acceptance, timeout, evidence, and inspected
tests. No tests or browser acceptance were executed for this documentation-only review.

## Identity and intended job

| Attribute | Current value |
| --- | --- |
| Registry kind | `wait` |
| Display label | Wait |
| Version and release | Version 1, phase 7 |
| Category and execution | Action, control execution, no mutation |
| Capability | None |
| Intended job | Suspend a run durably until one correlated JSON event arrives or the wait expires. |

The user mental model should be: "Pause here until an authenticated event from this source matches this business key;
then continue through Resumed, Timeout, or Error." The current model is closer to an operator-managed journal record:
the author writes a correlation template and schema, and any pending wait is presented with a manual Resume action.

## Current contract

### Configuration and ports

The registry in `apps/agentic/src/workflows/stepRegistry.ts` requires:

| Field | Current contract |
| --- | --- |
| `correlation` | Non-empty string rendered from optional context with the Markdown-template helper. Default: `event:{{id}}`. |
| `expiresAfterSeconds` | Positive integer. Editor default: 3600 seconds. |
| `eventSchema` | JSON Schema for the resume event. Default: open object. |

`context` is an optional open-object input. `event` is an open-object output. There is no Timeout output, source
binding, authentication policy, consuming policy control, collision preview, or Error outcome visible in the manifest.
Expiry always becomes a terminal run failure in the current journal path.

The wait record schema already includes `authorization`, `consuming`, expiry, status, and winning event sequence.
However, the inspected dispatcher does not populate authorization, and the public resume service accepts only run ID,
correlation key, and event JSON.

### Compiler validation

The generic compiler validates config shape, port compatibility, and mappings. It does not validate correlation fields
against the upstream context schema, prove uniqueness, require source authentication, bind an ingress route, or ensure
that timeout is handled. A raw template can therefore compile while referring to a missing field and later render a
weak or colliding key.

## Authoring experience

`WaitInspector` in `apps/web/src/routes/WorkflowEditorInspector.tsx` presents a raw correlation template, numeric
seconds, and raw JSON Schema. The canvas card does not label Context or Event and does not summarize source, expiry,
schema, or security. The default open schema and template look complete even though neither establishes a trustworthy
external ingress contract.

There is no source picker, field picker, generated callback endpoint, authorization selection, sample-event validator,
collision preview, human-readable duration control, or visible timeout branch. The author cannot tell whether this node
is intended for a webhook, approval, polling signal, child run, or an operator override.

Run detail lists pending waits and exposes Resume for all of them. The dialog accepts event JSON, but the action is not
distinguished as a privileged operational override and the reviewed service contract contains no source credential.

## Runtime, persistence, and evidence

The dispatcher resolves input, renders `correlation` against `context`, calculates expiry, and calls
`suspendAttempt()`. That journal method transactionally:

- fences and transitions the attempt to waiting;
- marks the activation waiting;
- creates the wait with accepted input schema and expiry;
- records `attempt.waiting`;
- sets the run to waiting.

`resumeWait()` transactionally claims one pending, unexpired wait, validates the event against the persisted schema,
marks the wait resumed, succeeds the attempt and activation, derives downstream activations, records `wait.resumed`,
and updates run state. The unique `(runId, correlationKey)` index and winning sequence support one consuming winner per
run and key.

`timeoutWait()` transactionally marks the wait timed out, fails the attempt and activation, records timeout evidence,
and terminally fails the run with `wait_timed_out`. The author cannot route or recover from this expected temporal
outcome. `failWait()` similarly cancels the wait and fails the parent path.

The existing webhook router in `apps/agentic/src/webhooks/router.ts` serves a different control-plane workflow path and
does not resume these workflow waits. No reviewed ingress path verifies a provider signature, resolves a source-bound
wait, applies replay policy, and supplies authorization to `resumeWait()`.

Run detail retains correlation, schema, status, expiry, winning sequence, attempts, errors, data, and journal events.
It does not clearly show event source, authentication result, rejected deliveries, payload digest, collision namespace,
or timeout as a routeable node outcome.

Durable waiting itself does not depend on a worker lease once suspension commits, which is a strong recovery property.
The critical recovery races are event versus timeout, duplicate delivery, crash during ingress, and a resume transaction
that completes while the delivery acknowledgement is lost. The transactional claim is a good foundation, but the full
authenticated ingress and replay behavior is not present in the inspected product path.

## Validation, tests, and gaps

Executor and journal tests cover suspension, schema-validated resume, duplicate-safe claim behavior, timeout, failure,
and child-internal waits. Editor tests cover correlation and expiry persistence. Run-detail tests cover the generic
manual Resume interaction.

The inspected suite does not establish:

- an authenticated external event path into a Wait node;
- authorization persistence or enforcement;
- correlation field discovery, missing fields, weak keys, or collisions across multiple waits;
- deterministic event-versus-timeout boundary behavior through the real ingress;
- rejected-event evidence for schema, authentication, expiry, and duplicates;
- a routable Timeout outcome or retry policy;
- payload-size, rate, replay, and abuse limits;
- accessible end-to-end source configuration and sample validation.

## Behavior matrix

| Scenario | Current behavior | Target behavior |
| --- | --- | --- |
| Valid wait starts | Atomically persists wait, attempt, activation, event, and waiting run state. | Preserve this transaction and show a source-bound subscription summary. |
| Matching valid event | Claims the wait once, validates schema, succeeds activation, and schedules downstream work atomically. | Also authenticate source, retain delivery evidence, and emit Resumed. |
| Event violates schema | Resume rejects before successful transition. | Record a redacted rejection with issue paths; leave wait pending when policy allows. |
| Wrong correlation key | No matching pending wait is resumed. | Return a non-disclosing ingress response and retain rate-limited audit evidence. |
| Duplicate event | Only one pending wait can win. | Preserve idempotency by delivery ID/digest and show duplicate disposition. |
| Event and timeout race | Transactional predicates choose a winner in store methods. | Prove the real dispatcher/ingress race and record one authoritative outcome. |
| Expiry | Terminally fails the entire run. | Emit Timeout with elapsed and deadline metadata; fail only if that outcome is explicitly unhandled. |
| Manual resume | Available for every pending wait with event JSON. | Treat as an authorized, audited override that is disabled or permission-gated by default. |
| Unauthorized event | No source authorization is enforced by the reviewed resume API. | Reject before correlation resolution and never expose whether a key exists. |
| Restart while waiting | Persisted wait remains available independently of a worker. | Preserve behavior and reconcile any claimed-but-unacknowledged ingress delivery idempotently. |

## Expert judgments

### Competitive Expert

n8n Wait supports time and webhook-style resumption, generates a per-execution resume URL, offers authentication
options, validates limits, and distinguishes waiting behavior in the execution. Power Automate normalizes long-lived
workflow waits as a first-class platform behavior, although this review did not use it as evidence for Agency's exact
webhook contract. Make's fetched Sleep documentation was a placeholder, so no unsupported feature comparison is made.
Agency's transactional suspension and schema-validated single winner are competitive strengths. The missing layer is a
secure, productized ingress contract and explicit Timeout outcome.

### UX Expert

Correlation is currently an expert implementation detail presented as the primary task. The basic flow should start
with "Wait for" and a source/event picker, then derive available fields, callback instructions, authentication, and
schema. Correlation should be built from visible field chips and tested against a sample. Duration should use a
unit-aware control. Resumed and Timeout ports must be labeled on the canvas.

### User Researcher

Trust depends on answering "What can wake this run?", "Who sent the event?", "What happens if it never arrives?", and
"Can the same event resume twice?" Current persistence can answer when a wait was created and won, but not source
identity or rejected attempts. A generic Resume button may be useful in incidents, but without an override label,
permission boundary, and audit reason it undermines confidence in normal automation.

## Findings

### P0

1. **Resume is not source-authenticated.** The persisted `authorization` field is nullable and unused by the reviewed
   dispatcher/service path; resume accepts correlation and event JSON without a source credential.
2. **Timeout is an unrouteable terminal failure.** Expiry always fails the run even though timeout is an expected
   business outcome for approvals, callbacks, and external processing.
3. **No complete external ingress owns matching and replay.** The existing webhook router does not connect to workflow
   waits, leaving signature verification, source scope, delivery idempotency, and abuse controls undefined.

### P1

1. **Correlation authoring is unsafe and undiscoverable.** Raw Markdown templating has no schema picker, missing-field
   validation, entropy guidance, namespace preview, or collision check.
2. **The event contract defaults open.** An unrestricted object schema makes accidental or malicious payload acceptance
   more likely and provides no useful downstream field discovery.
3. **Operational evidence omits rejected deliveries and authentication.** Users cannot audit why an event did or did
   not resume a run.
4. **Manual Resume is too broad.** Every pending wait presents the action without a node-authored override policy in the
   reviewed surface.

### P2

1. The card does not summarize source, correlation fields, deadline, or latest wait state.
2. The inspector lacks a human-readable duration editor, sample event, and generated integration instructions.

## Recommended target contract

### Ports and outcomes

- Optional input `Context<C>`: schema-propagated values used for source subscription and correlation.
- Outcome `Resumed<E>`: the validated event plus delivery metadata allowed by the source policy.
- Outcome `Timeout`: `{ deadline, elapsedSeconds, correlationDigest, source }` without secret correlation material.
- Standard `Error`: source configuration, subscription, persistence, schema, or scheduler faults.

Authentication failures, unknown correlations, and duplicate deliveries are ingress dispositions, not workflow output
ports. They must not disclose wait existence to the sender.

### Configuration and safe defaults

- `source`: required source/connection and event selection, or an explicitly selected platform callback source.
- `correlation`: schema-aware expression built from source and context fields.
- `eventSchema`: generated from the selected source, closed by default, editable under Advanced.
- `timeout`: required, unit-aware, default 1 hour, bounded by platform retention and source limits.
- `consuming`: true by default; non-consuming subscriptions require a different multi-event node contract.
- `authorization`: derived from sealed source binding and never entered as a secret in the workflow definition.
- `manualOverride`: disabled by default or restricted to an explicit operator policy.
- Payload byte limit, delivery rate limit, and replay window must be platform-enforced.

Generate an unguessable per-wait callback token when a generic callback source is selected. Persist only a digest where
possible, combine it with source scope, and rotate or invalidate it after the wait resolves.

### Card and inspector

The card should show immutable **Wait**, editable Title, selected source/event, correlation field summary, deadline, and
latest status. Named Resumed and Timeout ports must remain visible.

The inspector should offer source and event pickers, available context fields, correlation chips, generated callback
instructions, authentication summary, duration controls, sample-event validation, output preview, and collision or weak
key warnings. Advanced may show raw schema, callback policy, and redacted correlation digest.

### Testing and evidence

Isolated testing should create an ephemeral test wait and support Send sample event through the same authentication,
decode, matching, schema, and replay path as production, with a safe local substitute for external providers.

Run detail should show source, event type, created/deadline/resumed timestamps, redacted correlation digest, winning
delivery ID and payload digest, schema result, authorization result, rejected and duplicate counts, timeout outcome, and
manual override actor/reason. Sensitive payload fields must follow evidence classification and retention policy.

## Fix checklist

- [ ] **P0: Build one authenticated wait-ingress contract.** Acceptance: supported sources verify identity before
      lookup, bind deliveries to sealed source scope, enforce rate/payload limits, and resume through the journal's
      transactional claim.
- [ ] **P0: Populate and enforce wait authorization.** Acceptance: authorization is derived from a sealed binding,
      stored or referenced safely, checked on every external resume, and covered by wrong-source and revoked-source tests.
- [ ] **P0: Add Resumed, Timeout, and Error outcomes.** Acceptance: expiry no longer unconditionally fails the run;
      unhandled Timeout behavior is explicit at compile or policy time and each outcome has journal evidence.
- [ ] **P0: Prove event, duplicate, and timeout races.** Acceptance: end-to-end tests through real ingress produce one
      winner, idempotent acknowledgements, no double downstream activation, and deterministic loser evidence.
- [ ] **P1: Replace raw correlation with the common expression builder.** Acceptance: only available typed fields are
      selectable, sample resolution is previewed, missing fields fail compile, and weak or colliding keys warn or fail.
- [ ] **P1: Generate closed event schemas from sources.** Acceptance: downstream fields autocomplete and schema issues
      retain paths without exposing sensitive values.
- [ ] **P1: Govern manual override.** Acceptance: the action is permission-gated, clearly labeled, requires a reason,
      uses the same schema validation, and records actor, reason, and event digest.
- [ ] **P1: Add ingress audit evidence.** Acceptance: accepted, rejected, duplicate, expired, and unauthorized deliveries
      have redacted, rate-limited evidence linked to the wait without leaking correlation secrets.
- [ ] **P2: Improve card, duration, and integration guidance.** Acceptance: source, deadline, status, and outcomes are
      scannable and a user can configure a callback without editing raw JSON or a template string.

## Dependencies and open decisions

Shared dependencies are sealed source bindings, the common schema/expression system, standard expected outcomes,
authorization and permission infrastructure, ingress delivery journaling, secret-safe evidence, retention limits, and
node-centered run detail.

Open product decisions:

- Which sources are first-class in version 1: generic signed callback, provider event, approval, message, or all.
- Whether generic callbacks use a generated URL, a stable workflow endpoint plus token, or provider-managed subscription.
- Whether an unconnected Timeout output fails publish or applies a node-level default action.
- Which roles may manually resume and whether production workflows can disable override entirely.
- How late events are acknowledged and retained after timeout or cancellation.
- Whether multi-event waits belong in a separate subscription/stream node rather than `consuming: false` here.

## Source map

- Registry and manifest: `apps/agentic/src/workflows/stepRegistry.ts`
- Compiler: `apps/agentic/src/workflows/compiler.ts`
- Dispatcher suspension: `apps/agentic/src/workflows/workflowExecutor.ts`
- Wait transactions: `apps/agentic/src/persistence/workflowJournalStore.ts`
- Wait schema: `apps/agentic/src/persistence/schema.ts`
- Resume service: `apps/agentic/src/workflows/service.ts`
- Separate webhook path: `apps/agentic/src/webhooks/router.ts`
- Editor and inspector: `apps/web/src/routes/WorkflowEditorPage.tsx`,
  `apps/web/src/routes/WorkflowEditorInspector.tsx`
- Run evidence: `apps/web/src/routes/RunDetailPage.tsx`
- Focused tests: `workflowExecutor.test.ts`, `workflowJournalStore.test.ts`, `WorkflowEditorPage.test.tsx`,
  `RunDetailPage.test.tsx`
