# Exclusive merge node review

Status: Full source review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `exclusive_merge` |
| Display label | Exclusive merge |
| Version and phase | Version 1, phase 7 |
| Category and execution | Logic, control execution, no external mutation |
| Intended job | Close one Condition or Switch branch group and continue with the one path that ran |
| Current ports | Many-cardinality `branches` input; required `value` output |
| Current configuration | Empty object |

The node is a synchronization boundary only in appearance. Scheduler logic special-cases it to require zero remaining
dependencies whenever a contribution creates the activation, and the executor later requires the resolved `branches`
array to contain exactly one object. Its ownership is stored on Condition/Switch as `joinStepId`, not on the merge.

## Job and mental model

An exclusive merge is not a general parallel Join. It is the closing boundary of a decision where exactly one outcome
is eligible to arrive. Users should normally experience it as part of a managed Condition or Switch region: selected
branch work ends at the boundary, the selected value continues, and paths that were never selected are not awaited.

As a standalone palette node, the current Exclusive merge looks like a many-input collector. That suggests it can safely
accept arbitrary paths. In fact, correctness depends on hidden ownership and branch scope conventions established by an
upstream Condition or Switch. The executor's length-one assertion detects some malformed resolved inputs, but journal
scheduling can discard later contributions before that assertion sees them.

## Current contract

### Ports and input resolution

`branches` accepts many object contributions. Connection mappings project each upstream output into that target port.
When an activation is leased, `resolveActivationInput` gathers stored bindings for matching incoming connections, sorts
them by connection/binding key, and produces an array. The executor parses that array with `.length(1)` and returns its
only object as `value`.

There is no branch identity in the public input or output, no owner ID, no selected outcome evidence, and no policy for
zero or multiple contributions. Zero and multiple values are execution errors if they reach the executor.

### Ownership and topology

Condition and Switch each require `config.joinStepId` pointing to an Exclusive merge. Compilation verifies that every
direct successful branch target has some path to that merge. The merge itself has no owner configuration and the
compiler does not establish a one-to-one ownership relation.

Consequently, the graph can express unsupported or ambiguous forms:

- an unowned standalone Exclusive merge;
- multiple Conditions/Switches claiming the same merge;
- one decision outcome fanning out into multiple paths that all reach the merge;
- additional non-branch paths entering the merge;
- branch paths crossing or entering another decision's merge;
- reachability satisfied through failure or loop-back edges because `pathExists` does not filter them.

The compiler does not require the merge to have exactly one contribution-producing path per outcome or prove that at
most one contribution can arrive in one activation scope.

### Scheduler semantics

`downstreamActivations` detects a target of kind Exclusive merge and forcibly sets `dependencyCount = 0`, regardless of
the number of incoming graph connections. It also detects the owning Condition/Switch by searching for a matching
`joinStepId`. When a branch-scoped activation contributes, its binding key includes the branch scope and the target
scope removes the final branch segment. The resulting deterministic activation ID is shared at the parent scope.

The first contribution therefore inserts a ready activation. Journal conflict updates merge bindings and decrement
dependencies only while the existing activation is `blocked`. An Exclusive merge is never created blocked by normal
branch routing. If another contribution with the same activation ID arrives while it is ready, running, or succeeded,
the conflict update retains the original bindings and status. The later contribution is silently not part of the merge
input. This makes valid exclusive topology fast, but it does not enforce exclusivity under malformed fan-in or multiple
owners; it implements first persisted contribution wins.

## Authoring experience

Exclusive merge is independently available in the node registry/palette. Adding it creates an empty config and a generic
card with one unlabeled target handle and one unlabeled source handle. The card describes the node but does not identify
its owning Condition/Switch, selected branch, number of incoming lanes, incomplete paths, or invalid extra inputs.

There is no specialized inspector. Users can edit Label, inspect generic connection mappings, and delete the step.
Condition/Switch inspectors contain the Merge step selector, so ownership must be configured elsewhere. Deleting the
merge does not atomically repair the owner or branch lanes. The outline classifies it generically as a join but does not
render a paired opening/closing branch region.

Whole-draft test execution can exercise the node. There is no isolated exclusive-boundary test, branch ownership
preview, selected-lane visualization, or latest-run explanation in the editor.

## Runtime, persistence, and evidence

The node is pure, local, and bounded. It creates no artifacts, effects, usage, or specialized evidence. Its normal
attempt persists a `branches` array with one object as input and a `value` object as output.

Branch scope is central to persistence behavior. Condition/Switch append a branch segment; selected branch work retains
it; arrival at the configured merge strips it and creates one parent-scope activation. Scope-specific binding keys
prevent naming collisions before the scope is removed. The journal uses deterministic activation IDs and fenced leases
to prevent duplicate selected attempts.

What is not persisted is equally important: the merge has no explicit owner record, expected outcome set, selected
outcome, discarded late contribution event, or assertion that nonselected paths never activated. Generic run detail can
show the one retained input/output and attempt evidence, but cannot explain why other graph inputs were not awaited or
whether any contribution was discarded.

If the length-one parse fails, the dispatcher records terminal `step_failed`; stored retry/failure routing is not
enforced. There is no timeout because a valid Exclusive merge should be runnable on the selected contribution. Run-wide
cancellation applies. “Late arrival” should be impossible under a correct exclusive branch, but current persistence
silently ignores it rather than recording a topology/runtime invariant violation.

## Validation, tests, and gaps

Existing tests verify successful execution with exactly one branch, compiler requirements that Condition/Switch point
to an Exclusive merge, branch-path reachability, and editor authoring/persistence of a Condition plus merge boundary.
The downstream scheduler tests demonstrate branch scope behavior around decision nodes, but there is no focused durable
Exclusive merge journal suite.

Missing or insufficient coverage includes:

- zero and multiple executor contributions and persisted failure evidence;
- two selected-path endpoints reaching one merge in the same branch scope;
- two decisions owning one merge, nested/crossed branches, and unowned merges;
- non-branch input, failure-edge reachability, and duplicate fan-in from one outcome;
- concurrent completions before lease, arrival while ready/running/succeeded, and explicit detection of discarded input;
- lease expiry, worker restart, cancellation, retry-from-here, and downstream effect duplication;
- deleting/replacing the owner or merge, reconnecting lanes, keyboard/accessibility behavior, and run-detail inspection.

Per task direction, no tests, verification, or browser acceptance were run.

## Behavior matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| One selected branch arrives | Activation is immediately ready; one object passes through | Continue selected value and record owner/outcome provenance |
| Unselected branch | Creates no activation upstream | Remain absent and auditable as not selected, not cancelled |
| No branch arrives | No merge activation exists | Upstream branch must terminate explicitly or make the region incomplete at publish time |
| Two contributions stored before execution | Normal scheduler tends to retain first because activation is already ready | Reject invariant violation; never silently choose one |
| Contribution arrives while ready/running/succeeded | Conflict update ignores new binding | Record and fail an exclusivity invariant violation, or make it structurally impossible |
| Executor receives zero/multiple branches | Zod length error becomes terminal `step_failed` | Typed internal invariant error with owner/branch diagnostics |
| Standalone merge | Registry allows authoring; ownership may be absent | Hide from normal palette or require managed creation with an owner |
| Multiple branch owners | Not prohibited | One closing boundary belongs to exactly one managed decision region |
| Failure path enters merge | Can contribute if graph/mapping permits | Failure outcomes cannot satisfy a success branch boundary |
| Retry | Stored policy not enforced | No automatic retry for invariant errors; repair topology then retry from owner/boundary |
| Timeout | None | None for a valid exclusive boundary |
| Cancellation | Run-wide | Show selected path and cancellation state; do not claim other paths were cancelled |
| Recovery | Journal lease/fencing protects the retained activation | Prove one boundary activation and one downstream continuation after restart |

## Expert judgments

### Competitive Expert

Many workflow products either visually reconnect exclusive routes without a user-authored synchronization node or use a
router/merge pair whose relationship is obvious. Agency's durable branch scope is a strong implementation primitive,
but exposing a generic many-input Exclusive merge and a separate owner ID is less familiar and less safe.

Verdict: the node should become managed branch infrastructure, not remain a general-purpose palette primitive.

### UX Expert

The current card resembles Join but has radically different waiting behavior. Its many input suggests aggregation while
its real contract is one selected lane. Ownership is edited on another node, and no visual region links the pair. This
is a high-risk mismatch between appearance and semantics.

Verdict: conceptually opaque as a standalone node; clear only when rendered as a closing boundary of a decision group.

### User Researcher

Users need confidence that the boundary did not race parallel work and that only one outcome was eligible. Current run
evidence shows only the retained value, and later malformed contributions can disappear without an explicit event.
That weakens trust precisely where effectful branches reconverge.

Verdict: normal-path behavior is simple, but ownership and exclusivity are not observable or sufficiently enforced.

## Findings

### P0

1. **Enforce one owner and exclusive topology.** Evidence: the merge has no owner contract and multiple decisions or
   extra paths can target it. Impact: visible graphs can encode ambiguous synchronization and scope collisions.
2. **Never silently discard a second contribution.** Evidence: ready/non-blocked conflict updates retain prior bindings.
   Impact: malformed or concurrently duplicated work produces a first-arrival result instead of an explicit invariant
   failure, hiding data and potentially masking duplicate effects.
3. **Make branch closure graph-derived or managed.** Evidence: owner `joinStepId` duplicates visible topology. Impact:
   stale references and crossed regions undermine compiler and user understanding.

### P1

1. **Remove Exclusive merge from the normal palette or create it only through Condition/Switch branch management.**
2. **Render owner, expected outcomes, selected lane, and boundary status.** Impact: distinguishes it from Join and makes
   non-waiting semantics visible.
3. **Persist boundary provenance and invariant failures.** Impact: run detail can prove which decision closed and whether
   any illegal arrival occurred.
4. **Provide atomic edit/delete behavior for the opening decision, lanes, and boundary.**

### P2

1. Collapse or expand the visual boundary with its managed branch region.
2. Show recent selected-outcome counts on the owning decision rather than as a generic merge metric.
3. Expose raw scope and binding keys under Advanced diagnostics only.

## Target contract

### Ports and outcomes

- Internal input: one selected branch contribution carrying typed value plus immutable owner/outcome provenance.
- Output: `value`, preserving the selected branch schema or a well-defined union.
- Internal invariant error: unexpected owner, outcome, duplicate contribution, or scope.
- No arbitrary many-input public contract and no user-configurable waiting policy.
- Failure/timeout paths do not enter the success boundary unless the managed branch model explicitly defines such an
  outcome as one of the exclusive lanes.

### Configuration and safe defaults

- No independent basic configuration.
- Created and owned by one Condition/Switch managed region; owner and outcome identities are immutable platform data.
- Default boundary is generated when a decision is inserted and remains incomplete until every required lane is handled.
- Executable package pins branch-region semantics, expected outcomes, and scope rules.

### Card and inspector

- Prefer a compact labeled closing boundary inside the managed branch region, not a full standalone card.
- Show owner title/type, expected lanes, connected/terminated state, and selected lane in run mode.
- Inspector is reached from the branch group and offers topology diagnostics, output schema union, and latest evidence.
- Advanced diagnostics show activation scope, retained binding, invariant checks, and executable semantics version.

### Test and evidence experience

- Branch-group isolated tests drive the owning Condition/Switch rather than injecting arbitrary merge arrays.
- Persist owner ID, selected stable outcome ID, source activation/attempt, boundary activation, downstream activation IDs,
  and any duplicate/foreign arrival invariant event.
- Link selected-path effects and prove absence of nonselected activations.
- Support retry from the opening decision or failed branch step while preserving prior evidence.

## Fix checklist and acceptance criteria

- [ ] Replace editable `joinStepId` ownership with one managed branch-region model.
  - Acceptance: one boundary has exactly one owner and graph edits cannot create stale hidden ownership.
- [ ] Prevent arbitrary standalone/foreign inputs.
  - Acceptance: normal palette insertion is removed or starts a complete managed decision region.
  - Acceptance: compiler rejects unowned merges, multiple owners, crossed/nested lanes, non-branch inputs, and
    failure-edge-only reachability.
- [ ] Enforce exactly one contribution durably.
  - Acceptance: a second contribution before, during, or after boundary execution records an invariant failure rather
    than being ignored or changing the winner.
  - Acceptance: concurrent transaction tests prove deterministic detection.
- [ ] Make scope and binding behavior an explicit executable contract.
  - Acceptance: package identity changes when branch scheduling semantics change.
- [ ] Render the boundary as part of its owner region.
  - Acceptance: users can identify owner, expected lanes, selected lane, and continuation on canvas and outline.
  - Acceptance: accessible names distinguish Exclusive merge from parallel Join.
- [ ] Add atomic authoring operations.
  - Acceptance: deleting, moving, reconnecting, or terminating a lane updates the group coherently or blocks the edit.
- [ ] Persist boundary evidence and invariant events.
  - Acceptance: run detail explains why the boundary ran immediately and identifies the source outcome and downstream
    continuation.
- [ ] Add durable recovery and effects tests.
  - Acceptance: restart, lease expiry, retry-from-here, and cancellation preserve one boundary activation and never
    duplicate downstream effects.

## Shared dependencies and open decisions

Shared dependencies:

- managed branch regions shared with Condition and Switch;
- generated stable outcome identities and schema propagation;
- executable scheduler semantics included in package identity;
- structured decision/boundary evidence and run-detail lineage;
- compiler region analysis and atomic graph edits;
- standard invariant error and recovery behavior.

Open decisions:

1. Should Exclusive merge remain a registry kind for compiled execution while being hidden as an authoring node, or can
   branch closure compile directly into orchestration metadata?
2. May a selected outcome fan out and reconverge before leaving its branch region, and if so what explicit inner Join is
   required before the exclusive boundary?
3. Can some outcomes terminate independently, or must every nonterminal lane pass through the boundary?
4. Should an impossible second arrival fail the entire run, quarantine the region, or raise an operator incident while
   preserving an already committed downstream result?
5. How should output schema be computed when exclusive outcomes produce different shapes?

## Source evidence

- `apps/agentic/src/workflows/stepRegistry.ts`: empty config, many input, value output, and manifest identity.
- `apps/agentic/src/workflows/compiler.ts`: owner reference and branch-path reachability checks.
- `apps/agentic/src/workflows/workflowExecutor.ts`: length-one executor assertion, branch-scope binding keys, scope removal,
  zero dependency special case, and input resolution.
- `apps/agentic/src/persistence/workflowJournalStore.ts`: deterministic activation IDs, ready insertion, conflict update
  conditions, attempts, fencing, and evidence persistence.
- `apps/agentic/src/workflows/definition.ts`: generic many-edge, outcome, mapping, and failure-policy contract.
- `apps/web/src/routes/WorkflowEditorPage.tsx`: standalone defaults and generic unlabeled handles/card.
- `apps/web/src/routes/WorkflowEditorInspector.tsx`: lack of specialized merge controls and owner editing on decisions.
- `apps/web/src/routes/WorkflowEditorOutline.utils.ts`: generic join role.
- `apps/agentic/src/workflows/compiler.test.ts` and `workflowExecutor.test.ts`: current owner/reachability and one-input
  assertions.
- `apps/web/src/routes/WorkflowEditorPage.test.tsx`: existing Condition plus Exclusive merge authoring coverage.