# For Each Node Review

Status: Design review

Last reviewed: 2026-07-20

This review covers `for_each@1` as implemented in the registry, compiler, durable scheduler, editor, run detail, and
focused tests. It applies the parent workflow-node design baseline. Tests and browser acceptance were inspected but not
executed for this documentation-only review.

## Identity and intended job

| Attribute | Current value |
| --- | --- |
| Registry kind | `for_each` |
| Display label | For each |
| Version and release | Version 1, phase 7 |
| Category and execution | Logic, control execution, no mutation |
| Capability | None |
| Intended job | Run one managed body for every object in an input array, with bounded fan-out, then synchronize at a Join. |

The user mental model should be: "For every item, run this contained sequence, then continue once the selected
completion policy is satisfied." The current model instead asks the user to wire an ordinary graph and separately tell
the node which step is the body and which step is the Join. That exposes scheduler topology rather than the task.

## Current contract

### Configuration and ports

The registry in `apps/agentic/src/workflows/stepRegistry.ts` requires:

| Field | Current contract |
| --- | --- |
| `maximumItems` | Integer from 1 through 1000. The editor default is 100. |
| `concurrency` | Integer from 1 through 1000. The editor default is 4. |
| `bodyStepId` | Non-empty step ID selected from a dropdown. |
| `joinStepId` | Non-empty step ID selected from a dropdown. |

`items` is a required array of open objects. `item` is an open object output with `many` cardinality. The manifest does
not express the item schema inherited from the upstream array, an item index, an empty outcome, a completion summary,
or a per-item error policy. The generic step-level failure policy is present on the instance, but the dispatcher path
does not enforce its configured retry count or failure routing.

The manifest's executor digest is derived from registry metadata, not the executable fan-out and release semantics.
Changing scheduler behavior without changing those metadata inputs would not change the digest.

### Compiler and topology

`validateOrchestration()` in `apps/agentic/src/workflows/compiler.ts` checks that:

- the configured body exists;
- the configured synchronization step is a Join;
- the body can reach that Join.

These checks catch useful structural errors. They do not establish loop containment, prevent unrelated paths from
entering the body or Join, define what one iteration contributes, or derive ownership from visible graph structure.
The configured IDs and the actual edges remain two sources of truth.

## Authoring experience

`ForEachInspector` in `apps/web/src/routes/WorkflowEditorInspector.tsx` exposes four fields: maximum items,
concurrency, body step, and Join step. `WorkflowEditorPage.tsx` creates the hard-coded defaults above.

The canvas card displays the editable title, broad category, and description. Its XYFlow handles are not visibly
labeled, so `items` and `item` cardinality are not legible on the graph. The body and Join look like unrelated nodes;
there is no loop container, Item boundary, Completed boundary, item-shape preview, empty behavior, or fan-out estimate.
Deleting, reconnecting, or moving one of the referenced nodes can therefore change a hidden topology contract.

The inspector also cannot answer the questions users need before a run:

- Which array is being iterated and what fields does each item contain?
- How many body activations can this input create, including nested loops?
- Does concurrency preserve output ordering?
- What happens when the array is empty or one item fails?
- Does the Join wait for all items, any item, or a quorum, and what happens to late work?

## Runtime, persistence, and evidence

`executeWorkflowStep()` in `apps/agentic/src/workflows/workflowExecutor.ts` validates that every input element is an
object and rejects arrays larger than `maximumItems`. It returns the array on the many-cardinality `item` output.

`downstreamActivations()` provides the substantive orchestration behavior:

- each item receives a deterministic item scope based on the For each step ID and zero-padded index;
- the first `concurrency` body activations are ready and later items are persisted as deferred;
- completing item index `i` can release index `i + concurrency`;
- a parent-scope Join activation is created with a dependency count derived from its All, Any, or Quorum policy;
- item-scoped work contributes bindings to the parent-scope Join.

`completeAttempt()` in `apps/agentic/src/persistence/workflowJournalStore.ts` transactionally records output data,
merges downstream bindings, decrements dependency counts, makes satisfied activations ready, and applies deferred
releases. Deterministic activation IDs and fenced attempts provide a strong basis for idempotent fan-out.

The empty path is not safely defined. Source inspection indicates that an empty array creates no item activations and a
zero-dependency Join without branch bindings. That activation can become ready, while the Join executor requires a
`branches` input. This is a source-backed correctness risk, not an executed failure in this review.

An error in any body activation reaches `failAttempt()` as a terminal run failure in the inspected dispatcher. No
For each policy collects the failed item, continues remaining work, or cancels already running and deferred siblings.
Likewise, the configured generic retry and route policy is not applied in that path.

Run detail persists and exposes scopes, activation states, attempts, input, output, error, usage, evidence, data, and
events. This is diagnostically rich but presents individual scheduler records rather than one loop summary. Users must
infer progress, concurrency, failed indexes, releases, and aggregate cost from the raw activation list.

Lease expiry columns and fencing checks exist. The inspected ready-work query selects only `ready` activations and does
not itself reclaim expired leased or running attempts. Crash recovery for fan-out, deferred release, and Join
contribution therefore requires explicit end-to-end proof before it is treated as a product guarantee.

## Validation, tests, and gaps

Focused tests in `compiler.test.ts`, `workflowExecutor.test.ts`, and `workflowJournalStore.test.ts` cover body and Join
topology, item scopes, bounded concurrency, deferred releases, Join dependency counts, and persistence transitions.
Editor tests cover storing numeric bounds and body/Join selections. Run-detail tests cover generic scopes and attempts.

The inspected suite does not establish:

- empty-array completion for each Join policy;
- per-item retry, fail-fast cancellation, continue, or error collection;
- stable result ordering under concurrent completion;
- nested fan-out budgets, cost preflight, or payload-size limits;
- late completion after Any or Quorum has released the Join;
- worker loss before or after a deferred release or Join contribution;
- a complete keyboard-accessible managed-loop authoring workflow;
- node-centered progress and recovery evidence in run detail.

## Behavior matrix

| Scenario | Current behavior | Target behavior |
| --- | --- | --- |
| Valid non-empty array | Creates item-scoped body work, bounds ready work by concurrency, and synchronizes through the configured Join. | Preserve durable scheduling inside a visible managed loop region. |
| Array exceeds limit | Fails execution with a maximum-items error. | Block in preflight when sample size is known; otherwise route a structured execution error with actual and allowed counts. |
| Element is not an object | Fails the For each attempt. | Validate the propagated item schema before execution and identify the invalid index. |
| Empty array | Source path appears able to ready a Join without required branch data. | Complete deterministically with count 0 and no body activation; never require a synthetic branch. |
| Concurrency below item count | Persists later items as deferred and releases one as an earlier item completes. | Preserve behavior and show queued, active, completed, and failed counts. |
| One item fails | Inspected dispatcher terminally fails the run; sibling cancellation and deferred work disposition are unclear. | Enforce authored fail-fast, continue, or collect-errors policy durably. |
| Join policy is Any or Quorum | Dependency count can release the Join before all items finish. | Define late-item cancellation, result inclusion, effects, and evidence before allowing these policies. |
| Worker stops mid-item | Fencing rejects stale completion, but focused reclaim behavior was not demonstrated. | Recover or mark uncertain work according to effect safety, without duplicating a contribution or release. |
| Nested fan-out | Each loop has a local item cap; multiplied work is not previewed. | Enforce a run-level activation and spend budget and show worst-case multiplication before publish and run. |

## Expert judgments

### Competitive Expert

n8n's Loop Over Items makes `loop` and `done` outputs visible and supports batching. Make's Iterator turns an array into
schema-bearing bundles whose fields become available to downstream mapping. Power Automate renders Apply to each as a
visual container, defaults to sequential execution, and exposes bounded concurrency; its guidance also warns that
nested loops multiply requests and can exceed quotas. Agency's deterministic scopes, durable deferral, and Join
integration are stronger foundations, but the product hides them behind IDs and unlabeled ports. Agency should
differentiate on truthful progress, typed item contracts, and run-level cost bounds rather than copy a generic iterator.

### UX Expert

The current inspector asks users to encode a visual containment relationship through dropdowns. This is a high-risk
mode error because a graph can look correct while the stored IDs disagree. The primary interaction should be a managed
region with explicit Item and Completed boundaries. Limits and error behavior belong in the region header; raw IDs do
not belong in the normal inspector. The card must retain immutable `For each` identity and display item source,
concurrency, maximum items, and validation state.

### User Researcher

The likely trust questions are operational: "How much work will this create?", "Which records failed?", and "Can I
rerun only those records?" Current raw scopes can answer these only after expert reconstruction. Users need a preflight
estimate and a run summary that preserves item identity, ordering, status, attempts, duration, cost, and effects. A
partial retry must make duplicate-effect risk explicit and reuse the original sealed item input.

## Findings

### P0

1. **Empty input has no proven valid completion contract.** The runtime can construct a zero-dependency Join without a
   `branches` binding, while Join execution expects that input. Define and test zero-item completion independently of
   ordinary Join contribution.
2. **Per-item failure semantics are not authorable or enforced.** The inspected failure path terminally fails the run
   and does not implement fail-fast cancellation, continue, collection, or the generic configured retry/route policy.
3. **Topology has two authorities.** `bodyStepId` and `joinStepId` duplicate visible edges. The compiler checks
   reachability but cannot make the graph itself explain ownership or containment.

### P1

1. **Fan-out impact is hidden.** Local caps exist, but nested activation count, model/provider usage, external effects,
   and estimated spend are not calculated or shown before execution.
2. **The item contract is generic.** The open-object `item` port discards upstream item schema and omits stable index and
   total metadata.
3. **Completion evidence is scheduler-centric.** Run detail lacks loop-level progress, ordered results, failed-item
   summaries, late-work disposition, and targeted recovery actions.
4. **Recovery guarantees are incomplete.** Fencing is present, but expired-attempt reclamation and exactly-once release
   and contribution behavior are not demonstrated for this node.

### P2

1. The card and outline do not summarize source, item shape, policy, or limits.
2. No sample preview shows the first items, derived item schema, or expected result summary.

## Recommended target contract

### Ports and outcomes

- Input `Items<T>`: a schema-propagated array, not an unqualified open object array.
- Managed body boundary `Item`: `{ value: T, index: integer, count: integer, itemKey?: string }`.
- Managed body return `Result<R>`: optional typed result for the current item.
- Outcome `Completed`: `{ count, succeeded, failed: 0, results }`, including the zero-item case.
- Outcome `Completed with errors`: `{ count, succeeded, failed, results, errors }` when collection is enabled.
- Standard `Error`: configuration, input, budget, or scheduler faults that are not expected item outcomes.

The body and return are region boundaries, not ordinary externally connectable ports. Result ordering must follow input
ordering regardless of completion order.

### Configuration and safe defaults

- `maximumItems`: default 100, hard maximum 1000 unless a platform budget grants less.
- `concurrency`: default 1 for deterministic and effect-safe behavior; make 4 an explicit user choice with impact text.
- `onItemError`: `fail_fast` by default; optional `continue` and `collect_errors` with precise result contracts.
- `maximumResultBytes`: bounded and derived from the run data budget.
- `itemKey`: optional schema-aware expression for stable display and selective retry.
- Remove authored body and Join IDs. Compile them from managed-region structure.

Publishing and running must fail closed when worst-case activation count exceeds the run budget. Concurrency greater
than 1 must surface ordering, provider throttling, and external-effect implications.

### Card and inspector

The card should show immutable **For each**, editable Title, item source and type, "up to 100 items", "1 at a time",
error policy, and validation or latest-run status. Ports must be visibly named.

The inspector should provide a schema-aware Items picker, item preview, concurrency and limit controls, error-policy
examples, result-shape preview, and worst-case work/cost calculation. Advanced can expose raw schemas and the compiled
region identity read-only. In-canvas controls should add a first body step and expose a clear Completed drop target.

### Testing and evidence

Isolated testing should accept a pinned sample array and allow deterministic body fixtures. It must preview all item
inputs and aggregate results without live external effects unless explicitly confirmed.

Run detail should aggregate total, queued, active, succeeded, failed, cancelled, and deferred items; preserve input
index/key; show ordered outputs, attempts, usage, effects, and error codes; and offer policy-safe retry of failed items.
Events should record fan-out creation, release, policy decision, early Join release, late-work disposition, and final
summary with causation.

## Fix checklist

- [ ] **P0: Define empty-array semantics.** Acceptance: zero items create no body activation, produce `Completed` with
      count 0, and complete correctly without a synthetic Join binding for every supported completion policy.
- [ ] **P0: Implement explicit item-error policies.** Acceptance: fail-fast cancels deferred work and safely handles
      running siblings; continue and collect-errors preserve ordered item outcomes; retries obey the sealed policy.
- [ ] **P0: Replace body and Join IDs with one managed-loop topology.** Acceptance: users create, move, reconnect, and
      delete the region visually; the compiler derives one unambiguous body and completion boundary from that structure.
- [ ] **P0: Prove durable recovery.** Acceptance: crash tests at lease, completion, release, and Join-contribution
      boundaries recover without duplicate body execution where unsafe, duplicate bindings, missed releases, or an
      incorrectly ready Join.
- [ ] **P1: Propagate the item schema and metadata.** Acceptance: downstream body fields are discoverable, incompatible
      mappings fail compile, and index/count/key are typed and available without string templates.
- [ ] **P1: Add fan-out preflight and run budgets.** Acceptance: nested worst-case activations and known model/provider
      costs are displayed; publish and run fail closed above platform limits.
- [ ] **P1: Add loop-centered evidence and recovery.** Acceptance: run detail shows progress and per-item lineage, and a
      failed-item retry explains and enforces effect-safety constraints.
- [ ] **P1: Define Any and Quorum late-work behavior.** Acceptance: cancellation, results, effects, and late arrivals have
      deterministic journaled outcomes and focused tests.
- [ ] **P2: Add sample preview and concise summaries.** Acceptance: card, outline, and inspector communicate source,
      limits, policy, and representative item/result shapes without opening raw JSON.

## Dependencies and open decisions

Shared dependencies are the managed-region graph model, schema propagation and expression picker, standard expected
outcome and error routing, enforced retries, run-level activation/spend budgets, sibling cancellation, lease recovery,
and node-centered run evidence.

Open product decisions:

- Whether concurrency defaults to 1 globally or varies by body effect classification.
- Whether `continue` without error collection is useful enough to support.
- Whether partial retry creates a new run linked to the original or a new scoped attempt in the same run.
- Whether Any and Quorum are valid For each completion policies once item effects have started.
- Which result-size and evidence-retention limits apply to large item collections.

## Source map

- Registry and manifest: `apps/agentic/src/workflows/stepRegistry.ts`
- Definition and connection flags: `apps/agentic/src/workflows/definition.ts`
- Compiler checks: `apps/agentic/src/workflows/compiler.ts`
- Fan-out and dispatcher: `apps/agentic/src/workflows/workflowExecutor.ts`
- Durable transitions: `apps/agentic/src/persistence/workflowJournalStore.ts`
- Persistence schema: `apps/agentic/src/persistence/schema.ts`
- Editor and inspector: `apps/web/src/routes/WorkflowEditorPage.tsx`,
  `apps/web/src/routes/WorkflowEditorInspector.tsx`
- Run evidence: `apps/web/src/routes/RunDetailPage.tsx`
- Focused tests: `compiler.test.ts`, `workflowExecutor.test.ts`, `workflowJournalStore.test.ts`,
  `WorkflowEditorPage.test.tsx`, `RunDetailPage.test.tsx`
