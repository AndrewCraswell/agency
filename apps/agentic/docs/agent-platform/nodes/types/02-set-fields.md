# Set fields (`set_fields`) node review

Status: Source-backed design review

Last reviewed: 2026-07-20

Review method: Static inspection of the registry, compiler, executor, journal, service API, web editor, run detail, and
tests. No tests were run and no browser acceptance was performed for this review. Statements about the authoring
experience describe implemented source behavior, not direct browser observations.

## Identity

| Property | Current value |
| --- | --- |
| Kind and version | `set_fields@1` |
| Registry label | Set fields |
| Category | Data |
| Execution class | Control |
| Mutation policy | None |
| Capabilities | None |
| Input | `input` / Input / object / optional |
| Output | `value` / Value / object / one |
| Error contract | `{ code: string, message: string, retryable?: boolean }` |

Primary source: `apps/agentic/src/workflows/stepRegistry.ts`, `workflowConfigFields.set_fields` and the `set_fields`
seed. It is a phase-2 deterministic transformation. Its digest identifies registry metadata, not the implementation of
the shallow merge in `executeWorkflowStep()`.

## Intended job and mental model

Set fields should let an author create or update named values without code. The natural mental model is an ordered list
of assignments: choose a target field, choose a constant or upstream value, preview the result, and understand what
happens when the field already exists.

The current node implements a narrower operation: shallowly overlay a configured constant object on an optional input
object. It preserves input keys that do not collide, replaces entire top-level values on collision, and returns a new
object. Despite the registry description saying "constants and workflow input," configured values cannot reference the
input. A nested JSON constant can be assigned as a whole value, but there is no nested target path or expression.

## Current contract

### Configuration

- Required `fields` property whose value must be an object. Unknown config properties are allowed by the manifest.
- New-node default: `{ fields: {} }` in `WorkflowEditorPage.tsx::initialStepConfig()`.
- UI metadata and specialized inspector use an `object_rows` editor with `Field name` and JSON `Value`.
- Every row value must parse as JSON. Keys must be non-empty and unique in the editor.
- The runtime accepts any JSON object produced outside the editor. It does not limit assignment count, key length,
  value depth, or encoded size.
- The compiler does not validate step config against `definition.configSchema`; malformed config can be published and
  fail only when the activation executes.

### Ports and cardinality

- `input` is an optional open object. With no connection or no binding, runtime treats it as `{}`.
- `value` is one required open object.
- Neither port carries field-level schema derived from upstream input or configured assignments.
- Shared failure edges can be represented in graph data, but the dispatcher never schedules them. Normal editor input
  prevents many config errors, yet API-authored malformed values become terminal step failures.

### Execution, effects, and capabilities

`executeWorkflowStep()` evaluates:

```text
value = { ...input.input-or-empty-object, ...step.config.fields-as-object }
```

The merge is shallow and constants win. It is deterministic, has no external effects, creates no artifacts, consumes
no provider/model/workspace capability, and emits no usage or specialized evidence. There is no node-specific timeout.
Retrying the same immutable attempt input and config would reproduce the same value, but configured automatic retries
are not implemented by the dispatcher.

## Current authoring experience

Adding the node creates an empty assignment object. The card shows the editable title, `data` category, description,
and unlabeled input/output handles. It does not show immutable `Set fields` identity after rename, assignment count,
assigned field names, collision policy, or inferred output shape.

The inspector provides a direct row editor. This is better than raw JSON for constants and enforces unique non-empty
keys locally. It has no source-mode selector, upstream field picker, target path picker, before/after preview, overwrite
warning, row reordering semantics, or field-level validation tied to downstream schemas. The editor holds row text in
local component state and emits only when every row is valid, so one invalid row blocks persistence of all current row
edits while showing a shared error message.

Connection mappings are configured separately on edges. Authors can therefore map an upstream object into `input` and
then assign constants, but cannot see the two operations as one transformation preview. Whole-draft testing is
available; isolated node testing, pinned input, latest output beside the node, and run-to-here are not implemented.

## Runtime, persistence, and evidence

The dispatcher resolves success-edge bindings into the optional `input` port, leases an attempt, and records resolved
input in the execution log. On success the journal stores generic attempt input and `{ value: ... }` output, creates
downstream activations atomically, and records `attempt.succeeded`. Run detail exposes those values in the Attempts
section and the immutable graph contains the configured fields.

Set fields produces no `workflowData` record and no node-specific `evidence` or `usage`. There is no explicit lineage
record per output key showing whether the value came from input or config, and no overwrite list. A failed runtime
config parse is normalized by the dispatcher to `step_failed`; the journal stores the error and marks the run failed.
Generic Retry step or Retry from here can create a new attempt while preserving prior attempts, but immutable config
means a deterministic config failure requires a new workflow version rather than retry.

## Existing validation and tests

Implemented validation:

- The API parses the workflow envelope and JSON values.
- The editor requires non-empty unique keys and JSON row values.
- Runtime validates the manifest config schema and parses input/config as objects.
- Runtime validates the declared output envelope after execution.
- The compiler validates graph ports, cardinality, connection mappings, reachability, and cycles, but not the fields
  config or resulting shape.

`stepRegistry.test.ts` asserts the basic `object_rows` UI metadata. `compiler.test.ts` uses Set fields in the canonical
phase-2 package and many topology fixtures. `workflowExecutor.test.ts` proves input preservation and constant overlay in
one happy path. `workflowLifecycle.integration.test.ts` covers a manual-trigger to Set fields to Success lifecycle.
`WorkflowEditorPage.test.tsx` relies on Set fields in the base draft and covers generic workflow validation behavior.

Material test gaps:

- No direct tests for empty input, no input, empty fields, collision precedence, nested-object replacement, `null`,
  arrays as values, suspicious property names, or deterministic replay.
- No test shows malformed `fields` rejected at compile/publish time; current behavior is runtime rejection.
- No tests define field-count, key-length, nesting, or payload boundaries.
- No editor test covers Set fields row creation, invalid JSON recovery, duplicate keys, removal, or saved output.
- No evidence test asserts persisted before/after values or lineage because that evidence is not produced.
- No browser, keyboard, accessible-name, or mobile acceptance evidence was collected for this review.

## Representative behavior matrix

| Case | Current behavior | Judgment |
| --- | --- | --- |
| No input, `fields: { answer: 42 }` | Emits `{ value: { answer: 42 } }` | Useful create-object behavior |
| Input only, `fields: {}` | Emits a shallow copy of input | Valid pass-through, but hidden in summary |
| Distinct input and constant keys | Preserves both | Correct for shallow overlay |
| Same top-level key | Configured constant silently replaces input value | Deterministic but insufficiently explicit |
| Input `{ user: { id, name } }`, field `user: { id }` | Replaces the entire `user` object | Likely surprise without merge policy |
| Constant is `null`, array, or nested object | Assigned as a valid JSON value | Supported |
| `fields` missing or not an object | Compiler can accept; executor fails before transformation | Publication/runtime defect |
| Very large fields object | No node-specific bound | Operational risk |
| Runtime failure edge configured | Compiler recognizes the error contract; dispatcher terminates instead of routing | Shared failure-contract defect |
| Retry | Manual retry reproduces output or failure from immutable input/config | Safe but rarely useful |
| Timeout | None | Appropriate for local work, subject to shared payload bounds |
| Recovery after bad config | Edit draft, republish, then run again; retrying old package cannot repair it | Correct immutable-package consequence, poorly explained |

## Expert judgments

### Competitive Expert

n8n Edit Fields, Make mapping panels, and Power Automate data operations combine constants with dynamic content and
make keep/drop behavior visible. Their strongest pattern is not merely a row list; it is one assignment model with a
data picker, expression support, and an output preview. Agency's deterministic, code-free execution and durable attempt
capture are good foundations, but constants-only shallow overlay is materially behind expected workflow composition.
Agency should intentionally keep a constrained expression language and explicit bounds rather than adopting arbitrary
code expressions.

### UX Expert

The row editor makes the basic operation approachable, but the label `Value` does not reveal that only constants are
accepted. Silent overwrite and whole-object replacement are invisible. The card contributes no useful scanning
summary, and unlabeled handles force authors to remember direction and payload. The common flow should be assignment
rows with target, source mode, value, type feedback, and an always-available sample preview.

### User Researcher

Developers will need exact merge semantics and a way to represent nested targets without accidental object loss.
Workflow specialists will expect dynamic content from previous nodes. Platform engineers need bounded payload and
schema propagation. Operators need output lineage when a field changed unexpectedly. Current generic attempt input and
output permit forensic comparison, but manual comparison does not scale and does not identify overwritten keys.

## Findings

| Priority | Finding and evidence | Impact |
| --- | --- | --- |
| P0 | **Invalid config is not a publication error.** `compiler.ts::compileWorkflowDefinition()` resolves definitions but never validates each `step.config`; `workflowExecutor.ts::executeWorkflowStep()` performs the first manifest validation. | API-authored or drifted workflows can publish successfully and fail deterministically in production. |
| P1 | **The implemented operation is constants-only shallow overlay.** See `workflowExecutor.ts`, the `set_fields` branch and `objectValue()`. | It cannot perform the dynamic assignments users expect; collisions can destroy nested input without warning. |
| P1 | **The output schema remains an open object.** See the registry seed and compiler snapshot generation. | Downstream autocomplete, connection compatibility, and preflight cannot use configured field information. |
| P1 | **Authoring omits source mode, nested target, merge policy, and preview.** See `WorkflowEditorInspector.tsx` and `ObjectRowsField.tsx`. | Authors must split transformations across edge mappings and node constants, with no unified result model. |
| P1 | **Failure routing and configured retries are not enforced.** See `downstreamActivations()` success-only filtering and dispatcher `failAttempt()`. | A malformed transformation terminates the run even if the graph and policy imply recovery. |
| P2 | **Evidence has no field lineage or overwrite summary.** See `workflowJournalStore.ts::completeAttempt()` and the empty `data/evidence` result. | Debugging requires manual full-object comparison and becomes costly for large payloads. |

## Recommended target contract

### Identity and ports

- Keep a deterministic, effect-free control node with labeled **Input** (`input`, optional one) and **Value** (`value`,
  exactly one) ports.
- Derive the Value schema by applying declared assignments to the propagated Input schema. Unknown expression results
  should remain explicitly unknown rather than making the entire object opaque.
- Configuration faults must block publication. Data-resolution faults may use a standard **Error** outcome only when an
  assignment explicitly depends on an unavailable upstream value.

### Configuration

Represent ordered assignments with:

- target path;
- source mode: constant or upstream expression initially, with workflow constant as a later convenience;
- typed value/expression;
- missing-source policy: fail, omit assignment, use default, or set null;
- collision policy at node level: replace target (default), reject existing, or merge objects;
- optional keep-unassigned-input toggle, default on to preserve current overlay behavior.

Do not support arbitrary script execution. Use the shared bounded expression language and schema-aware picker. Define
path escaping and array behavior centrally.

### Card and inspector

- Card: immutable Set fields identity, editable Title, summary such as `Set 3 fields, preserve input`, labeled ports,
  validation state, and latest test status.
- Inspector Basic: assignment table, source-mode control, field picker, inline type and collision warnings, add/remove/
  reorder, and before/after sample preview.
- Inspector Advanced: raw assignment contract, merge and missing-value policies, inferred output schema, limits, and
  provenance options.

### Test experience and evidence

- Test with saved or pinned sample input without running unrelated upstream steps; support run-to-here to capture a
  real sample and pin the output for downstream authoring.
- Show changed, added, omitted, and overwritten paths in the result.
- Persist compact lineage per assignment: target path, source kind/path or constant digest, action, and whether a prior
  value was replaced. Keep full attempt input/output under existing retention and redaction policy.

### Limits and safe defaults

- Default to preserve input, replace only the exact target, fail on missing required expressions, and one attempt.
- Bound assignment count, path depth, key length, expression complexity, output bytes, and preview bytes. A reasonable
  initial product limit should be selected from shared platform payload budgets, not hard-coded only in this node.
- Detect duplicate/overlapping targets before publish, including parent-child overlaps such as `user` and `user.name`.

## Fix checklist

- [ ] **P0: Validate config during compilation.** Validate every step against its registry config schema and emit a
  field-targeted issue; acceptance: missing/non-object `fields` cannot publish and the executor test remains defense in
  depth.
- [ ] **P1: Define the assignment contract.** Replace the object map with ordered typed assignments and explicit keep,
  collision, and missing-value policies; acceptance: constants, upstream expressions, nested targets, defaults, and
  overlaps have deterministic contract tests.
- [ ] **P1: Add schema propagation.** Infer Value from Input plus assignments; acceptance: downstream picker lists
  assigned fields and incompatible consumers fail preflight.
- [ ] **P1: Upgrade the inspector.** Implement source modes, schema-aware pickers, policy controls, and sample preview;
  acceptance: the common constant and upstream-value cases require no raw JSON or edge-mapping detour.
- [ ] **P1: Standardize errors.** Route missing-source data errors through the shared Error outcome and keep config
  errors out of runtime; acceptance: route and stop modes execute as drawn and deterministic faults are not retried.
- [ ] **P1: Add behavior coverage.** Cover empty, collision, nested replacement/merge, missing source, limits, replay,
  and recovery; acceptance: tests assert executor output, compiler issues, and journal attempts.
- [ ] **P2: Add field lineage.** Persist and render a compact change set; acceptance: run detail identifies each changed
  target and its source without diffing whole objects.

## Shared platform dependencies

- Compile-time manifest config validation with field-targeted editor issues.
- One schema-aware expression and data-picker contract shared by mappings, assignments, templates, and rules.
- Schema propagation and sample propagation through ports and connections.
- Standard success/error outcome routing and enforced retry policy.
- Standard card anatomy, labeled handles, isolated tests, pinned samples, and inline evidence.
- Shared JSON path syntax, payload limits, sensitivity/redaction, and executor semantic pinning.

## Open decisions

1. Should Set fields preserve all input by default, or should the product favor explicit output construction for
   least-data and schema stability?
2. Is deep merge required, or are replace and reject enough when nested target paths are available?
3. How should overlapping target paths be ordered: prohibited, explicit row order, or normalized into one tree?
4. Should unavailable optional expressions omit the target or require an explicit per-row policy?
5. How much field-level lineage can be retained without duplicating sensitive values already present in attempts?