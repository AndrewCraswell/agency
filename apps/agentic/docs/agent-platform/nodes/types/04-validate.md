# Validate (`validate`) node review

Status: Source-backed design review

Last reviewed: 2026-07-20

Review method: Static inspection of the registry, compiler, executor, journal, service API, web editor, run detail, and
tests. No tests were run and no browser acceptance was performed for this review. Statements about the authoring
experience describe implemented source behavior, not direct browser observations.

## Identity

| Property | Current value |
| --- | --- |
| Kind and version | `validate@1` |
| Registry label | Validate |
| Category | Data |
| Execution class | Control |
| Mutation policy | None |
| Capabilities | None |
| Input | `value` / Value / object / one |
| Output | `value` / Validated value / object / one |
| Error contract | `{ code: string, message: string, retryable?: boolean }` |

Primary source: `apps/agentic/src/workflows/stepRegistry.ts`, `workflowConfigFields.validate` and the `validate` seed.
It is a phase-2 local control node. The configured schema is stored in the immutable graph, but the registry's generic
object ports do not carry it as a refinement.

## Intended job and mental model

Validate should establish a trustworthy data boundary: evaluate a value against a declared schema, pass the unchanged
value through when valid, and expose structured validation issues as an expected invalid outcome when it is not. An
author should be able to use it as a type guard, inspect which constraints failed, and choose whether invalid data is
routed for handling or fails the workflow.

The current happy path performs the core check and preserves the value. The invalid path does not behave as a business
outcome: it returns terminal failure, the dispatcher fails the attempt and run, and no downstream failure edge is
scheduled. The node also claims JSON Schema validation generally while both ports are declared as object. This makes
primitive and array schemas incoherent: the schema editor accepts them and `validateJsonValue()` supports them, but
connection compatibility and post-execution output validation require an object.

## Current contract

### Configuration

- Required `schema` property declared only as an object. Unknown config properties are allowed by the manifest.
- New-node default: `{ schema: { type: "object" } }` from `WorkflowEditorPage.tsx::initialStepConfig()`.
- UI metadata places `Validation schema` in Advanced with a JSON control.
- Specialized inspector renders a collapsed `Advanced schema` section containing `DraftJsonField`.
- This use of `DraftJsonField` checks JSON editing but is not passed `supportedJsonSchemaError`; unsupported schema
  keywords or malformed supported-schema combinations are not surfaced by this inspector as semantic validation.
- `validateJsonValue()` parses the schema with `SupportedJsonSchemaSchema` at runtime. Supported constraints include
  type, enum, const, properties/required/items/additionalProperties, numeric/string/array bounds, UUID/date-time/URI,
  default, and description. Defaults are not applied.
- Compiler does not parse or validate the configured schema before publication.

### Ports and cardinality

- One required open-object Value input and one required open-object Validated value output.
- On valid input, runtime emits the original value unchanged.
- On invalid input, runtime emits no output and returns error code `validation_failed` with all issues concatenated into
  one message.
- No explicit Invalid output exists and issue objects are not retained as structured data.
- The shared error schema permits failure connections at compile time, but the dispatcher ignores all failure edges.
- Because output validation runs after node execution, a primitive that successfully validates against a primitive
  schema then fails the generic object output contract and becomes `step_failed` rather than validated output.

### Execution, effects, and capabilities

The executor reads `input.value ?? {}`, calls `validateJsonValue(step.config.schema, value)`, and either returns the
unchanged value or a terminal `validation_failed` result. The operation is deterministic and local, has no external
effects or capabilities, produces no artifact/usage/evidence, and needs no node timeout. Validation failures are
deterministic for immutable input and schema and should not be retried. The dispatcher nevertheless does not interpret
retryability or enforce configured attempt policy; it simply records one failed attempt and terminal run status.

## Current authoring experience

The card renders editable title, `data` category, description, and unlabeled input/output handles. It does not retain
immutable Validate identity after rename, show the schema summary, indicate invalid routing, or display latest validity.

The only node-specific control is raw JSON under Advanced. There is no basic visual schema builder, upstream inferred
schema, schema import, field picker, sample evaluation, issue preview, strictness summary, or mode selector for route
versus fail. Authors can enter `{"type":"string"}` in the implemented editor test even though the node ports are
object-only. The UI therefore permits a configuration that the full node contract cannot execute successfully for a
string value.

Whole-draft testing can run the node and the run page can show the failed attempt, but there is no isolated sample
validation, run-to-here, pinned fixture, inline result, or direct repair link to the failing schema keyword. Failure is
represented as a run failure rather than an authorable Invalid branch.

## Runtime, persistence, and evidence

For valid input, the journal stores resolved attempt input, unchanged output, empty evidence, and an
`attempt.succeeded` event before scheduling success descendants. The immutable execution package stores the configured
schema and generic input/output snapshots.

For invalid input, `executeWorkflowStep()` creates code `validation_failed` and a message such as
`$.status: Value is not one of the allowed values`. `WorkflowDispatcher` calls `failAttempt()` with terminal status
`failed`. The journal stores the generic error, marks the activation and run failed, and appends `attempt.failed` whose
event payload retains only the error code. No structured list of `{ path, message }`, schema digest, or invalid value
digest is stored in node evidence. Run detail exposes the generic attempt input/error and offers generic retry actions;
retrying unchanged input and schema repeats the validation result. Correct recovery is to fix input upstream or publish
a corrected schema, then Run Again or start a new version.

## Existing validation and tests

Implemented validation:

- `SupportedJsonSchemaSchema` strictly parses the supported schema vocabulary when `validateJsonValue()` executes.
- `validateJsonValue()` returns path-specific issues for supported constraints.
- Runtime validates the manifest config envelope and its post-execution output envelope.
- Compiler validates graph topology, generic port mappings, and reachability, but not Validate config, schema
  satisfiability, source-schema assignability to the configured schema, or outcome handling.

`jsonSchema.test.ts` has substantial unit coverage for supported types, enum/const, objects, arrays, numeric and string
constraints, formats, unions, schema paths, assignability, and unsupported schema parsing. `workflowExecutor.test.ts`
proves an enum mismatch returns `validation_failed` and a non-object config schema is rejected at execution.
`stepRegistry.test.ts` asserts the Advanced required JSON field metadata. `WorkflowEditorPage.test.tsx` opens the
Advanced section and edits invalid then valid JSON, including a string schema.

Material test gaps:

- No end-to-end test proves a valid object proceeds and persisted output remains unchanged.
- No test exposes the primitive/array schema versus object-port contradiction.
- No compiler/service test rejects an unsupported or malformed configured schema before publish.
- No dispatcher test proves Invalid routing, because routing is not implemented, or verifies that failure edges are
  currently ignored.
- No test asserts structured issue persistence, schema digest, redaction, maximum issue count, large payload, or deep
  schema limits.
- No retry test asserts validation failures are non-retryable or guides recovery.
- No browser, keyboard, accessible-name, or mobile acceptance evidence was collected for this review.

## Representative behavior matrix

| Case | Current behavior | Judgment |
| --- | --- | --- |
| Object matches object schema | Emits the same object on `value` | Correct type-guard happy path |
| Required field missing | Terminal `validation_failed` with path in message | Useful issue, wrong outcome semantics |
| Multiple constraints fail | Issues are concatenated into one message | Human-readable but not composable evidence |
| Additional field with `additionalProperties: false` | Terminal validation failure | Correct validator behavior |
| Empty object and `{ type: "object" }` | Valid | Safe permissive default, little value |
| Schema `{ type: "string" }`, value is string | Validator accepts, output contract rejects object mismatch | P0 contract contradiction |
| Unsupported schema keyword | Compiler can publish; runtime schema parser throws `step_failed` | Publication/runtime defect |
| Missing input binding | Executor substitutes `{}` before validation | Can hide malformed activation when schema accepts object |
| Failure edge configured | Compiler accepts error source; dispatcher terminates without routing | P0 platform defect |
| Retry | Generic retry repeats deterministic invalid result | Misleading recovery action |
| Timeout | None | Appropriate for bounded local validation; bounds are missing |
| Recovery | Correct upstream value or publish schema change, then new run | Correct immutable model, no targeted authoring support |

## Expert judgments

### Competitive Expert

n8n's IF/Switch and schema-oriented community nodes, Make routers with filters, and Power Automate Parse JSON/Condition
patterns generally make success versus mismatch authorable and expose parsed dynamic content downstream. Power
Automate's Parse JSON is especially relevant because schema establishes downstream tokens, though failures often need
explicit scope handling. Agency should do better by combining schema-derived typing with first-class Valid and Invalid
outcomes and durable structured issues. Invalid business data must not masquerade as an infrastructure fault.

### UX Expert

Putting the only control under Advanced makes the node effectively expert-only. There is no visible answer to "what is
being checked" or "where does invalid data go." Unlabeled handles worsen that ambiguity. A visual schema summary,
sample evaluator, and labeled Valid/Invalid outputs should make the basic contract legible; raw JSON and uncommon
keywords belong in Advanced.

### User Researcher

Developers need exact supported-dialect behavior and structured paths. Workflow specialists need invalid data to be a
normal route, not a dead run. Platform engineers need schema propagation, bounded complexity, and semantic pinning.
Operators need actionable issue lists, redacted invalid-value context, and a recovery action that does not suggest a
pointless retry. Current validation messages are useful, but the terminal semantics and generic evidence undermine
trust.

## Findings

| Priority | Finding and evidence | Impact |
| --- | --- | --- |
| P0 | **Invalid data is an unroutable terminal failure.** `executeWorkflowStep()` returns terminal `validation_failed`; dispatcher calls `failAttempt()` and `downstreamActivations()` considers only success edges. | Expected business invalidity stops the run, and a graph drawn with failure handling does not execute as authored. |
| P0 | **General JSON Schema support contradicts object-only ports.** `jsonSchema.ts` supports all JSON root types; registry ports are `objectSchema`; runtime post-validates output against those ports. | Valid primitive/array data cannot reliably pass through, despite being accepted by the schema editor and validator. |
| P0 | **Configured schema validity is not a publish gate.** Compiler does not call `SupportedJsonSchemaSchema` for the node config; runtime is first semantic parse. | A workflow can publish with an unsupported schema and fail deterministically on first use. |
| P1 | **Issues are flattened into one error message and no Invalid payload exists.** See the Validate executor branch. | Downstream remediation, metrics, field highlighting, and durable analysis cannot consume issue structure. |
| P1 | **Inspector is raw Advanced JSON only and does not evaluate samples.** See `WorkflowEditorInspector.tsx` and `DraftJsonField` usage. | Basic validation tasks require schema expertise and incompatibilities are discovered during a full run. |
| P1 | **Configured retries and generic retry actions are semantically wrong for unchanged validation input.** See `failurePolicy`, dispatcher, and run actions. | Operators can repeat deterministic failures without a repair path. |
| P2 | **Evidence omits schema/value digests and structured issue metadata.** See journal attempt/event writes and empty node evidence. | Audit and aggregate quality analysis require reconstructing context from full package and payloads. |

## Recommended target contract

### Identity and ports

- Keep `validate@1` as an effect-free deterministic type guard.
- Input: labeled **Value** (`value`, exactly one), with any JSON value supported if the workflow platform supports it.
- Outputs: labeled **Valid** (`valid`, at most one) carrying the unchanged value refined to the configured schema, and
  **Invalid** (`invalid`, at most one) carrying `{ value, issues, schemaDigest }` or a redaction-aware equivalent.
- Reserve standard **Error** for evaluator/configuration/internal faults that escaped publication checks. Invalid data
  is not Error.
- Add mode `route_invalid` (default) or `fail_invalid`. In fail mode, store the same structured issue payload and fail
  intentionally without suggesting retry.

If the platform remains object-only, explicitly restrict both workflow schemas and this schema editor to object roots.
Do not keep the current mixed claim. Supporting all JSON values is the preferred scalable contract.

### Configuration

- One supported JSON Schema dialect/version, recorded explicitly and parsed at draft update/compile time.
- Visual object-schema builder for fields, required state, types, enums, descriptions, object closure, and common bounds.
- Raw schema Advanced view with round-trip preservation only for supported keywords.
- Invalid behavior mode, maximum reported issues, and redaction/classification policy.
- Optional schema import from propagated upstream shape or pasted sample, with explicit author confirmation.

### Card and inspector

- Card: immutable Validate identity, editable Title, concise schema summary such as `Order with 4 required fields`,
  labeled Valid and Invalid ports, mode badge, validation state, and latest sample/run status.
- Inspector Basic: visual schema, inferred upstream compatibility, strictness controls, sample input, Evaluate action,
  structured issue list, and output-shape preview.
- Inspector Advanced: raw schema, dialect/parser version, digest, issue and complexity limits, and fail mode.

### Test experience and evidence

- Evaluate pasted, saved, pinned, or run-to-here samples without running downstream steps.
- Show each issue by JSON path, keyword/category, expected constraint, and safe actual-type summary.
- Persist schema digest/version, validation outcome, issue count, bounded structured issues, input digest, duration, and
  truncation flag. Keep raw invalid values under the standard attempt retention/redaction policy rather than duplicating
  them in evidence.
- Recovery should offer `Open schema`, `Inspect upstream output`, and `Run again with corrected input`; disable Retry
  step for unchanged deterministic invalidity.

### Limits and safe defaults

- Default to `route_invalid`, closed object only when the author chooses it, bounded issue count, and one attempt.
- Set shared limits for schema bytes/depth/property count, input bytes/depth/item count, evaluation duration, issue
  count/message length, and evidence bytes. Detect schemas exceeding limits before publish.
- Reject unsupported keywords and internally inconsistent constraints at compile time where feasible. Document that
  `default` is annotation-only unless the platform deliberately adds a separate apply-defaults transformation.

## Fix checklist

- [ ] **P0: Implement expected outcomes.** Add Valid and Invalid ports and schedule the selected branch durably;
  acceptance: valid and invalid object cases activate exactly one labeled path and invalid does not fail the run in
  default mode.
- [ ] **P0: Resolve root-type support.** Make ports/envelopes support any JSON value or restrict schemas to objects;
  acceptance: every schema accepted by the inspector has a successful valid-value execution path.
- [ ] **P0: Validate schemas before publish.** Parse the configured schema and limits during draft validation/compiler;
  acceptance: unsupported/malformed schemas produce field-targeted issues and cannot enter an execution package.
- [ ] **P1: Preserve structured issues.** Define the Invalid payload and journal evidence; acceptance: path/category/
  message remain machine-readable, bounded, and visible in run detail.
- [ ] **P1: Build the basic schema inspector.** Add visual editing, upstream compatibility, sample evaluation, and mode;
  acceptance: a common object contract can be authored and tested without raw JSON.
- [ ] **P1: Align recovery and retry.** Mark invalid outcomes non-retryable and expose targeted repair actions;
  acceptance: unchanged invalid attempts do not present Retry step as the primary action.
- [ ] **P1: Add end-to-end coverage.** Cover valid, invalid, empty, primitive/array policy, multiple issues, limits,
  fail mode, route mode, persistence, and recovery; acceptance: compiler, dispatcher, journal, API, and editor tests
  assert one coherent contract.
- [ ] **P2: Add validation metrics evidence.** Acceptance: run detail and aggregate telemetry can report schema digest,
  outcome, issue count, duration, and truncation without reading raw values.

## Shared platform dependencies

- Standard success, expected-outcome, error, timeout, and indeterminate routing implemented by the durable dispatcher.
- Enforced retryability and recovery actions rather than stored-only failure policy.
- Compile-time registry config validation with field-targeted issues.
- Schema propagation/refinement through ports, connections, picker data, and output previews.
- A shared visual/raw schema editor and explicit supported dialect.
- Standard card anatomy, labeled ports, isolated tests, pinned samples, and inline latest evidence.
- Shared payload/schema complexity limits, sensitivity/redaction, and executable semantic pinning.

## Open decisions

1. Does the workflow data plane support every JSON root type, or intentionally only object envelopes?
2. Is Invalid routed by default, failed by default, or selected explicitly when the node is added?
3. Should the Invalid payload include the original value, a reference/digest, or a redacted projection?
4. Which JSON Schema dialect and keyword subset is the long-term public contract, and how are dialect upgrades pinned?
5. Should schema defaults remain annotations, produce warnings, or be applied by a separate transformation node?
6. What issue count and schema/input complexity limits balance useful diagnosis with bounded durable execution?