# Success node review

Status: Source-backed review

Last reviewed: 2026-07-20

This document distinguishes **Source fact** from **Recommendation**. It reviews the current implementation; it does
not claim that recommended behavior exists.

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `success` |
| Registry order | 05 |
| Version and phase | Version 1, phase 2 |
| Category | `terminal` |
| Execution and mutation | `control`, `none` |
| Capability requirements | None |
| Registered label | Success |

**Source fact:** `stepRegistry.ts` defines Success as an explicit terminal that "Ends the current path successfully."
Its config is an empty closed object. It has one optional `result` object input and one required `result` object output.
The editable step instance also carries a generic failure policy even though intentional success has no meaningful
retry policy. The versioned execution-package snapshot records this generic contract and an executor digest derived
from registry version, kind, version, and execution class rather than executable code.

## Intended job and mental model

Success should be the authoritative successful return boundary for a workflow or a deliberately bounded path. A maker
should read it as: "return this value, prove that it matches the workflow output contract, stop the selected scope, and
mark that scope successful." It is not a pass-through transform and its output port should not imply ordinary
downstream execution.

The current description says "current path," while the runtime writes the whole run status. This leaves the central
mental-model question unresolved: path terminal, workflow terminal, or child-workflow return.

## Current contract

### Configuration and ports

**Source fact:** There are no config fields or defaults. Input `result` is an optional generic object. Output `result`
is a required generic object. Missing input becomes `{}`. No timeout, retryability, effect, idempotency, cost, or
payload-size setting is declared. The workflow definition independently carries `outputSchema`, but neither the
registry contract nor compiler connects that schema to Success.

### Compiler

**Source fact:** The compiler requires at least one terminal category node and verifies reachability and edge port
mapping. It accepts either Success or Failure for this requirement. It does not require every reachable path to end in
exactly one terminal, validate Success input/output against `graph.outputSchema`, reject multiple competing terminals,
or define sibling cancellation. The sealed graph retains `outputSchema`, while the Success definition snapshot remains
the generic object schema.

### Executor

**Source fact:** `executeWorkflowStep` parses the incoming `result` as an object, returns it under the output `result`,
sets `terminalStatus: "succeeded"`, and emits no datum, usage, or special evidence. The generic output validator checks
only the registered object port. The dispatcher then computes ordinary downstream activations and commits the attempt
with terminal status `succeeded`.

**Source fact:** `listReadyActivations` selects every ready activation globally without checking its run status.
Completing Success updates the run to `succeeded` but does not cancel or block already-ready or running sibling work.
The registry exposes a Success output, compiler tests can connect it, and downstream scheduling can use it, while the
canvas hides every terminal output handle.

## Authoring experience

**Source fact:** Adding Success produces `{}` config. Its inspector shows only editable **Label**, the registry
description, connections, and delete. There is no result mapper, output-schema summary, sample output, preview, or
isolated test. The node card shows the editable label, generic terminal category, and description; it does not retain
the immutable Success type as primary identity, label its input, or summarize the output contract. The outline calls it
an outcome but otherwise shows label/kind and graph position.

The editor supports whole-draft validation and testing. Its test explicitly confirms that **Run to here** is absent,
and run evidence is reached on the separate run-detail page rather than embedded in the selected node.

## Runtime, persistence, and evidence

**Source fact:** The journal stores the Success activation, selected successful attempt, raw input bindings, output
`{ result: ... }`, timestamps, and an `attempt.succeeded` event. It sets run status and `terminalAt` to succeeded. A child
workflow completion locates a matching Success activation and returns its selected attempt output; the parent extracts
`output.result`.

Run details show the immutable graph, activation state, and raw attempt input/output inside Diagnostics. There is no
first-class "Workflow output" evidence view, output-schema validation result, lineage summary, or indication of sibling
work cancelled or left active. Success emits no separate value datum.

## Representative behavior matrix

| Case | Current source-backed behavior | Judgment |
| --- | --- | --- |
| Valid object result | Returns the object, persists the attempt, marks the run succeeded. | Works only against the generic node schema. |
| Missing optional result | Converts absence to `{}` and succeeds. | Unsafe when workflow output requires fields. |
| Primitive or array result | Object parsing throws; dispatcher records `step_failed`. | Runtime-only feedback; the port already advertises object. |
| Workflow output-schema mismatch | Compiles and can succeed because `outputSchema` is not applied here. | P0 contract defect. |
| Empty workflow output schema | `{}` succeeds. | Reasonable if the interface explicitly permits it. |
| Multiple incoming success paths | Allowed because the input is not `many`, so compiler rejects multiple connections to the same port. | Clear cardinality, but parallel terminal semantics remain undefined. |
| Downstream edge from Success | Compiler/runtime support it; canvas hides the output handle. | Contract/UI contradiction. |
| Ready sibling when Success runs | Run becomes succeeded; sibling remains globally dispatchable. | P0 terminal-integrity defect. |
| Retry or timeout | No intrinsic timeout; generic manual retry is irrelevant after success. | Terminal policy should be explicit, not inherited. |
| Child-workflow return | Parent reads the selected Success attempt's `result`. | Useful durable return path, but output interface is not enforced. |

## Validation, tests, and gaps

**Source fact:** Executor tests cover a valid object result. Compiler tests cover terminal presence, reachability, port
validity, and even a downstream Success connection. Journal tests exercise terminal attempts and child completion.
Editor tests cover catalog insertion and the absence of run-to-here. Run-detail tests exercise generic evidence.

Missing tests include workflow output-schema match/mismatch, absent result under a required schema, multiple Success
nodes racing, Success versus Failure racing, sibling cancellation, terminal idempotence after lease recovery, child
output validation, a first-class returned-output view, and keyboard/accessibility behavior for the result input.

## Expert judgments

### Competitive Expert

n8n normally treats graph exhaustion as success and offers Stop And Error for explicit failure; Power Automate's Stop
Flow/Terminate patterns make final status explicit and ensure no later action executes. Agency's explicit Success node
can be better for typed child returns and durable evidence, but only if it enforces the declared workflow interface and
has unambiguous stop scope. A routable output from a terminal is least-surprise only if this is renamed to a return or
completion boundary rather than Success.

### UX Expert

The node offers no way to construct the result it promises to return. An unlabeled left handle, editable label, generic
category, and hidden output schema make the most important workflow boundary visually weak. The inspector should lead
with Return value, schema conformance, and a sample preview; immutable Success identity should remain visible.

### User Researcher

Users cannot answer "what did this workflow return?" without opening raw attempt JSON. More seriously, a green run can
coexist with sibling work that was not stopped. That undermines trust in run status, especially for child workflows and
parallel provider actions. Users need a visible final-value record and an explicit account of cancelled, completed, or
still-running siblings.

## Findings

### P0

1. **Workflow output is not enforced.** Evidence: `graph.outputSchema` is sealed, but Success accepts and validates only
   a generic object. Impact: a workflow or child run can report success with an invalid public result.
2. **Terminal status does not stop incompatible sibling work.** Evidence: completion writes run status only;
   `listReadyActivations` filters solely by activation status. Impact: work can execute after a successful terminal,
   including effects, and the persisted run status no longer truthfully describes execution.
3. **Terminal scope is contradictory.** Evidence: copy says current path, persistence marks the run, and runtime permits
   downstream output. Impact: authors cannot predict whether Success returns, routes, or stops.

### P1

1. **No return-value authoring experience.** Evidence: empty config and no specialized inspector. Impact: users must
   shape the final object elsewhere and cannot preview interface conformance.
2. **Registered and rendered ports disagree.** Evidence: registry/compiler expose output `result`; the canvas suppresses
   all terminal outputs. Impact: API-authored graphs and visual graphs have different capabilities.
3. **Evidence is raw and generic.** Evidence: output appears only in attempt Diagnostics. Impact: operators cannot
   quickly verify the workflow's returned value or lineage.

### P2

1. **Card and outline summaries omit terminal contract.** Impact: multiple outcomes are hard to scan.
2. **Generic failure policy appears on terminal step instances.** Impact: extension and authoring models imply retry
   behavior that does not belong to intentional success.

## Recommended target contract, UI, testing, evidence, and safe defaults

**Recommendation:** Define Success as a run-level **Return success** boundary unless the platform first introduces an
explicit nested path/scope terminal. Give it one named **Result** input whose schema is the workflow `outputSchema`; do
not expose an ordinary output. Missing result is valid only when the output schema accepts `{}`. Completion must
atomically select one terminal result and cancel or prevent all incompatible pending activations before run status is
published. Already-dispatched effects require truthful reconciliation, not fictional rollback.

The inspector should provide a common schema-aware result mapper, show required fields, allow constants and upstream
expressions, preview a sample, and validate inline. The card should show immutable **Success**, editable title, "Returns
N fields" or "No output," and terminal scope. Draft tests should display the final result beside schema validation.

Persist a first-class terminal-result record containing status, validated result digest, output-schema digest,
terminal activation/attempt, selected-at timestamp, and sibling disposition. Default to one successful terminal per
run, no automatic retries, a bounded JSON result, and fail closed on schema mismatch.

## Fix checklist

- [ ] **P0: Bind Success to `graph.outputSchema`.** Acceptance: compile-time mappings and runtime completion reject an
  incompatible result; required-field absence fails with field paths; child completion cannot publish an invalid result.
- [ ] **P0: Define and enforce run-level terminal arbitration.** Acceptance: exactly one terminal wins atomically;
  pending incompatible activations are cancelled; leases cannot commit new work after terminal selection; tests cover
  Success/Success and Success/Failure races and recovery.
- [ ] **P0: Remove downstream terminal routing or rename the concept.** Acceptance: registry, compiler, executor, canvas,
  and docs expose one consistent topology; visual and API-authored workflows have identical behavior.
- [ ] **P1: Add a schema-aware Return value editor.** Acceptance: users can map all required fields with dynamic content,
  see inline errors and a sample preview, and complete the task by keyboard with named controls.
- [ ] **P1: Add first-class terminal evidence.** Acceptance: run detail shows validated workflow output, schema digest,
  producer lineage, terminal timestamp, and sibling disposition without opening raw JSON.
- [ ] **P1: Add focused contract tests.** Acceptance: valid, invalid, empty, boundary-size, child return, race, lease
  recovery, and cancellation cases execute against compiler plus journal runtime.
- [ ] **P2: Improve card and outline summaries.** Acceptance: immutable type, terminal scope, output shape, and latest
  test result remain visible when the title is edited.

## Dependencies and open decisions

- Shared workflow-interface schema propagation and the common expression/data picker.
- Atomic terminal arbitration, cancellation, fencing, and effect-reconciliation policy.
- Decision: run-level terminal only, or explicit scoped/path terminals with separate names and semantics.
- Decision: whether multiple branch-local successes are legal before a managed merge.
- Decision: maximum inline result size and when terminal values also become durable value data/artifacts.
- Decision: whether caller-visible child output is the raw result or a versioned return envelope.

## Source inventory

- `apps/agentic/src/workflows/stepRegistry.ts`
- `apps/agentic/src/workflows/definition.ts`
- `apps/agentic/src/workflows/compiler.ts`
- `apps/agentic/src/workflows/workflowExecutor.ts`
- `apps/agentic/src/persistence/workflowJournalStore.ts`
- `apps/agentic/src/persistence/schema.ts`
- `apps/agentic/src/workflows/service.ts`
- `apps/web/src/routes/WorkflowEditorPage.tsx`
- `apps/web/src/routes/WorkflowEditorInspector.tsx`
- `apps/web/src/routes/WorkflowEditorOutline.utils.ts`
- `apps/web/src/routes/RunDetailPage.tsx`
- Relevant compiler, executor, journal, service, editor, and run-detail tests
- n8n Stop And Error documentation; Make flow-control documentation available at review time; Microsoft Power Automate
  data-operation, error-handling, and Stop Flow documentation