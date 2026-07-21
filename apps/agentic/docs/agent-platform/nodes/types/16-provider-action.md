# Provider Action Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Field | Current value |
| --- | --- |
| Kind | `provider_action` |
| Version | `1` |
| Phase | `6` |
| Category | Action |
| Execution class | Provider |
| Mutation policy | External effect |
| Capability | `provider.write` |
| Input port | `request`, one generic object |
| Output port | `result`, one generic object |

This node creates or updates one GitHub or Linear record. Its mental model should be: **Prepare one precisely described
external effect, preview it, obtain any required approval, dispatch it idempotently, and route confirmed, failed, or
indeterminate outcomes with durable evidence.** The registry definition is in
[stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L541-L559).

## Job And Mental Model

Provider actions are not ordinary function calls. A timeout can mean "did not happen" or "happened but the response was
lost." Retrying blindly may duplicate comments, labels, reviews, or records. Users therefore need an exact effect
preview, safe test substitute, approval policy, idempotency capability, blast-radius summary, and explicit unknown
outcome recovery.

Agency already models a durable logical effect and operator reconciliation, which is a strong foundation. The contract
is undermined by generic requests, live draft-test effects, no provider-boundary idempotency, and broken or missing
recovery transitions.

## Current Contract

### Catalog, Binding, And Compilation

- Config requires `provider`, `operation`, and a sealed `binding`; request/result remain generic objects
  ([stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L541-L559)).
- The provider catalog lists GitHub and Linear write operations with provider, mode, resource type, capability, and label,
  but no request/result schema, effect description, idempotency support, approval risk, error taxonomy, or semantic
  version ([providerCatalog.ts](../../../../src/workflows/providerCatalog.ts#L38-L216)).
- The compiler checks sealed identity, provider, write mode, resource type, and capability
  ([compiler.ts](../../../../src/workflows/compiler.ts#L632-L709)). It cannot validate the exact effect request or pin
  adapter semantics.
- Runtime rechecks connection health and exact non-stale resource identity before effect reservation
  ([providerExecutor.ts](../../../../src/workflows/providerExecutor.ts#L103-L148)).

### Effect Execution And Reconciliation

The current sequence is:

1. Resolve operation and resource.
2. Reserve one effect at logical slot `provider-action` with request digest and an Agency idempotency key.
3. Return a cached confirmed result for the same request.
4. Block unknown, conflict, failed, or in-progress effects.
5. Mark `dispatching`, call the provider adapter, then confirm result.
6. Classify every thrown error as `unknown` and fail the workflow attempt
   ([providerExecutor.ts](../../../../src/workflows/providerExecutor.ts#L55-L100)).

The effect table retains provider, request/digest, logical slot, attempt, idempotency key, status, result, reconciliation,
and timestamps. Uniqueness on run/activation/slot prevents duplicate Agency-side dispatch for a stable request.

Critical transition defects:

- A crash after `beginEffectDispatch()` leaves `dispatching` without lease, timeout, reconciler, or operator resolution.
  Retry is blocked as in progress.
- Operator **Absent** moves the effect to `resolved`. Reservation treats `resolved` as dispatchable, but
  `beginEffectDispatch()` accepts only `prepared`, so approved redispatch dead-ends
  ([workflowJournalStore.ts](../../../../src/persistence/workflowJournalStore.ts#L164-L187),
  [workflowJournalStore.ts](../../../../src/persistence/workflowJournalStore.ts#L1738-L1761)).
- The persisted idempotency key is not part of the provider transport request. It protects Agency retries but is not
  forwarded to providers that support idempotency.
- Adapter validation occurs after status becomes `dispatching`; deterministic malformed local input is caught as an
  ambiguous provider outcome.
- Linear GraphQL handling rejects top-level errors but does not reject mutation payloads with `success: false`
  ([providerExecutionAdapters.ts](../../../../src/integrations/providerExecutionAdapters.ts#L145-L217)).

### Persistence And Evidence

Run detail exposes effect request, digest, status, result, and reconciliation, and operators can resolve unknown/conflict
as occurred, absent, or indeterminate. This is more explicit than generic retry-only automation products.

However, reserve, dispatch, confirmation, and automatic failure transitions do not all produce corresponding journal
events. Evidence lacks operation semantic digest, effect preview accepted by the user/approver, provider request ID,
provider idempotency behavior, dispatch lease/attempt chronology, exact error classification, approval identity, and
reconciliation proof.

Configured step maximum attempts and failure-route mode are not automatically enforced for provider actions.

## Authoring And Test Experience

- A new node defaults to GitHub **Add pull request comment** and can inherit the workflow repository
  ([WorkflowEditorPage.tsx](../../../../../web/src/routes/WorkflowEditorPage.tsx#L162-L165)).
- The specialized inspector offers provider, operation, resource selection, and an unknown-outcome warning. It has no
  operation-specific request form, upstream field mapping, exact mutation preview, dry run, mock result, approval policy,
  idempotency statement, or blast-radius summary
  ([WorkflowEditorInspector.tsx](../../../../../web/src/routes/WorkflowEditorInspector.tsx#L1707-L1805)).
- Registry-driven `ui.fields` is empty. Card and outline omit provider, operation, target resource, effect risk, approval,
  and test mode.
- The browser warns **Start live draft test?**, but the test API accepts a normal request and starts an ordinary durable
  run with live adapters. Alternate clients can bypass the browser confirmation
  ([server.ts](../../../../src/controlPlane/server.ts#L220-L242),
  [service.ts](../../../../src/workflows/service.ts#L792-L840)).

## Behavior Matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid first action | Reserve, dispatch, confirm | Prevalidate, preview/approve, dispatch with typed evidence |
| Same request retried after confirmation | Returns cached result | Same, with explicit dedup evidence |
| Changed request for same logical slot | Marks conflict and blocks | Preview diff; require explicit supersede/reconciliation policy |
| Deterministic invalid request | Becomes `unknown` after dispatch begins | Fail validation before reservation/dispatch |
| Retryable provider failure before acceptance | Becomes `unknown` | Classify failed/retryable and back off safely |
| Lost response after provider acceptance | Becomes `unknown` | Reconcile by provider idempotency/read-back or operator evidence |
| Crash while `dispatching` | Permanently stranded | Lease expiry enters reconciliation, never blind retry |
| Operator says occurred | Confirms with optional result | Require evidence and resume downstream with normalized result |
| Operator says absent | Moves to `resolved`; redispatch fails | Return to a dispatchable prepared generation and audit decision |
| Operator says indeterminate | Remains blocked unknown | Keep blocked with escalation/abandon choices |
| Linear `success:false` | Can be treated as success | Classify deterministic provider failure |
| Draft test | Can mutate live provider | Server-enforced mock/dry-run by default; explicit authorized live mode |
| Failure route/max attempts | Stored but not enforced | Standard success/error/indeterminate outcomes and bounded policy |

## Validation, Tests, And Gaps

Existing tests cover adapter routing, reserve/dispatch/confirm ordering, cached confirmed effects, request-digest
conflicts, unknown blocking, stale resources, operator outcomes, compiler binding checks, inherited repository selection,
and the browser confirmation dialog. Missing composed cases include crash after dispatch begins, stale-dispatch recovery,
absent then redispatch, pre-dispatch validation, Linear `success:false`, provider idempotency propagation, direct test-API
safety, approval, failure-route enforcement, bounded retries, and complete journal history.

This documentation review did not run tests or browser acceptance, per task constraint.

## Expert Judgments

### Competitive Expert

n8n supports pinned/mock data for development, Make preserves incomplete executions and retries classified transient
failures, and Power Automate makes run-after outcomes, retry policies, and approvals visible. Agency's explicit effect
ledger and occurred/absent/indeterminate reconciliation can exceed these patterns, but only after stale dispatch and
redispatch are correct. Mock, dry-run, live, and approval-required modes must be first-class server contracts rather
than a browser warning.

### UX Expert

The inspector asks users to choose an action without showing what fields it needs or exactly what it will change. The
primary interaction should be an operation-specific form followed by a live effect preview: target, before/after when
available, count, irreversible aspects, and approval/test mode. Unknown outcome is important, but warning copy alone
cannot compensate for missing state controls.

### User Researcher

Users are most anxious about accidental duplicates and test runs changing real systems. They need proof that the same
logical action will not happen twice, clarity when that guarantee ends at Agency's database, and a safe default test
that does not mutate. Reconciliation decisions need evidence and attribution because "occurred" versus "absent" can
have audit and compliance consequences.

## Findings

### P0

1. `dispatching` effects can be stranded permanently after a worker crash.
2. **Absent** reconciliation marks an effect dispatchable but cannot transition it back to dispatch.
3. Draft-test live effects rely on bypassable browser confirmation rather than server-enforced effect mode or approval.

### P1

1. Requests/results are generic and deterministic validation happens after dispatch begins.
2. Agency idempotency is not propagated through provider transports where supported.
3. Linear mutation payload `success:false` is not treated as failure.
4. Adapter/catalog semantics are not pinned by the immutable package digest.
5. Retry and failure-route policies are declared but not enforced.
6. Unknown outcome classification is too broad; deterministic, retryable, rejected, and ambiguous failures collapse.
7. Effect history and reconciliation evidence are incomplete.

### P2

1. Compile-time embedded binding equality is partial.
2. Card, outline, and inspector hide exact impact, approval, idempotency, and latest effect state.
3. There is no operation risk taxonomy for choosing safer defaults.

## Recommended Target

### Manifest, Ports, And Outcomes

- Version each action with request/result schemas, effect-preview projection, target cardinality, reversibility, approval
  risk, provider idempotency support, retry/error taxonomy, reconciliation strategy, and adapter semantic digest.
- Typed input `request`; outputs `confirmed`, `rejected`, `failed`, and `indeterminate`. `failed` is safe to retry only when
  classification proves no ambiguous provider acceptance. `indeterminate` must never auto-retry.
- Model a logical effect generation so an operator-approved **Absent** decision can create a new prepared dispatch while
  preserving prior attempts and evidence.

### Card And Inspector

- Card summary: **GitHub: Add comment to PR from octo/agency**, effect/live badge, approval state, and latest outcome.
- Inspector basics: operation-specific mapped fields, target resource, exact rendered effect preview, idempotency
  statement, and blast radius.
- Safety section: Mock, Dry run, Live with confirmation, or Approval required. Server authorizes the selected mode.
- Test area: deterministic mock fixture by default; provider-supported validation/dry run; explicitly authorized live
  effect only after preview digest confirmation.
- Advanced: operation schema/digest, retry classification, dispatch lease, reconciliation strategy, and raw evidence.

### Evidence And Safe Defaults

- Default draft tests to mock, external writes to one target, no automatic retry after dispatch begins, and approval for
  high-risk or irreversible actions.
- Validate and render the complete request before reservation. Persist preview digest and approver confirmation against
  that digest so changed input invalidates approval.
- Record reserve, approval, dispatch lease, provider request/idempotency ID, response, classification, retry, unknown,
  reconciliation, and downstream-resume events.

## Fix Checklist

- [ ] **P0: Add leased dispatch and stale-effect reconciliation.** Acceptance: a crash before call, during call, and
  after provider response reaches deterministic prepared, retryable, unknown, or confirmed states; no effect remains
  permanently `dispatching`.
- [ ] **P0: Repair absent redispatch.** Acceptance: operator **Absent** with evidence creates an auditable new dispatch
  generation that can enter `dispatching`; occurred and indeterminate remain non-dispatchable.
- [ ] **P0: Enforce draft effect mode on the server.** Acceptance: direct API callers cannot perform live effects without
  a short-lived authorization bound to workflow revision, trigger, preview digest, mode, and actor; default is mock.
- [ ] **P1: Add versioned typed action manifests.** Acceptance: every write defines request/result schema, preview,
  idempotency, risk, errors, and semantic digest consumed by compiler, UI, executor, and package digest.
- [ ] **P1: Prevalidate before reservation.** Acceptance: malformed request and unsupported target fail without creating
  or dispatching an effect and focus the exact inspector field.
- [ ] **P1: Propagate provider idempotency and read-back.** Acceptance: supported operations send stable provider keys;
  ambiguous responses use provider lookup/reconciliation before operator escalation.
- [ ] **P1: Classify outcomes truthfully.** Acceptance: deterministic rejection, retryable pre-acceptance failure,
  confirmed result, and indeterminate outcome have distinct ports/evidence; Linear `success:false` fails.
- [ ] **P1: Enforce failure policy safely.** Acceptance: bounded retries apply only to proven retryable failures, error
  routing is durable, and unknown outcomes never auto-retry.
- [ ] **P2: Expose effect identity and impact.** Acceptance: card, outline, inspector, confirmation, and run detail show
  immutable type/operation, target, mode, approval, preview digest, idempotency scope, and latest effect state.

## Dependencies And Open Decisions

Dependencies: versioned provider manifests; shared schema mapper; standard outcome ports; server authorization/identity;
approval primitive; leased effect reconciler; broker idempotency/response metadata; complete effect journal events.

Open decisions:

1. Which operations require approval by default, and may workflow authors lower that requirement?
2. What qualifies as a provider-supported dry run versus a local validation-only preview?
3. Which providers/operations support native idempotency or reliable read-back reconciliation?
4. Can an operator abandon an indeterminate effect and continue, and what evidence/permission is required?
5. How are previewed secrets and sensitive request fields redacted without hiding material impact?
