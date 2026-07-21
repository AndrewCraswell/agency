# Failure node review

Status: Source-backed review

Last reviewed: 2026-07-20

This document distinguishes **Source fact** from **Recommendation**. It reviews the current implementation; it does
not claim that recommended behavior exists.

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `failure` |
| Registry order | 06 |
| Version and phase | Version 1, phase 2 |
| Category | `terminal` |
| Execution and mutation | `control`, `none` |
| Capability requirements | None |
| Registered label | Failure |

**Source fact:** Failure is registered as a terminal that "Ends the current path with an error." It requires string
`code` and `message` config, accepts an optional generic object through `error`, and declares no outputs. UI metadata
describes code as an identifier for downstream handling even though the node terminates and has no downstream port.

## Intended job and mental model

Failure should intentionally terminate a workflow with a stable domain outcome, for example `review_rejected` or
`required_owner_missing`. It should not stand in for unexpected executor faults, provider outages, or validation
exceptions. A maker should read it as: "end this scope as failed with this authored code, message, and structured
details."

The current platform stores intentional Failure and unexpected step failure in the same attempt/run states and offers
the same recovery actions. That erases the distinction the node needs to be useful.

## Current contract

### Configuration and ports

**Source fact:** Config requires `code` and `message` strings, but the JSON schema allows empty strings and additional
properties. The editor default is `workflow_failed` / `Workflow failed`. Input `error` is optional and any object is
accepted. No details schema, message templating contract, classification, retryability, HTTP/caller status, or
notification policy is defined. The generic step instance still has `failurePolicy`.

### Compiler

**Source fact:** Failure satisfies the workflow's terminal requirement. The compiler validates edge shape and one-input
cardinality but has no checks for nonblank/stable codes, duplicate code conventions, details shape, terminal races,
intentional-versus-operational failure, or sibling cancellation. A normal success edge can feed the Failure `error`
input. Failure-route edges are not required to end here, and configured `failurePolicy.mode` is not used by the
dispatcher.

### Executor and precedence

**Source fact:** The executor starts with configured code/message and then spreads `input.error` afterward:

```text
{ code: configuredCode, message: configuredMessage, ...inputError }
```

Incoming `code` or `message` therefore overrides the authored terminal identity. Missing input retains config. The
result has no output, `terminalStatus: "failed"`, and the merged object becomes the attempt error. The dispatcher treats
this exactly like a thrown executor error and calls `failAttempt`.

**Source fact:** As with Success, run status is changed but ready/running siblings are not cancelled and globally ready
activations are not filtered by run status.

## Authoring experience

**Source fact:** The inspector has editable **Label**, **Failure code**, and multiline **Message** controls. It does not
offer dynamic content, a structured details builder, precedence explanation, code validation, output/error preview, or
an intentional-failure classification. The card shows editable label, terminal category, and description; handles are
unlabeled. The registry text promises downstream handling without presenting any route.

Whole-draft validation and testing exist, but there is no isolated node test. Editor tests confirm that code and message
can be authored; they do not cover details, overriding identity, run evidence, or recovery semantics.

## Runtime, persistence, and evidence

**Source fact:** The journal stores input, merged error, failed attempt/activation, `attempt.failed` event with the final
error code, and failed run status/terminal time. Run summary finds the last failed activation, extracts message before
code, labels the event as a failed step, and recommends retry. It offers **Retry step** and potentially **Retry from
here** for an intentional Failure terminal, provided no output/effect restriction blocks it.

Run diagnostics expose raw error JSON and event history. There is no badge or evidence field identifying this as an
authored domain termination, no source of each merged field, no stable failure contract digest, and no caller-facing
typed error envelope for child workflows beyond raw attempt error.

## Representative behavior matrix

| Case | Current source-backed behavior | Judgment |
| --- | --- | --- |
| Configured code/message, no input | Fails run with configured identity. | Basic case works. |
| Input adds nonidentity detail | Detail is merged into persisted error. | Useful but untyped. |
| Input supplies code/message | Input silently replaces configured values. | P0 contract defect. |
| Empty strings | Config schema accepts them; editor can save them. | Invalid operational identity. |
| Primitive/array input | Object parsing fails and becomes generic `step_failed`. | Intentional outcome turns into execution fault. |
| Normal success edge into Failure | Supported. | Useful for business rejection paths if explicitly modeled. |
| Failure edge into Failure | Compiler can map source error schema to its input. | Surrounding route policy is not enforced at runtime. |
| Ready sibling | Run is marked failed while sibling can still dispatch. | P0 terminal-integrity defect. |
| Retry | Run detail offers generic retry of the same deterministic Failure. | Misleading and usually pointless. |
| Timeout | No intrinsic timeout. | Not applicable to a deterministic terminal. |
| Child failure | Parent receives raw terminal attempt error. | Durable but lacks a versioned domain error contract. |

## Validation, tests, and gaps

**Source fact:** Executor tests cover configured code/message plus one extra detail. Compiler tests use Failure as a
terminal and verify bad ports/cardinality through shared checks. Journal/service tests cover generic failed attempts,
summary, and recovery actions. Editor tests cover changing code and message.

No test asserts precedence when input supplies code/message, nonblank code format, structured details, intentional
failure classification, no-retry behavior, sibling cancellation, terminal races, child failure envelope, or accessible
authoring and run-detail interpretation.

## Expert judgments

### Competitive Expert

n8n Stop And Error explicitly lets makers choose an error message or error object and connects to error workflows.
Power Automate separates Run after outcomes, retry settings, scopes, and Terminate status/message; desktop Stop Flow
also distinguishes successful exit from error. Agency's typed code plus durable journal can be stronger, but only if
authored identity has deterministic precedence and intentional failure is distinct from system fault. Make's error
handlers similarly reinforce that error routing and terminal directives are explicit control-flow concepts, not a
generic retryable step failure.

### UX Expert

Code and Message are understandable, but the unlabeled optional input creates a hidden merge rule that the form never
explains. "Identifies this failure for downstream handling" is especially confusing on a terminal with no output.
Users need either an authored details mapper or an explicit "Use incoming error" mode, plus a preview of the final
error envelope.

### User Researcher

Operators will reasonably retry a failed step when the UI recommends it, but retrying an intentional Failure reproduces
the same domain decision. They also cannot tell whether the displayed code came from the workflow author or untrusted
incoming data. That weakens diagnosis, alert routing, and caller expectations.

## Findings

### P0

1. **Incoming details can replace configured failure identity.** Evidence: spread order applies `input.error` last.
   Impact: upstream/untrusted data can change alert keys and caller-visible meaning despite authored code/message.
2. **Failure does not terminate incompatible work.** Evidence: run status changes without activation cancellation or
   run-status filtering in ready selection. Impact: work and effects can continue after a terminal failure.
3. **Intentional failure is indistinguishable from execution fault.** Evidence: both use failed attempt/activation/run
   and the same retry summary. Impact: recovery guidance, alerts, reliability metrics, and failure routes are misleading.

### P1

1. **Failure contract is weakly validated.** Evidence: strings may be blank and details are any object. Impact: unstable
   machine codes and inconsistent caller contracts.
2. **Authoring hides merge and templating behavior.** Evidence: only raw code/message fields exist. Impact: users cannot
   safely include context or predict the final envelope.
3. **Copy promises nonexistent downstream handling.** Evidence: UI metadata mentions downstream handling; no output is
   registered. Impact: authors search for routing behavior that cannot exist after this node.

### P2

1. **Evidence lacks authored-versus-input provenance.** Impact: diagnosis and audit require inspecting graph config.
2. **Generic failure policy remains on Failure instances.** Impact: model suggests retries are meaningful here.

## Recommended target contract, UI, testing, evidence, and safe defaults

**Recommendation:** Reserve Failure for intentional domain termination and name it **Fail workflow** or **Return
failure** if run-level. Define a strict envelope: stable `code`, human `message`, optional typed `details`, and
`classification: "domain"`. Configured identity must win by default. If users need incoming identity, expose an
explicit mode with mapped, schema-aware fields rather than object spread.

Terminal arbitration must atomically stop incompatible pending work. Unexpected executor faults should retain a
separate `execution_error` classification and recovery policy. Intentional failures should not offer automatic or
manual retry unless the user chooses a specific recovery point before the domain decision.

The inspector should provide code-format validation, dynamic-content insertion for message/details, a final-envelope
preview, and a clear precedence summary. Run detail should say "Workflow ended with authored failure," show code,
message, details, producer, and sibling disposition, and recommend correcting input or starting a new run rather than
retrying the terminal.

Safe defaults: authored code/message precedence, nonblank lowercase machine code, domain classification, no retry,
bounded details payload, redaction-aware evidence, and one winning terminal per run.

## Fix checklist

- [ ] **P0: Replace object-spread precedence with an explicit strict envelope.** Acceptance: incoming details cannot
  change code/message unless an explicit mapped mode is selected; tests cover collisions and untrusted input.
- [ ] **P0: Separate domain termination from execution fault.** Acceptance: persistence, summary, metrics, alerts, child
  completion, and recovery actions preserve classification; intentional Failure does not offer a meaningless retry.
- [ ] **P0: Enforce terminal arbitration and sibling cancellation.** Acceptance: pending work cannot dispatch after the
  winning Failure; concurrent Success/Failure and lease-recovery tests prove deterministic status.
- [ ] **P1: Strengthen config and details schemas.** Acceptance: code is nonblank and format constrained, message is
  nonblank and bounded, details can be declared/validated, and errors point to inspector fields before publish.
- [ ] **P1: Add a schema-aware error builder and preview.** Acceptance: makers can insert upstream data, see precedence
  and the final envelope, and complete all controls by keyboard with accessible names.
- [ ] **P1: Correct registry/editor copy.** Acceptance: no text claims downstream routing unless a real routable outcome
  exists; terminal scope and caller behavior are explicit.
- [ ] **P1: Add compiler/runtime/journal tests.** Acceptance: valid, empty, invalid, collision, child return, sibling,
  race, recovery, and payload-boundary cases are covered.
- [ ] **P2: Add terminal error evidence.** Acceptance: run detail shows authored config digest, mapped detail lineage,
  classification, final code/message, and sibling disposition without raw graph inspection.

## Dependencies and open decisions

- Shared terminal arbitration and cancellation semantics with Success.
- Standard expected-outcome versus execution-error taxonomy and run-after routing.
- Shared expression/data picker, schema propagation, redaction, and evidence provenance.
- Decision: run-level only or scoped/path-level Failure.
- Decision: whether domain failure maps to failed run status or a completed run with a typed business outcome.
- Decision: child caller error envelope, code namespace, and public message/details redaction.
- Decision: whether any recovery action should restart before the Failure node rather than retry it.

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
- `apps/web/src/routes/RunDetailPage.tsx`
- Relevant compiler, executor, journal, service, editor, and run-detail tests
- n8n Stop And Error documentation; Make error-handler/flow-control documentation available at review time; Microsoft
  Power Automate error-handling, Terminate, Throw custom error, and Stop Flow documentation