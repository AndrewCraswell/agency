# Manual run (`manual_trigger`) node review

Status: Source-backed design review

Last reviewed: 2026-07-20

Review method: Static inspection of the registry, compiler, executor, journal, service API, web editor, run detail, and
tests. No tests were run and no browser acceptance was performed for this review. Statements about the authoring
experience describe implemented source behavior, not direct browser observations.

## Identity

| Property | Current value |
| --- | --- |
| Kind and version | `manual_trigger@1` |
| Registry label | Manual run |
| Category | Trigger |
| Execution class | Control |
| Mutation policy | None |
| Capabilities | None |
| Inputs | None |
| Outputs | `input` / Workflow input / object / one |
| Error contract | `{ code: string, message: string, retryable?: boolean }` |

Primary source: `apps/agentic/src/workflows/stepRegistry.ts`, `workflowConfigFields.manual_trigger` and the
`manual_trigger` seed. The definition is available from phase 2. Its `executorDigest` is derived from registry version,
kind, node version, and execution class; it does not digest the executor implementation.

## Intended job and mental model

Manual run is the operator-controlled entry boundary for a workflow. A user should understand it as: "accept one
declared workflow input, start one immutable workflow version, and make that input available to the first connected
step." It should not transform data, perform effects, retry work, or introduce a second input contract.

That mental model is only partly true today. The authoritative runtime contract is the workflow-level
`WorkflowDefinition.inputSchema`, not the node's optional `config.inputSchema`. The service validates manual start,
draft-test, and run-again input against the compiled graph input schema before preparing the run. The executor then
passes the prepared value through unchanged under the `input` output port. The node-level schema appears in registry
metadata and the manifest UI field list, but no runtime or compiler path reads it.

## Current contract

### Configuration

- Manifest schema: an object with optional `inputSchema: object`; unknown configuration fields are currently allowed
  because `additionalProperties: false` is not declared.
- Registry UI metadata: `Input schema`, JSON control, Advanced group, not required.
- New-node default: `{}` from `initialStepConfig()` in
  `apps/web/src/routes/WorkflowEditorPage.tsx`.
- Effective input contract: `WorkflowDefinition.inputSchema`, parsed as the supported JSON Schema subset in
  `apps/agentic/src/workflows/definition.ts`.
- Implemented mismatch: `config.inputSchema` is neither compared with nor copied to the workflow input schema.

### Ports and cardinality

- No input port. The service creates the initial activation directly.
- One required output named `input`, labeled `Workflow input`, declared as an open object.
- The output contract therefore cannot represent a workflow whose declared input schema is a scalar or array, even
  though the workflow-level schema type supports those values. Service requests and journal input bindings are also
  object-shaped in the current run path, so the practical workflow input is an object.
- Failure connections are structurally possible through the shared error contract, but this node has no expected
  failure behavior and the dispatcher does not schedule failure edges.

### Execution, effects, and capabilities

- `executeWorkflowStep()` returns `{ input: input.input ?? {} }` with no terminal status, data, usage, or evidence.
- The node is deterministic and performs no provider, model, workspace, artifact, or external mutation work.
- There is no node timeout or retry behavior. The shared `failurePolicy` is present on the step instance, but dispatcher
  execution does not enforce `maximumAttempts` or route mode.
- `WorkflowService.start()` requires exactly one matching manual trigger in the published package. In contrast, the
  compiler only requires at least one trigger of any kind, and draft testing lets the author choose a trigger by ID.
  A workflow with multiple manual triggers can therefore publish but cannot start through the manual API.

## Current authoring experience

The step library is populated from the registry and adding this node uses the registry label and an empty config. The
canvas card renders the editable step label, the category `trigger`, the registry description, and an unlabeled output
handle. It does not retain visible immutable `Manual run` identity after the label is edited, does not label the
`Workflow input` port, and shows no input-shape summary.

`StepInspector` has no `manual_trigger`-specific control. It renders the generic editable `Label` and description, but
does not render the registry's `Input schema` UI field. Workflow details render a test-trigger selector and a
schema-driven test-input editor using `draft.content.inputSchema`; they do not expose a workflow input-schema editor.
Consequently, the registry advertises a node setting that the implemented inspector cannot author, while the actual
workflow input contract is visible only indirectly through test fields.

Draft testing is whole-workflow only. The author selects a trigger, enters workflow input, confirms the durable test,
and is navigated to the run page. There is no isolated trigger test, saved example set, pinned specimen, run-to-here,
or input replay control in the editor. Published manual runs use the same editor test-input text as the run request.

## Runtime, persistence, and evidence

`WorkflowService.test()` and `WorkflowService.start()` validate request input against `graph.inputSchema`, publish or
load an immutable execution package, and call `prepareRun()` with an initial activation binding named `input`.
`start()` derives idempotency from package digest, trigger identity, and input. A reused trigger identity with different
input is rejected by the journal; an identical request can resolve to the already prepared run.

The journal stores the sealed run manifest, activation input bindings, and every attempt. Leasing copies the activation
binding into `workflowAttempts.input`; success records the executor output in `workflowAttempts.output` and appends an
`attempt.succeeded` event. The run-detail API and page expose generic attempt input, output, error, usage, and evidence,
plus immutable graph and trigger identity. Manual run emits no node-specific evidence or data record. There is no
explicit evidence field saying which input schema was evaluated or its digest, although the immutable graph contains
the workflow schema.

Run Again defaults to the original sealed input, validates any replacement against the immutable graph schema, and
prepares another run. Manual retry is not meaningful for a pure pass-through activation, but generic retry controls can
create another attempt after a failure elsewhere in the platform.

## Existing validation and tests

Implemented validation:

- `WorkflowDefinitionSchema` validates the workflow input against the supported JSON Schema syntax when a draft is
  accepted by the API.
- `WorkflowService.test()`, `start()`, and `runAgain()` validate supplied data before run preparation.
- The compiler checks trigger presence, reachability, terminal reachability, ports, mappings, and cycles.
- The web test-input editor identifies missing required top-level fields before requesting a draft test.

Existing coverage includes the registry order and UI metadata in `stepRegistry.test.ts`; canonical package compilation
in `compiler.test.ts`; service creation, validation, publication, manual test/start paths, and trigger summaries in
`service.test.ts`; deterministic trigger/data execution in `workflowExecutor.test.ts`; durable create-to-run behavior in
`workflowLifecycle.integration.test.ts`; and editor trigger selection and draft-test request behavior in
`WorkflowEditorPage.test.tsx`.

Material test gaps:

- No test proves `config.inputSchema` has an effect, because it has none.
- No compiler/service test rejects or resolves multiple published manual triggers before start.
- No contract test proves the workflow schema and trigger output schema are identical and support the same root types.
- No boundary tests cover large input, schema depth, property count, or journal payload limits.
- No authoring test expects a visible immutable type, labeled output, schema summary, saved examples, or schema editing.
- No browser, keyboard, accessible-name, or mobile acceptance evidence was collected for this review.

## Representative behavior matrix

| Case | Current behavior | Judgment |
| --- | --- | --- |
| Empty object with open workflow schema | Run is prepared; node emits `{ input: {} }` | Valid and deterministic |
| Valid object matching required workflow fields | Service accepts it; attempt preserves input and output | Valid |
| Missing required workflow field | Test/start rejects before run preparation | Correct preflight |
| Value rejected only by `config.inputSchema` | Run proceeds if workflow schema accepts it | Contract defect: node config is inert |
| Multiple manual triggers in a published graph | Compilation can succeed; manual start rejects the ambiguous package | Publication/start contract defect |
| Duplicate trigger identity and same request | Journal returns the existing prepared run | Correct idempotent preparation |
| Duplicate trigger identity and different input | Journal rejects the conflicting request digest | Correct conflict protection |
| Executor receives no `input` binding | Emits an empty object | Defensive default hides malformed activation |
| Retry or timeout | No intrinsic need and no node policy; shared retry policy is not enforced | Platform gap, low node-specific value |
| Recovery | Run Again reuses or replaces sealed input; generic retry preserves prior attempts | Useful durable recovery, not editor-local |

## Expert judgments

### Competitive Expert

n8n Manual Trigger commonly acts as a simple test start, while workflow inputs are handled by explicit form, webhook,
or sub-workflow contracts. Make and Power Automate similarly keep trigger payload definition at the trigger boundary and
provide sample or dynamic content downstream. Agency's durable immutable-package model is stronger for replay and
audit, but the duplicate node-level and workflow-level schema concepts are less predictable than those products. Keep
one authoritative workflow input contract, render it on Manual run, and add named saved examples rather than exposing a
second advanced schema field.

### UX Expert

The common action is clear in the library, but the card loses type identity after label editing and its only port is an
unlabeled dot. The inspector provides no task-specific information, while the actual input form is located under
workflow details. The node should act as the visual home of the workflow input contract: show its shape, examples, and
latest test status without requiring authors to infer the relationship between global details and the trigger.

### User Researcher

Developers and platform engineers will ask which schema is authoritative and whether it is pinned with the run.
Workflow specialists need discoverable fields and reusable examples. Operators need to know exactly which trigger and
input created a run and whether a rerun changed the input. The journal answers much of the operational question, but
the authoring surface does not establish trust because the advertised node schema is not enforced and ambiguous manual
triggers fail only at start time.

## Findings

| Priority | Finding and evidence | Impact |
| --- | --- | --- |
| P0 | **The registry exposes an inert input contract.** `stepRegistry.ts` declares `manual_trigger.config.inputSchema`; `WorkflowEditorInspector.tsx` has no corresponding control; `WorkflowService.test/start/runAgain` validate only `graph.inputSchema`; `executeWorkflowStep()` ignores node config. | Authors can believe a schema is enforced when it is not. Published behavior is governed by a different, poorly surfaced contract. |
| P0 | **Publication permits an operator entry point that cannot be started.** `compiler.ts::validateReachability()` accepts multiple triggers, while `service.ts::start()` requires exactly one matching manual trigger. | A compiler-valid published workflow can fail at its primary invocation boundary. |
| P1 | **The trigger output is only an open object and is not derived from workflow input schema.** See the registry seed and `compiler.ts::aggregatePortSchema()`. | Downstream mapping checks and authoring cannot discover actual fields; scalar/array schema claims are incoherent with the run and port envelopes. |
| P1 | **The card and inspector hide immutable type, port label, schema summary, and examples.** See `WorkflowCanvasNode` and `StepInspector`. | Authors cannot quickly distinguish renamed triggers or understand available data. |
| P1 | **Testing has no saved examples or node-local entry point.** See `WorkflowTestInputEditor` usage and `WorkflowEditorPage.test()`. | Repeated testing is manual and regression specimens are not reusable or reviewable. |
| P2 | **Attempt evidence does not record an explicit evaluated schema digest or example name.** See `workflowJournalStore.ts::completeAttempt()` and `RunDetailPage`. | The package permits reconstruction, but operators must correlate generic graph and attempt data themselves. |

## Recommended target contract

### Identity and ports

- Keep `manual_trigger@1` as a pure, effect-free control node named **Manual run**.
- Remove `config.inputSchema`. Make `WorkflowDefinition.inputSchema` the sole authoritative input contract and render a
  read/write projection of it on the node inspector.
- Expose one labeled output: **Input** (`input`, exactly one), with its schema derived from the workflow input schema.
- Do not expose an error output for ordinary input mismatch; reject invalid input before run creation with structured
  field issues. Reserve an internal fault path for package or journal failures outside the node graph.
- Decide either that one workflow may have exactly one Manual run trigger, enforced at compile time, or identify the
  manual trigger in the public start request. Prefer one trigger for the current operator workflow model.

### Card and inspector

- Card: immutable `Manual run` identity, editable Title, `Input: <shape summary>`, labeled Input port, validation state,
  latest test status and duration.
- Inspector Basic: Title, visual workflow input-schema builder, required/optional fields, descriptions, defaults where
  defaults have explicit runtime semantics, and saved test examples.
- Inspector Advanced: raw supported JSON Schema, schema digest, root-type policy, and payload limits.
- Show inline conflicts if another Manual run trigger exists and focus the existing trigger from the error.

### Test experience and evidence

- Support named saved examples, validate-before-run, Test from here, and replay from a prior run with a visible diff
  when input changes.
- Persist example ID/name when used, input digest, evaluated workflow-schema digest, package digest, trigger step ID,
  and validation result alongside the existing sealed input and attempt records.
- Continue to create durable server runs for full tests; a schema-only preflight should not create a run.

### Limits and safe defaults

- Default to an object schema with no required fields for a new blank workflow, but make open versus closed additional
  properties an explicit choice.
- Establish shared limits for encoded input bytes, nesting depth, property count, array size, and saved-example count;
  enforce the same limits in editor preflight, API parsing, journal persistence, and runtime.
- Keep the trigger non-retryable and without a node timeout. Input validation failures must not create attempts.

## Fix checklist

- [ ] **P0: Establish one input contract.** Remove `manual_trigger.config.inputSchema` from the registry and UI metadata;
  acceptance: repository search finds no node-level input schema and manual test/start/run-again all use the workflow
  contract covered by one shared contract test.
- [ ] **P0: Resolve manual-trigger multiplicity.** Enforce exactly one Manual run trigger for workflows that support
  operator starts; acceptance: validation returns a targeted issue before publish and every accepted package can be
  started manually.
- [ ] **P1: Derive the output schema.** Compile the `input` port from `WorkflowDefinition.inputSchema`; acceptance:
  downstream field mapping sees declared fields and incompatible mappings fail before publish.
- [ ] **P1: Build the trigger inspector.** Add the visual schema editor, raw Advanced view, and saved examples;
  acceptance: an author can define, preview, save, select, and validate an example without editing JSON for the common
  object case.
- [ ] **P1: Make node anatomy visible.** Retain immutable Manual run identity and label the Input port on card and
  outline; acceptance: renamed nodes remain identifiable and all handles have visible and accessible names.
- [ ] **P1: Add focused contract tests.** Cover valid, invalid, empty, boundary, ambiguous-trigger, idempotent duplicate,
  conflicting duplicate, and rerun cases; acceptance: tests assert service response plus persisted attempt evidence.
- [ ] **P2: Enrich run evidence.** Store schema digest and selected example identity; acceptance: run detail displays
  them without reconstructing values from unrelated panels.

## Shared platform dependencies

- Manifest-driven defaults and inspector controls, so registry UI metadata cannot advertise an unimplemented field.
- Schema propagation from workflow interfaces through node ports, mappings, autocomplete, and previews.
- Standard node card anatomy with immutable type identity, labeled ports, status, and concise summaries.
- Saved samples, isolated/run-from-here testing, and inline latest-run evidence.
- Shared payload and JSON complexity limits across API, compiler, journal, and editor.
- Executable semantic pinning stronger than the current metadata-derived `executorDigest`.

## Open decisions

1. Must every workflow have exactly one Manual run trigger, or may event-only workflows omit it and multi-entry
   workflows select a manual trigger by ID?
2. Is workflow input intentionally object-only? If yes, narrow the supported contract and copy accordingly; if no,
   revise run envelopes and port schemas to support every declared JSON root type.
3. Are schema defaults documentation only, editor conveniences, or runtime-applied values?
4. Are saved examples versioned with the draft, published package, user profile, or a separate test-fixture store?
5. Which input fields require redaction or classification in run detail and saved examples?