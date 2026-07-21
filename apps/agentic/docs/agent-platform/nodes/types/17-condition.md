# Condition node review

Status: Full source review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `condition` |
| Display label | Condition |
| Version and phase | Version 1, phase 7 |
| Category and execution | Logic, control execution, no external mutation |
| Intended job | Evaluate one deterministic predicate and continue on exactly one of two paths |
| Current ports | Required `input`; optional `true` and `false` outputs |
| Current configuration | Required `expression` and required `joinStepId` |

The registry digest is derived from registry version, kind, node version, and execution class. It does not pin the
implementation of expression evaluation or branch scheduling. The node has the shared error schema, but the runtime
turns evaluator and configuration exceptions into a terminal step failure rather than a routable Condition outcome.

## Job and mental model

Condition should answer one visible yes-or-no question about the incoming value. A user should be able to read the
question, test it against a sample, follow the labeled True and False paths, and understand where those paths reconverge.
It should not require the user to understand activation scopes, optional output encoding, or a hidden merge step ID.

The current evaluator mostly honors the computational part of that model. It evaluates one path with one of eight
operators, emits the unchanged input on only the selected output, and adds a branch scope to downstream activations.
The authoring model is less coherent: the visible connections establish the branches, while `joinStepId` separately
declares their owner and the compiler requires every direct branch target to reach that configured Exclusive merge.

## Current contract

### Configuration and expression semantics

`expression` contains a string-array `path`, an operator, and an optional JSON `value`. Supported operators are
`equals`, `not_equals`, numeric comparisons, `exists`, and `truthy`.

- An empty path addresses the complete input object.
- A missing path is `undefined`, not `null`.
- `exists` is true for any present value, including `null`.
- `truthy` is explicit rather than JavaScript truthiness: nonzero numbers, nonempty strings, booleans that are true, and
  all non-null objects and arrays are true.
- `equals` and `not_equals` compare JSON digests. An omitted comparison value is treated as `null`.
- Numeric operators throw unless both operands are numbers.
- The first evaluation produces exactly one output key, `true` or `false`, containing the original input object.

The JSON Schema requires `joinStepId`, but the registry UI metadata does not declare a field for it; the specialized
inspector supplies that control. The new-node default is an empty-path `truthy` expression and an empty merge reference.
That default asks whether the whole input object is truthy. Because every object is truthy, a newly added Condition
silently behaves as always true once its required merge is configured.

### Ports, connections, and mappings

The registry correctly names the output ports True and False and marks each optional. The compiler uses those schemas
for connection and mapping validation. A connection can map all or part of the selected object into its target.

Connection editing is generic. The inspector exposes mappings, but branch labels are not managed as a group and the
canvas does not derive the configured merge from the connected topology. Failure connections are part of the generic
connection contract, although Condition has no expected invalid outcome and executor failures stop the run before
downstream failure routing is considered.

### Topology and branch checks

Compilation requires `joinStepId` to identify an existing `exclusive_merge`. For every successful connection directly
leaving Condition, the compiler checks that some graph path reaches that merge. This catches missing closing paths, but
it leaves important cases open:

- It does not require both True and False to be connected.
- It does not require each output to be connected at most once; an optional source can fan out.
- It does not prove that a path reaches only its owning merge or that branches do not cross.
- `pathExists` follows all connections, including failure and loop-back edges, so a non-success route can satisfy the
  structural reachability check.
- It does not prove that the configured merge is downstream of both semantic outcomes when one outcome has no edge.
- Deleting or reconnecting the merge can leave the hidden ID stale until compilation.

This is topology duplication: visible graph reachability and `config.joinStepId` both claim to define the branch region.

## Authoring experience

The inspector provides editable Label, expression path text, an operator dropdown, a JSON comparison value when needed,
and a Merge step dropdown filtered to Exclusive merge nodes. The expression path is dot-separated free text; it has no
upstream schema picker, existence preview, inferred type, escaping model for property names containing dots, or sample
evaluation. A specialized cases editor is not involved for Condition.

The generic new-node card starts with `Condition` as its editable label. Current node rendering and the inspector title
foreground that mutable label and description; they do not provide a durable type-and-operation header, a readable rule
summary, or an always-visible True/False port legend. Connection mappings and branch topology are edited separately.

There is whole-draft test input and draft execution, but no isolated Condition test, pinned examples, boundary table, or
inline last decision in the inspector. The outline can represent outgoing connections, but it does not replace a managed
branch group or explain the merge ownership contract.

## Runtime, persistence, and evidence

Condition is a pure control step and creates no provider effects, artifacts, usage, or specialized evidence.

1. The dispatcher resolves stored connection bindings into the required `input` object.
2. The executor evaluates the expression and returns the unchanged value under either `true` or `false`.
3. `downstreamActivations` ignores connections whose source port is absent and appends a branch scope keyed as
   `<condition-step-id>:true` or `<condition-step-id>:false`.
4. Contributions arriving at the configured Exclusive merge receive a scope-specific binding key; the branch scope is
   removed before the merge activation is identified.
5. Exclusive merge is assigned dependency count zero, so the selected branch can continue without waiting for the path
   that never ran.

The journal persists the Condition attempt input and output, attempt status, activation scope, timestamps, and normal
run event. That is enough to reconstruct the selected outcome from the output key and downstream scope. There is no
first-class decision evidence containing expression, resolved operand, result, selected edge, or owning merge. Run
detail can show generic attempt input/output/evidence, but there is no Condition-specific explanation or branch trace.

Condition has no side effects and needs no node-level idempotency key. Journal activation IDs and fenced attempts make
re-execution durable, but configured `failurePolicy.maximumAttempts` is not consulted by the dispatcher. Evaluation
errors therefore fail once at run level; retry, timeout, and failure-route behavior are not implemented as authored
policy. Cancellation is run-wide and has no branch-specific semantic.

## Validation, tests, and gaps

Existing unit coverage verifies true and false results, `exists`, `truthy`, `not_equals`, numeric comparison, selected
downstream activation, branch scope, and compiler rejection when a configured branch cannot reach its merge. Compiler
fixtures also exercise the requirement for an Exclusive merge. The broader manual test guide includes Condition in
branch-and-merge workflows and around a numeric decision boundary.

Missing or insufficient coverage includes:

- all operator boundary combinations, especially missing versus null and structured digest equality;
- numeric type errors and their persisted run evidence;
- empty path behavior and the unsafe always-true new-node default;
- one missing branch, duplicate fan-out from one outcome, crossed/nested branch regions, failure-edge reachability, and
  multiple Conditions claiming the same merge;
- stale `joinStepId` after graph edits;
- late branch work, cancellation, lease recovery, retry-from-here, and branch effects before merge;
- editor add/configure/connect/rename/delete, keyboard and accessible-name behavior, validation recovery, test input, and
  run-detail inspection;
- an assertion that only the selected branch creates activations and effects under durable scheduling after restart.

Per task direction, this review did not execute tests or browser acceptance. Judgments are based on source and existing
test assertions, not fresh runtime evidence.

## Behavior matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Predicate true | Emits unchanged input on `true`; schedules only matching source-port edges | Follow a visibly labeled True outcome and record evaluated operands and result |
| Predicate false | Emits unchanged input on `false` | Follow a visibly labeled False outcome with the same evidence |
| Missing path with `exists` | False | Preview as missing and allow an explicit missing/null distinction |
| Missing path with `not_equals` | True | Preserve semantics but show the missing-value rule before run |
| Null path with `exists` | True | Preserve and explain that present null exists |
| Empty path with `truthy` | Whole object is true | Do not publish until the user selects a field or explicitly chooses whole input |
| Numeric operator on non-number | Throws; dispatcher persists terminal `step_failed` | Block known type mismatches at authoring and expose a routable evaluation error for dynamic mismatches |
| No True connection | Compilation can succeed if other requirements hold; selected True produces no downstream activation | Require an explicit terminal/drop outcome or both managed branches |
| No False connection | Same silent path ending | Same explicit handling requirement |
| Branch cannot reach configured merge | Compiler emits `branch_merge_unreachable` | Prevent the edit or mark the branch group inline with a repair action |
| Missing/wrong merge ID | Compiler emits `branch_merge` | Derive the boundary from a managed graph region; no editable hidden ID |
| Retry | Stored policy is not enforced | Pure evaluation errors default to no retry; recovery is an explicit edit/retry-from-here action |
| Timeout | No node timeout is needed or implemented | No timeout control for local evaluation |
| Cancellation | Run-wide cancellation only | Show cancellation in run evidence; never imply unselected branch cancellation |
| Recovery after worker loss | Journal lease/fencing governs attempts | Preserve one decision record and prove no duplicate selected-branch activation |

## Expert judgments

### Competitive Expert

n8n, Make, and Power Automate teach users to build conditions from dynamic fields, operators, and visible branch lanes.
Agency's deterministic, code-free evaluator and durable branch scopes are a stronger execution base, but requiring a
separate Exclusive merge ID is less familiar and more fragile. Agency should intentionally retain typed mappings and
durable decision evidence while adopting generated True/False ports and a managed closing boundary.

Verdict: computationally credible, but below competitive authoring expectations because field discovery, branch
visibility, and merge management are missing.

### UX Expert

The task is split across path text, operator/value controls, canvas connections, and a Merge step dropdown. The user
cannot read the complete rule or topology in one place, and the empty-path default looks valid while producing a
surprising constant result. Persistent type identity, a sentence-like rule builder, labeled handles, inline validation,
and automatic branch grouping are required.

Verdict: the inspector is operable for an implementation-aware user, not self-explanatory for workflow authors.

### User Researcher

Trust depends on answering four questions after a run: what value was tested, how was missing/null interpreted, which
outcome won, and what work or effects followed. Generic attempt JSON can support forensic reconstruction but does not
answer those questions directly. Users also need sample cases near numeric thresholds and confidence that an unselected
effectful branch never ran, including after recovery.

Verdict: predictable in simple cases, but insufficiently explainable and insufficiently proven under durable recovery.

## Findings

### P0

1. **Remove duplicated merge ownership.** Evidence: `joinStepId` is required in config while graph paths separately
   connect Condition to Exclusive merge; the compiler reconciles them with reachability. Impact: stale IDs, crossed
   regions, and graph edits can make visible topology disagree with executable topology.
2. **Make both outcomes explicit and structurally complete.** Evidence: outputs are optional and compilation does not
   require True and False handling. Impact: a valid predicate result can silently create no downstream work and leave a
   run without an understandable terminal outcome.
3. **Persist truthful decision evidence and prove recovery behavior.** Evidence: selection is inferable only from generic
   output/scope, and existing tests do not cover lease recovery or downstream effects. Impact: operators cannot quickly
   audit why a path ran or demonstrate that an unselected effect did not execute.

### P1

1. **Replace path text with the shared schema-aware expression builder.** Impact: prevents avoidable runtime type/path
   failures and aligns Condition with mappings, Switch, Wait, and loops.
2. **Eliminate the always-true default.** Evidence: empty path plus `truthy` tests the object itself. Impact: a newly
   inserted node can appear configured while routing every object to True.
3. **Show type, rule summary, outcome labels, and latest result on the card and inspector.** Impact: authors can scan and
   debug the graph without opening raw configuration or attempt JSON.
4. **Define evaluator failures as a standard routable error contract.** Impact: dynamic numeric mismatches currently
   terminate the run despite generic failure-policy and failure-edge authoring surfaces.

### P2

1. Add reusable predicates and boundary-case tables for common null, status, threshold, and existence checks.
2. Show expression-version and raw JSON only under Advanced.
3. Add branch frequency and recent-outcome summaries without implying probabilistic evaluation.

## Target contract

### Ports and outcomes

- Input: `value` (one, schema propagated from upstream).
- Outcomes: `true` and `false`, both visibly labeled and each carrying the unchanged typed value.
- Error: `error` for invalid dynamic operands or evaluator faults; local deterministic evaluation defaults to one attempt.
- A branch must connect to work, an explicit terminal, or an explicit Ignore outcome. Silent dead ends are invalid.
- The closing boundary is graph-derived or owned by a managed branch container, not stored as editable `joinStepId`.

### Configuration and safe defaults

- Required visual rule: field/expression, operator filtered by inferred type, and comparison value when applicable.
- Distinguish missing, null, empty, false, and zero in both builder and preview.
- Start unconfigured with a blocking prompt to choose a field; do not default to whole-object truthiness.
- Preserve deterministic operators and unchanged-input pass-through.
- Version the executable expression semantics and include that version or digest in the execution package.
- No timeout, retry, or effect settings in Basic because evaluation is local, bounded, and effect-free.

### Card and inspector

- Card header: immutable Condition type plus editable title.
- Card summary: human-readable predicate and clearly labeled True/False handles.
- Inspector Basic: sentence-like rule builder, schema picker, type feedback, sample input, Evaluate action, and result.
- Inspector Branches: managed True and False lanes with destinations and closing boundary.
- Inspector Runs: latest resolved operand, result, selected path, duration, errors, and downstream/effect links.
- Inspector Advanced: raw expression JSON, expression semantics version, propagated schemas, and provenance.

### Test and evidence experience

- Support isolated evaluation, saved named examples, boundary tables, run-to-here, and pinned upstream samples.
- Persist expression identity, redacted resolved value, result, selected outcome, selected connection IDs, and merge/group
  identity as structured decision evidence.
- Link the decision to downstream activation and effect records so absence of unselected work is auditable.
- Keep sensitive values subject to the platform evidence classification and redaction policy.

## Fix checklist and acceptance criteria

- [ ] Replace `joinStepId` with one graph-derived or managed branch-region contract.
  - Acceptance: moving, deleting, or reconnecting the closing boundary cannot leave hidden merge ownership stale.
  - Acceptance: compiler tests reject crossed, nested, incomplete, and failure-edge-only branch closures.
- [ ] Require explicit handling for True and False.
  - Acceptance: publish is blocked unless each outcome reaches work, an explicit terminal, or Ignore.
- [ ] Build Condition on the shared typed expression editor.
  - Acceptance: available fields come from upstream schemas and operators are filtered by type.
  - Acceptance: missing/null and all numeric boundary cases can be previewed without running the workflow.
- [ ] Replace the default expression with an unconfigured blocking state.
  - Acceptance: adding Condition never creates a silently always-true publishable node.
- [ ] Render immutable type, predicate summary, and labeled True/False handles.
  - Acceptance: desktop and mobile canvas, outline, keyboard navigation, and accessible names identify both outcomes.
- [ ] Add isolated and draft test evidence.
  - Acceptance: saved examples show input, resolved operand, result, selected path, and validation errors.
- [ ] Persist a structured decision record.
  - Acceptance: run detail answers what was tested, why the result occurred, and which activations/effects followed.
- [ ] Define evaluation-error routing and retry defaults.
  - Acceptance: known type errors block publish; dynamic errors follow a tested Error route or stop policy.
  - Acceptance: local evaluation does not retry unless a future explicitly retryable evaluator capability is introduced.
- [ ] Prove durable exclusivity.
  - Acceptance: concurrency, lease expiry, retry-from-here, cancellation, and restart tests create downstream work only for
    the selected outcome and never duplicate an effect.

## Shared dependencies and open decisions

Shared dependencies:

- versioned schema-aware expression and dynamic-value picker;
- propagated schemas and sample values;
- labeled outcome ports and compatibility feedback;
- managed branch regions and graph-derived merge ownership shared with Switch and Exclusive merge;
- standard expected-outcome/error routing and enforced retry policy;
- structured decision evidence, lineage, redaction, and run-detail views;
- isolated node testing and pinned samples.

Open decisions:

1. Must every Condition reconverge, or may a branch terminate independently without an Exclusive merge?
2. Is explicit Ignore a first-class terminal outcome, a connection property, or intentionally unsupported?
3. Should structured equality remain digest equality, or should the first visual builder limit equality to scalar and null
   values while Advanced retains structured comparison?
4. How are array/object truthiness and missing-versus-null semantics explained consistently across Condition, Switch,
   and Repeat?
5. What decision values may be persisted verbatim, hashed, redacted, or omitted for sensitive inputs?

## Source evidence

- `apps/agentic/src/workflows/stepRegistry.ts`: manifest, expression schema, ports, UI metadata, and digest construction.
- `apps/agentic/src/workflows/compiler.ts`: port/mapping checks and configured Exclusive merge reachability.
- `apps/agentic/src/workflows/workflowExecutor.ts`: evaluator semantics, branch scopes, merge dependency behavior, and
  dispatcher failure handling.
- `apps/agentic/src/workflows/definition.ts`: connection outcomes, mappings, branch keys, and stored failure policy.
- `apps/agentic/src/persistence/workflowJournalStore.ts`: activation/attempt persistence, fencing, evidence, and downstream
  upsert semantics.
- `apps/web/src/routes/WorkflowEditorPage.tsx`: new-node defaults and canvas serialization.
- `apps/web/src/routes/WorkflowEditorInspector.tsx`: expression, merge reference, connection, and test-input controls.
- `apps/agentic/src/workflows/compiler.test.ts` and `workflowExecutor.test.ts`: current compiler and evaluator assertions.
- `apps/agentic/docs/agent-platform/manual-workflow-testing.md`: intended end-to-end branch scenarios.