# Map fields (`map_fields`) node review

Status: Source-backed design review

Last reviewed: 2026-07-20

Review method: Static inspection of the registry, compiler, executor, journal, service API, web editor, run detail, and
tests. No tests were run and no browser acceptance was performed for this review. Statements about the authoring
experience describe implemented source behavior, not direct browser observations.

## Identity

| Property | Current value |
| --- | --- |
| Kind and version | `map_fields@1` |
| Registry label | Map fields |
| Category | Data |
| Execution class | Control |
| Mutation policy | None |
| Capabilities | None |
| Input | `input` / Input / object / one |
| Output | `value` / Mapped value / object / one |
| Error contract | `{ code: string, message: string, retryable?: boolean }` |

Primary source: `apps/agentic/src/workflows/stepRegistry.ts`, `workflowConfigFields.map_fields` and the `map_fields`
seed. It is a phase-2 deterministic transformation. The registry and execution-package snapshot describe generic
object ports, not the selected fields or their inferred schemas.

## Intended job and mental model

Map fields should let an author project, rename, and reshape upstream data without code. The expected mental model is a
two-column mapping: select a source field from known input, choose a target field, resolve optional/missing behavior,
and preview the output shape.

The current implementation is a deterministic top-level projection and rename. `config.mappings` is an object whose
keys are literal top-level output names and whose values are dot-separated source-path strings. The runtime reads every
source path from the input and assigns the selected value to the corresponding top-level output key. It does not keep
unmapped fields, create nested targets, provide defaults, convert types, map arrays, or treat missing values as
optional.

## Current contract

### Configuration

- Required `mappings` property declared only as an open object; the manifest does not constrain each value to string.
- New-node default: `{ mappings: {} }` from `WorkflowEditorPage.tsx::initialStepConfig()`.
- Specialized inspector uses `ObjectRowsField` with `Output field` and text `Source path`.
- Editor keys must be non-empty and unique. Source text can be empty or contain any characters.
- Runtime requires each mapping value to be a string, splits on `.`, and removes empty segments. Thus `issue..title`
  behaves like `issue.title`, and an empty string selects the entire input object.
- Output targets are literal object keys. A target `user.name` creates a key containing a dot; it does not create a
  nested object.
- Compiler does not validate config or source-path availability. Its connection mapping checks apply to edges, not to
  `map_fields.config.mappings`.

### Ports and cardinality

- One required open-object Input and one required open-object Mapped value output.
- The compiler enforces connection cardinality when more than one edge targets Input, but does not separately report a
  required port with no connection. Reachability usually requires some path into the node, not a proven data binding.
- The output schema does not reflect target names or source schemas.
- A missing source is an execution error, not an expected outcome. Although a shared failure connection can compile,
  the dispatcher schedules only success connections.

### Execution, effects, and capabilities

`workflowExecutor.ts::mappedFields()` iterates object entries in configured order, validates each source as string,
uses `readPath()` to require every segment, and assigns the value to `result[target]`. Empty mappings emit an empty
object. The operation is deterministic, local, effect-free, and has no provider/model/workspace capability, artifact,
usage, or specialized evidence. There is no node timeout. Manual replay is safe; configured retries are not enforced
and cannot repair a missing deterministic source.

## Current authoring experience

The step library adds an empty mapper. The card displays editable title, `data` category, registry description, and
unlabeled handles. It does not retain immutable Map fields identity after rename, list mappings, show output shape, or
indicate that missing fields fail the run.

The inspector's row editor is direct and supports rename in the simplest case. It does not offer upstream schema or
sample discovery, autocomplete, nested target controls, optional/default behavior, conversion, row ordering guidance,
or output preview. Source paths are unvalidated free text. Because edge mappings use a different array-of-path-segments
contract in `WorkflowConnectionSchema`, authors encounter two unrelated mapping syntaxes in the same editor: dot text
inside this node and structured source/target path arrays on connections.

Whole-draft testing can exercise the node through a durable run, and run detail later shows generic input/output. There
is no Test node control, run-to-here, pinned input, field-level preview, or inline latest attempt. Invalid source paths
are discovered only after upstream work reaches this node.

## Runtime, persistence, and evidence

The dispatcher resolves incoming connection bindings, leases an attempt, and invokes the local executor. On success,
the full resolved input and `{ value: mappedObject }` output are persisted in the attempt, downstream activations are
created atomically, and an `attempt.succeeded` event is recorded. The immutable package preserves config and generic
port contracts.

Map fields emits no data or evidence record and records no source-to-target lineage beyond raw config. On missing path,
non-string mapping value, or object-envelope failure, the dispatcher normalizes the thrown error to
`{ code: "step_failed", message }`, fails the attempt, and marks the run failed. It does not schedule a configured
failure edge. Retry and Retry from here preserve prior attempts, but rerunning the same immutable package with the same
input repeats the deterministic failure. Recovery requires different input or a corrected, republished definition.

## Existing validation and tests

Implemented validation:

- Workflow and config values must be JSON at API boundaries.
- Editor output keys are non-empty and unique.
- Runtime validates `mappings` is an object, each source is a string, input is an object, and every path exists.
- Runtime validates the generic output envelope.
- Compiler validates graph-level ports and edge mappings, but not node mapping entries or inferred output.

`stepRegistry.test.ts` confirms registry ordering but has no Map fields metadata assertion. `workflowExecutor.test.ts`
proves a successful two-field nested-source projection and a missing-source error. `WorkflowEditorPage.test.tsx` adds
Map fields and edits one output/source row. Compiler fixtures include the node kind but do not validate its config or
field projection semantics.

Material test gaps:

- No test covers empty mappings/input, empty source string, repeated dots, keys containing dots, arrays, `null`, deep
  paths, root selection, numeric config values, or prototype-like property names.
- No compile/publish test rejects malformed mapping values or paths.
- No tests define maximum mapping count, path depth, key length, or output size.
- No editor test covers duplicate keys, invalid state recovery, row removal, autosaved shape, or source discovery.
- No dispatcher/journal test asserts the persisted `step_failed` detail, failure routing, retry, or recovery behavior.
- No browser, keyboard, accessible-name, or mobile acceptance evidence was collected for this review.

## Representative behavior matrix

| Case | Current behavior | Judgment |
| --- | --- | --- |
| `title -> issue.title` and source exists | Emits `{ title: sourceValue }` | Valid projection/rename |
| Multiple mappings | Emits only configured top-level targets | Valid deterministic selection |
| Empty mappings | Emits `{}` | Valid but likely deserves a warning |
| Empty source string | Copies the entire input under the target key | Undocumented boundary behavior |
| Source `issue..title` | Empty segment is discarded | Lenient syntax can hide mistakes |
| Missing source | Throws; dispatcher records terminal `step_failed` | Too severe for optional business data |
| Source value is `null`, array, or object | Copies it unchanged | Supported |
| Target `user.name` | Produces literal key `"user.name"` | Surprising; nested targets are missing |
| Mapping value is not a string | Compiler can accept; runtime throws | Publication/runtime defect |
| Conversion needed | Not supported | Major composability gap |
| Failure edge configured | Never activated | Shared correctness defect |
| Retry/timeout | No timeout; retry repeats immutable deterministic result | Retry should be disabled for unchanged input |
| Recovery | Correct input or new published mapping is required | Operationally sound, not guided in editor |

## Expert judgments

### Competitive Expert

n8n mapping expressions, Make's visual mapper, and Power Automate dynamic content all expose upstream values while the
author configures the destination. They generally support missing-value handling and lightweight conversion, though
their expression flexibility can become opaque. Agency should adopt the discoverability and preview patterns while
keeping a constrained, versioned expression language. The present dot-string mapper and separate edge path-array model
are below competitive expectations and create avoidable contract fragmentation.

### UX Expert

The labels `Output field` and `Source path` communicate direction, but a blank text box asks users to recall invisible
payload structure. Empty and malformed path forms receive no immediate feedback. Literal versus nested targets are not
explained, and the card offers no summary. The target experience should make source selection visual, target shape
explicit, and optional/default behavior visible per row, with a sample output that updates before execution.

### User Researcher

Developers want precise path escaping, typing, and deterministic missing-field semantics. Workflow specialists want
dynamic content and conversions without learning internal envelopes. Platform engineers need schema propagation and
bounds. Operators need to see which mapping failed and with which source availability, without exposing sensitive
values. Generic attempt input/output and one concatenated error message are enough for small prototypes but not for
large operational workflows.

## Findings

| Priority | Finding and evidence | Impact |
| --- | --- | --- |
| P0 | **Malformed mapping config can publish.** The registry constrains `mappings` only to object, compiler omits config validation, and `mappedFields()` first enforces string values. | Deterministic production failures can pass workflow validation and publication. |
| P1 | **Source paths use unvalidated dot strings with lossy parsing.** See `workflowExecutor.ts::mappedFields()` and `readPath()`. | Empty segments and property names containing dots are ambiguous; authors discover missing paths only at runtime. |
| P1 | **Targets are flat and no defaults, optional handling, or conversions exist.** See assignment to `result[target]`. | Common reshaping tasks require extra nodes or cannot be expressed safely. |
| P1 | **Node mappings and edge mappings use different contracts.** Compare `config.mappings` with `WorkflowFieldMappingSchema`. | Authors and extension developers must learn two syntaxes; shared picker, validation, and lineage cannot be reused cleanly. |
| P1 | **Output schema is not inferred and editor has no data discovery or preview.** See registry ports, `StepInspector`, and `ObjectRowsField`. | Composition remains guesswork and downstream compatibility cannot be checked. |
| P1 | **Missing-source failure cannot route and should not retry unchanged data.** See dispatcher success-only `downstreamActivations()` and `failAttempt()`. | Expected sparse-data handling terminates the workflow despite visible failure contracts. |
| P2 | **Evidence does not identify per-row resolution.** The node returns empty `data` and no `evidence`. | Operators must infer the failed or copied mapping from config and full payloads. |

## Recommended target contract

### Identity and ports

- Keep an effect-free deterministic node with labeled **Input** (`input`, exactly one), **Mapped value** (`value`,
  exactly one), and standard **Error** only for configured fail-on-missing or conversion failures.
- Propagate the Input schema and infer the Mapped value schema from source fields, targets, defaults, and conversions.
- Treat mapping syntax/config errors as compile-time issues, never runtime outcomes.

### Configuration

Use ordered mappings with structured paths:

- source selected through the shared schema-aware picker/expression model;
- nested target path using the same canonical path representation as connections;
- missing-source policy: fail, omit, default, or null;
- optional default value;
- bounded conversion: string, number, integer, boolean, date-time normalization, first/array wrapping where type-safe;
- explicit array projection only after a shared collection-expression design exists.

Avoid arbitrary scripts and implicit coercion. Reject duplicate and overlapping targets before publish. Preserve property
names losslessly through structured path segments.

### Card and inspector

- Card: immutable Map fields identity, editable Title, summary such as `Map 4 fields`, output-shape hint, labeled ports,
  validation state, and latest test result.
- Inspector Basic: two-column source/target mapper, schema tree search, optional/default and conversion controls, type
  compatibility, add/remove/reorder, and sample output preview.
- Inspector Advanced: raw structured mapping contract, inferred schema, expression/path version, limits, and compact
  lineage policy.

### Test experience and evidence

- Accept pinned sample input or run-to-here output; evaluate mappings locally when safe and show each row as resolved,
  omitted, defaulted, converted, or failed.
- Persist compact row evidence with target path, source path/expression digest, resolution state, conversion, and error
  code. Avoid duplicating raw sensitive values outside generic attempts.
- Provide a repair action that opens the failed mapping row and can test against the failed attempt input in a draft.

### Limits and safe defaults

- Default missing-source policy should be fail for required source schemas and omit for explicitly optional sources;
  require authors to confirm ambiguity when schema is unknown.
- Default to no implicit conversion and no retention of unmapped fields.
- Bound mapping count, path depth, expression complexity, output depth/bytes, and preview bytes using shared limits.
- Disable automatic retry for deterministic mapping faults unless input can change between attempts by an explicit
  recovery mechanism.

## Fix checklist

- [ ] **P0: Add compile-time config validation.** Reject non-string/invalid mapping entries with row-targeted issues;
  acceptance: no malformed mapping accepted by publication can fail solely because its config shape is invalid.
- [ ] **P1: Unify path and expression contracts.** Replace dot strings with the shared structured picker/path model;
  acceptance: property names containing dots round-trip and node/edge mappings use the same path semantics.
- [ ] **P1: Add nested targets and missing policies.** Implement omit/default/null/fail plus overlap checks; acceptance:
  sparse, nested, and overlapping cases have deterministic compiler and executor tests.
- [ ] **P1: Add bounded conversions.** Define explicit type-safe conversions; acceptance: unsupported conversions fail
  preflight and no implicit coercion occurs.
- [ ] **P1: Infer output schema.** Generate Mapped value from configured rows; acceptance: downstream field pickers and
  mapping compatibility use exact target names and types.
- [ ] **P1: Build mapper preview and isolated test.** Acceptance: authors can select upstream sample data, evaluate all
  rows, and inspect output without running unrelated downstream steps.
- [ ] **P1: Implement standard error routing.** Acceptance: fail-on-missing activates the drawn Error path or stops per
  policy, while omit/default remain successful outcomes.
- [ ] **P2: Add mapping evidence and repair links.** Acceptance: run detail identifies the row and resolution state and
  opens the corresponding draft control.

## Shared platform dependencies

- Compile-time registry config validation and field/row-targeted issues.
- One structured JSON path, expression, and data-picker system across nodes and connections.
- Schema and sample propagation, output inference, and compatibility feedback.
- Standard expected-outcome/error routing with enforced retryability.
- Standard card anatomy, labeled ports, isolated tests, pinned samples, and inline attempt evidence.
- Shared payload/path complexity limits, sensitivity handling, and executable semantic pinning.

## Open decisions

1. Should mapping remain a strict projection, or offer an explicit `Keep unmapped fields` mode that overlaps with Set
   fields?
2. Which conversions belong in Map fields versus dedicated transformation nodes?
3. How should array traversal and wildcard projection be represented without introducing an unbounded expression
   language?
4. When upstream schema is unknown, should missing values fail by default or require an explicit author choice?
5. Should mapping row order be semantically relevant, or should overlapping targets be prohibited so order cannot
   change results?