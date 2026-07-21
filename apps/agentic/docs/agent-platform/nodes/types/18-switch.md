# Switch node review

Status: Full source review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `switch` |
| Display label | Switch |
| Version and phase | Version 1, phase 7 |
| Category and execution | Logic, control execution, no external mutation |
| Intended job | Evaluate ordered cases and continue on the first matching path or a default path |
| Current ports | Required `input`; one required `branch` envelope output |
| Current configuration | Required `cases` and `joinStepId`; optional `defaultKey` |

The output envelope is `{ key, value }`, where `key` is the selected case/default key and `value` is the unchanged
input. Edge-level `branchKey` metadata, not distinct registry ports, decides which connections receive that envelope.
The registry digest does not pin evaluator or scheduling implementation.

## Job and mental model

Switch should classify one incoming value into exactly one named outcome. Users should see ordered rules, understand that
the first match wins, route each generated outcome through a labeled port, and use an explicit Otherwise path for
unmatched input. The value being classified should flow to the selected branch without requiring knowledge of an
internal routing wrapper.

The runtime supplies deterministic first-match selection and preserves the original value. The current authoring model
splits one conceptual case across three places: the case key and predicate in `cases`, a matching free-text `branchKey`
on a connection, and a hidden `joinStepId`. That creates drift opportunities despite useful compiler checks.

## Current contract

### Cases and selection semantics

Each case has a string `key` and a deterministic `when` expression. Cases are evaluated in array order and the first
true expression wins. Expressions have the same missing, null, truthy, digest-equality, and numeric behavior documented
for Condition. If no case matches, `defaultKey` is selected. If no default exists, execution throws `Switch matched no
case and has no default branch`, which the dispatcher records as terminal `step_failed`.

The config schema requires at least one case and a merge reference. Case keys are only constrained to strings by the
step schema, while connection `branchKey` values use the stricter workflow identifier syntax. A case key that cannot be
represented as a connection branch key can therefore pass config validation but cannot form a valid edge contract.

New nodes default to one case named `case` with an empty-path `truthy` predicate, a default key named `default`, and an
empty merge reference. The case editor refuses an empty path, but the serialized default already contains one. As with
Condition, whole-object truthiness means the default case matches every object, so the Otherwise route is unreachable
until the rule is changed.

### Ports, branch envelope, and mappings

The registry exposes one `branch` output with required `key` and `value`. Every outgoing successful edge must separately
set `branchKey`; the compiler rejects missing and undeclared keys. Runtime reads `output.branch.key`, filters edges to
that key, and projects mappings from the whole envelope. To pass the original input, authors or defaults must map from
`value`, not from the apparent selected branch value itself.

This internal envelope leaks into connection mappings and schema reasoning. The canvas cannot render one handle per
case because the manifest has one output. Renaming a case does not atomically rename matching edge metadata. Editing an
edge source through the generic connection inspector selects the source node's first output but does not establish a
valid Switch branch key.

### Compiler topology and branch checks

Compilation currently checks:

- every outgoing Switch connection has a declared branch key;
- no branch key is attached to a non-Switch source;
- case and default keys are not duplicated;
- every declared case/default key appears on at least one outgoing connection;
- each direct branch target can reach the configured Exclusive merge;
- the configured merge exists and has kind `exclusive_merge`.

It does not check that a branch key has exactly one edge, that a case can ever be reached given earlier cases, or that
the default is present. It also does not constrain case keys to the edge identifier grammar at config validation, prove
branches are disjoint after leaving Switch, reject multiple Switches claiming the same merge, or distinguish success
paths from failure/loop paths in `pathExists`. Visible topology and `joinStepId` remain two sources of truth.

## Authoring experience

The specialized Cases field supports add/remove rows, branch key, dot-separated path, operator, and JSON comparison
value. It validates nonempty keys/paths and parseable JSON locally. It does not expose drag reordering even though order
changes behavior, upstream schema fields, inferred types, overlap/shadow warnings, sample evaluation, or branch
destinations. Its local row state is initialized once from props, so external config replacement is not visibly designed
as a synchronized controlled editor.

Default branch key is a separate text field. Each outgoing connection's branch key is edited separately, either while
the node is selected or in generic connection details. The merge is selected from another dropdown. The author must
manually keep all three surfaces aligned.

Cards render generic handles from manifest outputs, so Switch has one source handle rather than named case handles. The
card and outline do not summarize ordered cases, mark Otherwise, show shadowing, or retain immutable type identity
independently from the editable label. Whole-draft testing exists, but isolated classification tables and latest selected
case are absent from the inspector.

## Runtime, persistence, and evidence

Switch is pure and creates no provider effect, artifact, usage, or specialized evidence.

1. The dispatcher resolves the required input object.
2. The executor evaluates cases in order and emits `{ branch: { key, value } }`.
3. Downstream scheduling parses the selected key, ignores edges with a different `branchKey`, maps the envelope, and
   appends a branch scope `<switch-step-id>:<selected-key>`.
4. At the configured Exclusive merge, branch-specific binding keys avoid collisions and the branch scope is removed.
5. The selected path is runnable without waiting for unselected cases.

The journal persists generic input/output, activation scope, attempt status, timestamps, and events. The selected key is
therefore reconstructable, but there is no structured record of evaluated case order, resolved operands, false cases,
the winning rule, default use, selected edge IDs, or merge ownership. Run detail exposes generic attempt JSON rather
than a Switch decision timeline.

An unselected branch creates no activation, so its effects should not run. That claim is covered by unit-level
`downstreamActivations` assertions for one selection, not durable concurrency, restart, or recovery tests. Stored retry
policy and failure routing are not enforced by the dispatcher; a no-match or operand error fails the run once. Switch
has no node timeout and only run-wide cancellation.

## Validation, tests, and gaps

Existing tests cover case selection, default selection, a no-default execution error, branch-key-required,
unknown-key, duplicate case/default key, unconnected declared branch, non-Switch branch keys, branch scope, envelope
mapping from `value`, and inability of a branch target to reach its configured merge. Manual workflow scenarios exercise
three-way routing and default behavior in larger drafts.

Missing or insufficient coverage includes:

- first-match precedence when multiple cases match and explicit evidence of shadowed later cases;
- impossible case keys under the connection identifier grammar;
- empty case arrays, empty/default keys, empty-path defaults, and case-editor rehydration;
- renaming, reordering, or deleting cases with connected edges;
- duplicate edges per key, crossed/nested branch groups, default omission policy, and multiple owners of one merge;
- all expression boundaries and numeric type failures;
- durable restart, lease expiry, cancellation, retry-from-here, and effect exclusivity;
- editor keyboard ordering, accessible labels, add/connect/edit/delete recovery, inline validation, isolated tests, and
  run-detail branch inspection.

Per task direction, no tests, verification, or browser acceptance were run for this review.

## Behavior matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| One matching case | Emits first matching key and wrapped input | Route unchanged typed input through a generated named port |
| Multiple matching cases | First array item wins silently | Preserve first-match semantics and warn/show shadowing and evaluated order |
| No match with default | Emits `defaultKey` | Route through a visible Otherwise port |
| No match without default | Terminal `step_failed` | Require Otherwise or an explicitly selected Fail/Ignore unmatched policy |
| Missing path | Semantics depend on operator | Preview missing distinctly from null and show each case result |
| Numeric operator on non-number | Throws and fails run | Block known mismatches; route dynamic evaluation error consistently |
| Duplicate case/default key | Compiler error | Prevent duplicate naming inline before connection editing |
| Declared but unconnected key | Compiler error | Generated port remains visibly incomplete with a repair action |
| Edge missing/wrong key | Compiler error | Edge is created from a named case port, so separate key entry is impossible |
| Case renamed | Matching edge key does not automatically change | Rename port and connected topology atomically using stable case identity |
| Branch merge missing/unreachable | Compiler error via hidden merge ID | Managed branch region owns one visible closing boundary |
| Retry | Policy stored but not dispatched | Deterministic errors default to one attempt; explicit recovery from corrected config/input |
| Timeout | None | No timeout for bounded local classification |
| Late arrival | Not applicable to unselected cases; selected path may reach merge later | Record selected path and ignore no work merely because another case exists |
| Cancellation/recovery | Run-wide journal behavior | Prove only the selected case resumes and effects are never duplicated |

## Expert judgments

### Competitive Expert

n8n, Make, and Power Automate expose multiple named routes or visually associated filters and make fallback routing
recognizable. Agency's ordered deterministic cases, typed mappings, and durable scopes are valuable differentiators, but
one generic branch output plus manually synchronized edge keys is an internal representation exposed as product UX.

Verdict: strong routing kernel, materially behind competitive branch authoring and discoverability.

### UX Expert

Order is behavior, yet rows cannot be visibly reordered or tested as a table. Case definition, destination, and merge
ownership are separated, and the card offers one generic output handle. The unsafe default can make Otherwise appear
valid but unreachable. Cases should generate stable labeled ports and destinations inside one managed interaction.

Verdict: high cognitive load and error-prone change management despite useful inline row validation.

### User Researcher

Users debugging classification need to know which cases were evaluated, why earlier cases failed, why the winner
matched, and whether Otherwise was used. Generic output shows only the winning key. Renames and order changes also need
previewable impact because they can silently redirect consequential work.

Verdict: deterministic but not sufficiently explainable, change-safe, or auditable for effectful workflows.

## Findings

### P0

1. **Replace branch envelope plus edge keys with generated stable outcome ports.** Evidence: one `branch` output and
   separate `branchKey` strings must match case config. Impact: case edits can drift from edges and authors must map an
   internal `{ key, value }` wrapper.
2. **Remove duplicated merge ownership.** Evidence: graph paths and required `joinStepId` independently encode the
   branch group. Impact: stale references and structurally ambiguous regions can publish only after late compiler errors.
3. **Make unmatched behavior explicit.** Evidence: `defaultKey` is optional and no match throws a terminal generic
   failure. Impact: an expected classification outcome is conflated with an execution fault.
4. **Persist and prove exclusive decision behavior.** Impact: operators cannot directly audit rule order or prove after
   recovery that only the winning effectful path ran.

### P1

1. **Use the shared typed expression and data picker for every case.** Impact: prevents path/type errors and aligns
   semantics with Condition and Repeat.
2. **Use stable case IDs separate from editable labels.** Impact: case rename can update display without disconnecting or
   silently retargeting edges.
3. **Add ordering, overlap, and shadow analysis.** Impact: first-match behavior becomes visible before publication.
4. **Replace the always-matching default case configuration with a blocking unconfigured state.**
5. **Show case summary, Otherwise, connection state, and latest selected case on card, outline, and inspector.**

### P2

1. Add common routing presets, bulk paste, and duplicate-case actions.
2. Add per-case recent counts and timings with clear date/run scope.
3. Keep raw envelope/config and evaluator version under Advanced for expert inspection only.

## Target contract

### Ports and outcomes

- Input: `value` (one, propagated schema).
- One generated output per case using an immutable case ID and editable label; payload is the unchanged typed value.
- A visible `otherwise` output when unmatched policy is Route.
- Standard `error` output for dynamic evaluator faults; unmatched input is not an error unless policy is Fail.
- No user-authored branch key on connections and no routing envelope in mapping UX.
- Managed graph region or graph-derived closing boundary replaces `joinStepId`.

### Configuration and safe defaults

- Ordered visual case rows with drag/keyboard reorder, stable identity, typed expression, destination status, and sample
  result.
- Explicit unmatched policy: Route to Otherwise, Fail with typed domain error, or Ignore only if the platform supports
  intentional path termination.
- Default to one unconfigured case and visible Otherwise, both blocking publication until intentionally handled.
- Detect duplicate labels/IDs, impossible keys, identical predicates, obvious shadowing, and unreachable Otherwise.
- Pin executable expression and selection semantics in the execution package.

### Card and inspector

- Card: immutable Switch type, editable title, concise ordered-case summary, and labeled generated handles.
- Inspector Cases: rule, order, sample result, destination, duplicate/reorder/delete actions, and overlap warnings.
- Inspector Otherwise: explicit unmatched policy and destination.
- Inspector Runs: winning case/default, resolved operand, evaluated order, selected connections, downstream work/effects,
  duration, and errors.
- Advanced: raw expressions, stable case IDs, propagated schemas, and evaluator digest/version.

### Test and evidence experience

- Table-driven isolated testing with multiple saved inputs and one highlighted outcome per row.
- Preview the effect of reorder, rename, deletion, and unmatched input before accepting the edit.
- Persist evaluated case IDs/order, redacted resolved values, boolean results, winner/default, selected connection IDs,
  and branch-group identity.
- Link decision evidence to downstream activation/effect records and preserve it across retry-from-here.

## Fix checklist and acceptance criteria

- [ ] Generate stable named ports from cases and remove editable edge `branchKey`.
  - Acceptance: adding, connecting, renaming, reordering, and deleting a case cannot create config/edge key drift.
  - Acceptance: downstream mappings address the original value directly, not `branch.value`.
- [ ] Replace `joinStepId` with managed or graph-derived branch ownership.
  - Acceptance: compiler rejects crossed and incomplete regions without consulting a stale hidden ID.
- [ ] Add an explicit unmatched policy.
  - Acceptance: every publishable Switch routes Otherwise, intentionally fails, or intentionally ignores it.
  - Acceptance: unmatched routing is represented as an expected outcome, not generic `step_failed`.
- [ ] Adopt the shared typed expression editor.
  - Acceptance: fields and operators derive from upstream schema and every case can be evaluated against a sample.
- [ ] Add stable case identity, keyboard reordering, overlap/shadow checks, and atomic topology edits.
  - Acceptance: changing order previews changed winners; removing a connected case requires explicit impact confirmation.
- [ ] Replace unsafe defaults.
  - Acceptance: a new Switch cannot publish with an implicit whole-object always-true case.
- [ ] Render type, case summaries, and named outcomes on canvas and outline.
  - Acceptance: all case handles and Otherwise have accessible names and visible incomplete states.
- [ ] Persist structured classification evidence.
  - Acceptance: run detail shows evaluated order, winner rationale, selected downstream activations, and effects.
- [ ] Prove exclusivity and recovery.
  - Acceptance: restart, lease expiry, concurrent completion, cancellation, and retry-from-here tests never activate or
    effect a nonwinning branch and never duplicate the winner.
- [ ] Cover editor and compiler edge cases.
  - Acceptance: tests include duplicate/impossible keys, no match, case rename/reorder/delete, unconnected ports, nested
    branch regions, keyboard use, and error recovery.

## Shared dependencies and open decisions

Shared dependencies:

- typed schema-aware expression editor and sample propagation;
- dynamic generated ports with stable identities;
- managed branch regions shared with Condition and Exclusive merge;
- standard expected-outcome/error routing and enforced retry semantics;
- structured decision evidence, redaction, lineage, and run-detail UI;
- isolated table-driven tests and pinned samples.

Open decisions:

1. Is first-match always the product semantic, or should mutually exclusive and match-all modes exist as separate node
   types rather than Switch options?
2. Which unmatched policies are allowed, and is Otherwise mandatory by default?
3. Can one named outcome intentionally fan out, or must each case own one branch lane before later parallelism?
4. How should obvious versus undecidable predicate overlap be communicated without overstating static analysis?
5. May case labels contain arbitrary text while stable internal IDs remain identifier-safe?
6. Must all cases reconverge, or can some terminate independently?

## Source evidence

- `apps/agentic/src/workflows/stepRegistry.ts`: manifest, cases schema, branch envelope, UI metadata, and digest.
- `apps/agentic/src/workflows/compiler.ts`: branch-key, duplicate, connected-case, mapping, and merge checks.
- `apps/agentic/src/workflows/workflowExecutor.ts`: ordered first-match evaluation, default failure, envelope filtering,
  branch scopes, and dispatcher behavior.
- `apps/agentic/src/workflows/definition.ts`: edge branch-key grammar, mappings, outcomes, and failure policy.
- `apps/agentic/src/persistence/workflowJournalStore.ts`: attempts, scopes, evidence, fencing, and downstream persistence.
- `apps/web/src/routes/workflowEditor/SwitchCasesField.tsx`: row editing and local validation.
- `apps/web/src/routes/WorkflowEditorPage.tsx`: defaults, handles, and edge serialization.
- `apps/web/src/routes/WorkflowEditorInspector.tsx`: cases, default, merge, branch-key, and connection controls.
- `apps/agentic/src/workflows/compiler.test.ts` and `workflowExecutor.test.ts`: current branch and runtime assertions.
- `apps/agentic/docs/agent-platform/manual-workflow-testing.md`: intended multi-route end-to-end scenarios.