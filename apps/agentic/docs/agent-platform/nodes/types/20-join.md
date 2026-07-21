# Join node review

Status: Full source review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `join` |
| Display label | Join |
| Version and phase | Version 1, phase 7 |
| Category and execution | Logic, control execution, no external mutation |
| Intended job | Wait for all paths, the first path, or a quorum, then collect the accepted results |
| Current ports | Many-cardinality `branches` input; required array `results` output |
| Current configuration | Required `policy` (`all`, `any`, or `quorum`); `quorum` integer when used |

The executor itself only converts the resolved `branches` array into `results`. Waiting policy is implemented, when it
is implemented, by activation dependency counts in `downstreamActivations` and journal upserts. The manifest and
executor do not bind policy to a result cardinality, loser policy, failure threshold, timeout, ordering contract, or
effect policy.

## Job and mental model

Join should provide a durable synchronization point for genuinely parallel work. Authors need to know which paths are
eligible, how many must succeed, what result name/order they receive, what happens when a path fails or never finishes,
and whether work that is no longer needed is cancelled, allowed to finish, or ignored. For `any` and `quorum`, that last
choice is safety-critical when branches can create external effects.

The current product presents one policy dropdown and optional quorum number, suggesting one coherent implementation.
Source behavior instead has two scheduling modes: ordinary graph fan-in waits for all static incoming success edges no
matter which policy is configured, while a Join owned by For each gets a pre-created activation whose dependency count
uses item count and policy. Even the loop-owned behavior lacks cancellation, late-arrival evidence, and stable terminal
semantics.

## Current contract

### Configuration and ports

`policy` is required. `quorum` is optional in JSON Schema but the runtime scheduler parses it as optional and falls back
to 1 for a For each-owned quorum. The inspector sets it to 1 when Quorum is selected. The compiler only checks whether a
numeric configured quorum is greater than the count of static incoming success connections.

`branches` accepts many objects. Connection mappings can reshape each result. Input resolution sorts contributing
connection/binding keys lexically and emits the corresponding array. This gives deterministic storage-key order, but
the UI does not name sources or disclose ordering, and early policies necessarily return a completion subset rather
than all configured inputs.

The output is always an array of objects with no contributor IDs, statuses, errors, or missing/late metadata. Empty
arrays are valid.

### Ordinary graph fan-in

For any downstream target, `downstreamActivations` counts all static incoming successful non-loop connections. A source
completion contributes bindings and sets dependency count to `incomingCount - contributionCount`. The journal inserts a
blocked activation and, while it remains blocked, merges later bindings and decrements the count until zero.

This path does not inspect Join configuration. Therefore ordinary `any` and `quorum` Join nodes behave as `all`:

- `any` waits for every incoming success edge;
- `quorum` waits for every incoming success edge even when the configured threshold is lower;
- a branch that never produces a success contribution leaves the Join blocked;
- the compiler accepts all three policy labels, so the published contract is not truthful.

### For each-owned fan-in

For each explicitly references a Join by `joinStepId`. When For each expands items, it also creates one parent-scope Join
activation with dependency count:

- `all`: number of items;
- `any`: minimum of item count and 1;
- `quorum`: minimum of item count and configured quorum, defaulting to 1 if absent.

Item body results use scope-specific binding keys and decrement that placeholder. Once the threshold is reached, the
activation becomes ready and stops accepting later bindings because journal conflict updates merge only into `blocked`
activations. Thus the persisted result set is the first threshold of contributions by transaction arrival, then sorted
by binding key for execution. It is not all eventual results.

This behavior has major boundary defects:

- Empty item input produces dependency count zero for all policies, including quorum, and executes Join with `[]`.
- Compiler quorum satisfiability uses static incoming edge count, not dynamic item count. A normal loop body has one edge
  into Join, so quorum 2 is rejected even though runtime code is designed to wait for two items.
- If the static graph has enough edges to pass compilation, runtime clamps quorum to item count; fewer items than quorum
  therefore satisfy the Join instead of being unsatisfiable.
- Body work beyond the threshold is not cancelled. Completion that reaches Join can continue releasing deferred items
  according to For each concurrency.
- Contributions after ready/running/succeeded are silently ignored and have no late-result record.

### Failure, terminal state, and cancellation

A failed branch attempt records terminal run failure immediately. It does not contribute an error object to Join, reduce
an impossible threshold, or apply a Join failure policy. Sibling ready/running/blocked activations are not cancelled by
`failAttempt`; only explicit `cancelRun` cancels them.

Likewise, successful early Join completion does not cancel losing branches. `listReadyActivations` selects activation
status `ready` without joining or filtering run status, and dispatcher execution does not reject a terminal run.
Outstanding branch activations may therefore continue after a downstream Success marks the run succeeded. Their later
completion can create downstream work and set a terminal run back to running; a later failure can set it to failed.
External effects in those branches can occur after the workflow appears complete.

There is no Join timeout, deadline, impossible-quorum detection, branch cancellation generation, or effect-aware early
completion rule.

## Authoring experience

New Join defaults to `all`. The inspector offers only All, Any, Quorum, and a minimum-one number input. It does not show
incoming path count, loop item range, required/available/pending values, named result slots, order, failure handling,
timeout, late-arrival behavior, cancellation, or effect warnings. Quorum has no maximum tied to topology.

The canvas card shows one generic input and output handle without labels. It does not distinguish Join from Exclusive
merge, summarize `2 of 4`, or show waiting state. The outline assigns both kinds the same generic join role. Connection
mappings are available in the generic inspector, but source naming and result shape are not presented as one Join
configuration.

Whole-draft testing exists; there is no isolated synchronization simulator, controllable completion order, injected
failure/timeout, or latest-run progress in the editor. Run detail lists activation status/scope and raw attempt JSON but
does not project required count, accepted contributors, pending/failed/late branches, winner order, or cancellation.

## Runtime, persistence, and evidence

Join is pure and creates no direct effects, artifacts, usage, or specialized evidence. It can, however, govern branches
that have effects, making orchestration evidence essential.

The journal persists activation scope, status, opaque input bindings, dependency count, attempts, input/output, generic
evidence, and events. Deterministic activation IDs and transactionally updated dependencies provide a credible basis for
durable all-path synchronization. Fenced leases protect one selected Join attempt.

The persisted model does not identify expected contributor IDs separately from binding keys, record threshold policy at
activation time, freeze the winner set explicitly, record ignored late contributions, or relate cancellation decisions
to effects. An operator can infer some behavior from the sealed graph and raw inputs but cannot answer why a threshold
was met, which paths were excluded, whether they were cancelled, or whether effects continued afterward.

Stored node `failurePolicy.maximumAttempts` and route mode are not enforced by dispatcher scheduling. Join execution is
unlikely to fail except malformed input/config, but upstream failure and recovery semantics remain undefined. Retry from
here can preserve prior attempts, yet no Join-specific rule defines whether the winner set is reused or recomputed.

## Validation, tests, and gaps

Existing tests cover direct Join pass-through for two objects, compilation of all/any/quorum labels, rejection of a
quorum above static incoming success-edge count, For each dependency counts for any and quorum, journal blocked-input
merge expressions, atomic downstream publication, activation leases, and stale-worker fencing. The editor test covers
selecting Quorum and storing a For each concurrency/reference.

The tests do not prove the advertised end-to-end policies. Missing or insufficient coverage includes:

- ordinary graph `any` and quorum becoming ready at their thresholds;
- For each all/any/quorum execution through the real journal, especially quorum greater than one;
- empty, fewer-than-quorum, exactly-quorum, and greater-than-quorum item sets;
- deterministic winner/order under concurrent completion;
- late arrival before lease, while running, after success, and after downstream terminal completion;
- branch failure before/after threshold, impossible quorum, timeout, cancellation, and continue-versus-fail policy;
- outstanding provider effects and deferred item release after early completion;
- run terminal-state monotonicity when sibling work finishes later;
- lease expiry, worker restart, retry and retry-from-here winner semantics;
- editor topology counts, policy warnings, keyboard/accessibility behavior, progress, and run-detail evidence.

Per task direction, no tests, verification, or browser acceptance were run.

## Behavior matrix

| Case | Current ordinary graph | Current For each owner | Target behavior |
| --- | --- | --- | --- |
| All, all succeed | Waits for all and returns all | Waits for item count and returns all arrivals | Preserve with named deterministic results |
| Any, first succeeds | Still waits for all static edges | Becomes ready at first contribution | Complete at first accepted success under explicit loser policy |
| Quorum reached | Still waits for all static edges | Becomes ready at threshold | Complete exactly at configured satisfiable threshold |
| Empty contributor set | No activation unless created elsewhere | Immediately returns `[]` for every policy | Explicit empty policy; quorum is unsatisfied unless product says otherwise |
| Fewer items than quorum | Compiler often rejects based on one edge; runtime clamps if reached | Threshold becomes item count | Reject/route impossible quorum, never silently lower it |
| One branch fails before all | Run fails; Join remains blocked | Run fails; Join may remain blocked | Apply declared fail-fast, wait, tolerate, or collect-error policy |
| Failure after threshold | Outstanding work may still fail run | Same | Winner commitment and terminal state remain monotonic; late failure handled per policy |
| Late success | Accepted only while blocked | Ignored after ready | Record as late and either include, ignore, or cancel according to declared policy |
| Result order | Lexical binding-key order | Threshold winners sorted by binding key | Named slots or documented stable source order plus arrival evidence |
| Remaining work after any/quorum | Not early, because all are awaited | Continues and may release deferred items | Explicit cancel, drain, or detach policy with effect-safe constraints |
| Timeout | None | None | Optional bounded timeout with Timeout outcome and partial evidence |
| Cancellation | Explicit run cancellation only | Same | Durable loser cancellation where selected; effect reconciliation remains visible |
| Retry/recovery | Generic fencing; policy ignored | Generic fencing; winner semantics undefined | Freeze or deliberately recompute winner set under a documented recovery contract |

## Expert judgments

### Competitive Expert

Workflow products generally make wait-for-all versus first-completed behavior visible and pair parallel aggregation with
error/timeout controls. Agency has stronger raw durability primitives than many competitors, but its advertised policies
are inconsistent across topology types and its early-completion path lacks loser cancellation and effect safety.

Verdict: P0 runtime contract failure; the current selector promises behavior ordinary Join does not implement.

### UX Expert

Three labels and a number do not communicate synchronization. Users cannot see how many paths exist, which are required,
what array positions mean, or what Any does to continuing work. Join and Exclusive merge also look nearly identical.

Verdict: the control is easy to operate but impossible to use confidently for consequential workflows.

### User Researcher

The core trust questions are “what are we waiting for?”, “why did we continue?”, and “what happened to the rest?” Raw
dependency counts and attempt bindings do not answer them. Effects after apparent completion are particularly harmful
because users will infer that Any means the other work stopped.

Verdict: insufficiently observable and unsafe by default for early-completion policies.

## Findings

### P0

1. **Enforce `all`, `any`, and `quorum` consistently for ordinary and loop-owned fan-in.** Evidence: ordinary fan-in
   dependency calculation never reads Join config; only For each initialization does. Impact: published workflows do not
   execute the selected policy.
2. **Fix quorum cardinality and empty semantics.** Evidence: compiler counts static edges while runtime counts/clamps
   dynamic items. Impact: valid loop quorum is rejected, impossible quorum can be silently lowered, and empty input can
   satisfy quorum.
3. **Define and enforce late-work, loser cancellation, and effect policy.** Evidence: threshold completion neither
   cancels remaining activations nor stops deferred releases; post-ready contributions are ignored. Impact: unnecessary
   work and external effects can occur after Join continues.
4. **Make terminal state monotonic and scheduler terminal-aware.** Evidence: ready activation listing ignores run status
   and later completion/failure can update a terminal run. Impact: completed outcomes and effect boundaries are not
   reliable.
5. **Define upstream failure, timeout, and impossible-threshold outcomes.** Impact: joins can block without a useful
   diagnosis while a generic branch failure terminates the run independently of policy.

### P1

1. **Name contributors and define deterministic output shape/order.** Impact: array position and omitted late values are
   currently opaque.
2. **Show required, available, pending, failed, late, and cancelled paths in editor and run detail.**
3. **Add effect-aware safety checks for Any/Quorum.** Impact: authors should not choose early completion over effectful
   losers without an explicit drain/cancel/reconcile decision.
4. **Add synchronization simulation and pinned completion-order tests.**
5. **Include scheduler semantics in executable package identity.**

### P2

1. Add presets such as Race for first success, Best effort until deadline, and Require N approvals, each compiling to an
   explicit policy rather than overloaded hidden behavior.
2. Show recent wait duration and contributor reliability summaries.
3. Expose raw dependency and binding diagnostics under Advanced only.

## Target contract

### Ports and outcomes

- Inputs are stable named contributor slots for static fan-in or a typed dynamic contribution stream owned by For each.
- Success output contains named results plus contributor identity; array-only output is allowed only with documented
  deterministic order.
- Expected outcomes: `completed`, `timeout`, and `impossible`; standard `error` remains for execution faults.
- Optional partial result/error collections are explicit in policy, not inferred from missing values.
- Static and dynamic cardinality are represented distinctly in compiler metadata.

### Configuration and safe defaults

- Policy: All, First success, or Quorum. Avoid ambiguous “Any” if it can include failure; wording must state success
  semantics.
- Quorum is validated against static contributors or dynamic minimum/maximum bounds without clamping at runtime.
- Failure policy: fail fast, wait then fail, tolerate up to N failures, or collect errors where valid.
- Loser policy: cancel pending, drain without using results, or continue detached only when the platform can represent
  lifecycle/effect ownership safely.
- Optional timeout/deadline with explicit Timeout outcome and partial-result policy.
- Default: All, fail fast, no silent partial data, bounded by upstream workflow/loop limits.
- Prevent or strongly warn about cancel-unsafe effectful branches under First/Quorum.

### Card and inspector

- Card: immutable Join type, editable title, summary such as `All of 3` or `2 of up to 10`, labeled input/output, and
  active progress in run mode.
- Inspector Inputs: contributor names, source schemas, required/optional status, and result ordering.
- Inspector Completion: policy, quorum, empty behavior, timeout, failures, losers, and effect warning.
- Inspector Test: completion-order simulator with success/failure/timeout/late controls.
- Inspector Runs: accepted, pending, failed, late, cancelled, threshold time, result mapping, and downstream/effect links.
- Visually and accessibly distinguish parallel Join from decision Exclusive merge.

### Test and evidence experience

- Isolated tests can schedule contributor events in a controlled order and advance a virtual deadline.
- Persist policy snapshot, expected contributors/cardinality bounds, every contribution status/time/digest, frozen winner
  set, threshold event, late arrivals, cancellation requests/results, failures, and partial output.
- Link branch activation, attempt, artifact, usage, and effect records to each contributor.
- Recovery replays from the persisted threshold/winner decision and cannot admit a different winner accidentally.

## Fix checklist and acceptance criteria

- [ ] Introduce one policy-aware durable Join scheduler for static and dynamic fan-in.
  - Acceptance: real journal tests prove All, First success, and Quorum thresholds for ordinary graph and For each paths.
- [ ] Model static contributors and dynamic item cardinality separately.
  - Acceptance: loop quorum 2 with one body edge compiles when item bounds permit it.
  - Acceptance: fewer-than-quorum and empty inputs follow explicit Impossible/Empty behavior and never clamp silently.
- [ ] Define failure, timeout, and impossible outcomes.
  - Acceptance: each can be connected and inspected with partial contributor evidence.
  - Acceptance: fail-fast and tolerate policies have end-to-end durable tests.
- [ ] Implement loser policy and effect safeguards.
  - Acceptance: Cancel pending stops unreleased/ready losers durably and records cancellation.
  - Acceptance: running/external effects are reconciled rather than assumed cancelled.
  - Acceptance: Drain and any detached mode have explicit lifecycle and cost evidence.
- [ ] Make run terminal state monotonic and ready scheduling terminal-aware.
  - Acceptance: no activation starts after terminal completion unless an explicit detached-work contract owns it.
  - Acceptance: late completion cannot move succeeded/failed/cancelled runs back to running or another terminal outcome.
- [ ] Record late contributions instead of silently discarding them.
  - Acceptance: arrival before lease, while running, and after Join success is visible and follows selected policy.
- [ ] Name contributors and publish a stable result schema.
  - Acceptance: mappings and run detail identify source for every value without relying on array position.
- [ ] Build a complete Join inspector and card summary.
  - Acceptance: required/available count, timeout, failures, loser behavior, effects, and output shape are visible before
    publish; keyboard and accessible names distinguish all controls and ports.
- [ ] Add controlled-order isolated tests and run evidence.
  - Acceptance: authors can simulate empty, boundary, failure, timeout, late, cancellation, and recovery cases.
- [ ] Pin scheduler semantics in the execution package.
  - Acceptance: changing dependency, winner, ordering, or late-arrival behavior changes executable identity.

## Shared dependencies and open decisions

Shared dependencies:

- durable scheduler contract with monotonic terminal state and cancellation generations;
- standard expected-outcome/error/timeout routing;
- typed dynamic cardinality from For each and named static contributor metadata;
- effect-aware cancellation and reconciliation;
- executable semantics digesting;
- structured orchestration evidence and run-detail projections;
- schema propagation, isolated tests, and virtual-time/control fixtures.

Open decisions:

1. Does First mean first success, first terminal contribution, or a configurable race? Separate node labels may be safer.
2. For Quorum, do failures reduce the possible denominator, count as votes/results, or make the threshold impossible?
3. What is the default loser policy, especially for provider actions that cannot be cancelled after dispatch?
4. Can detached losing work outlive a workflow run, and if so what owns its status, spend, effects, and cancellation?
5. Should All on an empty dynamic collection complete with `[]`, route Empty, or fail as invalid input?
6. Is result order source order, item index, completion order, or stable named slots?
7. On retry-from-here, is the prior winner set frozen or may the Join rerace contributors?

## Source evidence

- `apps/agentic/src/workflows/stepRegistry.ts`: manifest, policies, ports, UI metadata, and digest construction.
- `apps/agentic/src/workflows/compiler.ts`: static incoming-count quorum validation and For each ownership checks.
- `apps/agentic/src/workflows/workflowExecutor.ts`: ordinary dependency calculation, For each policy initialization, input
  ordering, executor pass-through, releases, dispatcher terminal handling, and ready scheduling.
- `apps/agentic/src/workflows/definition.ts`: many-input mappings, outcomes, and stored failure policy.
- `apps/agentic/src/persistence/workflowJournalStore.ts`: blocked/ready transitions, binding merge rules, terminal updates,
  explicit cancellation, leases, fencing, events, and unfiltered ready listing.
- `apps/agentic/src/persistence/schema.ts`: activation dependencies/statuses and run terminal states.
- `apps/web/src/routes/WorkflowEditorPage.tsx`: defaults and generic card handles.
- `apps/web/src/routes/WorkflowEditorInspector.tsx`: policy/quorum controls and generic connection editing.
- `apps/web/src/routes/WorkflowEditorOutline.utils.ts`: shared generic role with Exclusive merge.
- `apps/web/src/routes/RunDetailPage.tsx`: generic activation and attempt/effect evidence presentation.
- `apps/agentic/src/workflows/compiler.test.ts`, `workflowExecutor.test.ts`, and
  `persistence/workflowJournalStore.test.ts`: current static validation, dependency, executor, and transaction assertions.
- `apps/web/src/routes/WorkflowEditorPage.test.tsx`: current policy and For each reference authoring coverage.
- `apps/agentic/docs/agent-platform/manual-workflow-testing.md`: intended parallel and loop Join scenarios.