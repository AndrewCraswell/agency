# Repeat Node Review

Status: Design review

Last reviewed: 2026-07-20

This review covers `bounded_loop@1`, displayed as Repeat. It traces the registry, compiler, durable execution path,
editor, evidence, and inspected tests. No tests or browser acceptance were executed for this documentation-only review.

## Identity and intended job

| Attribute | Current value |
| --- | --- |
| Registry kind | `bounded_loop` |
| Display label | Repeat |
| Version and release | Version 1, phase 7 |
| Category and execution | Logic, control execution, no mutation |
| Capability | None |
| Intended job | Repeatedly evaluate a deterministic condition over state and run a body while bounded by iteration and activation limits. |

The intended mental model is: "While this condition is true, run the contained body with the current state, accept the
next state, and then either finish, break, or report exhaustion." The current graph asks users to select body and exit
step IDs and mark one ordinary connection as loop-back. That makes a structured loop appear to be an arbitrary cycle.

## Current contract

### Configuration and ports

The manifest in `apps/agentic/src/workflows/stepRegistry.ts` requires:

| Field | Current contract |
| --- | --- |
| `condition` | Deterministic path/operator/value expression. |
| `maximumIterations` | Positive bounded integer. The editor default is 10. |
| `maximumActivations` | Positive activation budget. The editor default is 100. |
| `bodyStepId` | Non-empty configured body step ID. |
| `exitStepId` | Non-empty configured exit step ID. |
| `onExhaustion` | `fail` or `complete`; the editor default is `fail`. |

The required `state` input is an open object. Optional output `iteration` contains `{ state, index }`; optional output
`result` is an open object. Neither output is visibly labeled on the canvas. There are no Break, Continue, Exhausted,
or Error outcomes. `onExhaustion: complete` emits the same result shape as normal condition completion, so downstream
nodes cannot distinguish why the loop stopped.

The condition uses the same limited deterministic expression shape as Condition, but the inspector exposes path
segments as text rather than a schema-aware state picker.

### Compiler and connection flag

`validateConnections()` and `validateOrchestration()` in `apps/agentic/src/workflows/compiler.ts` enforce substantial
structure:

- `loopBack` is allowed only on a connection targeting a Repeat node;
- loop-back edges are excluded from ordinary topological ordering and cardinality accounting;
- configured body and exit steps must exist;
- exactly one loop-back edge must target the Repeat `state` input;
- the configured body must reach that return source;
- `iteration` must connect to the configured body;
- `result` must connect to the configured exit;
- duplicate or ambiguous return edges are rejected.

These checks make the hidden protocol executable, but they also confirm three topology authorities: selected body ID,
selected exit ID, and a per-edge `loopBack` flag, in addition to visible edges. Reachability does not define exclusive
containment or prevent unrelated ingress into the body.

## Authoring experience

`BoundedLoopInspector` exposes the condition as path, operator, and JSON value fields, followed by numeric budgets,
body and exit dropdowns, and an exhaustion dropdown. `ConnectionInspector` separately exposes a Loop-back dropdown on
edges entering Repeat.

The user must therefore understand that:

1. `iteration` starts a body.
2. Some downstream node must produce the next state.
3. Its edge back to `state` needs a hidden semantic flag.
4. `result` needs a separate exit edge that also agrees with `exitStepId`.

The canvas does not render a loop region, State/Body/Back/Exit boundaries, iteration count, activation budget, or
exhaustion behavior. The generic node card shows editable title, category, and description instead of persistent Repeat
identity and limits. There is no sample simulation to show whether the condition is initially false, how state changes,
or whether exhaustion is inevitable.

## Runtime, persistence, and evidence

`executeWorkflowStep()` evaluates the condition against the current state. If false, it emits `result`. If true and the
iteration limit has not been reached, it emits `iteration` with state and index. At the final allowed iteration it
either returns a `loop_exhausted` failure or emits a result, based on `onExhaustion`.

`downstreamActivations()` creates and increments deterministic loop scopes. The first iteration begins at index 0.
Following the marked return edge increments the scope; following the result exit removes the loop scope. This provides
strong per-iteration identity and keeps the loop finite even if body topology is complex.

`completeAttempt()` enforces `maximumActivations` while persisting downstream activations. The budget is valuable, but
failure occurs at the journal transition rather than as a named Repeat outcome. The author cannot simulate or preview
how a body with branching or nested orchestration consumes that budget.

Attempts, scopes, outputs, errors, events, usage, and evidence are retained in run detail. The view does not aggregate
state changes by iteration, identify the stop reason, or show which body activation consumed the budget. There is no
node-level Break or Continue record because those operations do not exist.

Fencing protects persisted transitions from stale workers. The inspected ready-work query does not reclaim expired
leased or running activations by itself, so recovery through condition evaluation, body effects, and loop-back
completion needs focused proof.

## Validation, tests, and gaps

Compiler tests cover missing body/exit nodes, required iteration and exit edges, loop-back cardinality, body reachability,
and duplicate returns. Executor and journal tests cover condition evaluation, iteration scopes, exhaustion choices, and
activation-budget enforcement. Editor tests cover saving the principal fields.

The inspected suite does not establish:

- an initially false condition through a complete durable run;
- Break and Continue semantics, because neither exists;
- an explicit routable Exhausted outcome;
- state-schema propagation and invalid returned-state diagnostics;
- nested-loop budget multiplication;
- effect-safe cancellation during Break, failure, or exhaustion;
- worker loss around loop-back and activation-budget updates;
- accessible authoring and editing of the complete loop structure;
- iteration-centered state diff and stop-reason evidence.

## Behavior matrix

| Scenario | Current behavior | Target behavior |
| --- | --- | --- |
| Condition initially false | Emits `result` without running the body. | Emit Completed with iteration count 0 and stop reason `condition_false`. |
| Condition true within limits | Emits iteration state/index and advances through a marked return edge. | Run one managed body and accept one typed next-state return. |
| Body returns invalid or missing state | Generic input resolution or runtime validation fails later. | Validate the return at the managed Continue boundary and identify the incompatible field. |
| Condition becomes false | Emits `result` and exits the loop scope. | Emit Completed with final state, count, and state-transition evidence. |
| Iteration limit reached with `fail` | Emits `loop_exhausted` as an execution failure. | Emit the expected Exhausted outcome; let the author choose whether an unconnected outcome fails publish or run. |
| Iteration limit reached with `complete` | Emits ordinary `result`, indistinguishable from normal completion. | Never conflate exhaustion with condition completion. |
| Activation budget exceeded | Journal completion rejects additional loop activations. | Preflight likely consumption and emit a structured budget error with actual and limit. |
| User needs Break | Unsupported. | Break exits with explicit reason and final state after safely disposing of pending body work. |
| User needs Continue | Only an ordinary return edge approximates it. | Continue is a managed control boundary that validates and journals next state. |
| Worker stops at loop-back | Fencing exists; complete recovery behavior was not demonstrated. | Recover without losing or duplicating an iteration or applying stale state. |

## Expert judgments

### Competitive Expert

Power Automate presents Do until as a visible container with count and timeout limits, while its broader guidance warns
about infinite loops and recommends explicit termination safeguards. n8n exposes loop and done boundaries for
collection loops, reinforcing the value of visible continuation. Make's public Repeater documentation available during
this review did not provide enough substantive detail for feature claims. Agency's deterministic state expression,
scope identity, and dual iteration/activation budgets are strong differentiators. They should be expressed as a
first-class state-machine loop, not hidden edge metadata.

### UX Expert

This is the least discoverable of the four reviewed nodes because correctness depends on a connection-level setting far
from the node inspector. A managed region should make the cycle visible without drawing an unrestricted graph cycle.
Condition, current state, iteration count, and exit reason need stable positions. A state timeline and one-step
simulation are more useful than raw body/exit identifiers.

### User Researcher

Users debugging automation loops usually ask "Why did it keep going?", "What changed each time?", and "Why did it
stop?" Current attempt records preserve enough raw data to reconstruct answers but not enough presentation to build
trust quickly. A final result that hides exhaustion is especially risky: users may treat a safety stop as successful
business completion. State diffs, stop reason, budget consumption, and effect history should be primary evidence.

## Findings

### P0

1. **Exhaustion can masquerade as success.** `onExhaustion: complete` uses the ordinary result output, so downstream
   behavior cannot distinguish a satisfied condition from a safety limit.
2. **Loop topology is split across IDs, edges, and `loopBack`.** The compiler validates agreement but the editor cannot
   make the stored protocol self-evident or prevent ownership drift.
3. **Break and Continue are absent.** Users cannot express common bounded-loop control without restructuring the body or
   treating normal control as failure.

### P1

1. **State is untyped and hard to inspect.** The open-object contract and text path hide available fields and permit
   invalid next-state shapes to surface late.
2. **Budget impact is not predictable.** The activation cap is enforced during persistence, but body branching, nested
   loops, effects, and model/provider cost are not preflighted.
3. **Recovery is not proven.** Fencing exists, but lease expiry and exactly-once iteration advancement need explicit
   tests around the loop-back boundary.
4. **Evidence lacks a loop narrative.** Iteration state diffs, stop reason, Break/Continue, and budget use are not
   summarized.

### P2

1. The card and outline omit the condition, limits, and exhaustion policy.
2. The inspector has no deterministic sample simulation or warning for conditions that do not reference changing state.

## Recommended target contract

### Ports and outcomes

- Input `Initial state<S>`: schema-propagated state.
- Managed body boundary `Iteration`: `{ state: S, index: integer, remaining: integer }`.
- Managed control boundary `Continue`: accepts exactly one `nextState: S`.
- Managed control boundary `Break`: accepts `finalState: S` plus optional structured reason.
- Outcome `Completed`: `{ state: S, iterations, reason: "condition_false" | "break" }`.
- Outcome `Exhausted`: `{ state: S, iterations, maximumIterations }`.
- Standard `Error`: invalid state, condition, budget, scheduler, or body fault.

Exhaustion is an expected safety outcome, never ordinary completion. Body and control boundaries belong to the managed
region and cannot be connected ambiguously from outside it.

### Configuration and safe defaults

- Condition built from the typed current-state schema.
- `maximumIterations`: default 10 and always required.
- `maximumActivations`: default 100 and additionally constrained by the run-level activation budget.
- `onExhaustion`: always route to Exhausted; unconnected Exhausted fails validation unless the author explicitly chooses
  `fail run` as a policy.
- Optional maximum elapsed time, defaulting to a platform-safe bound for bodies that can wait or invoke children.
- Optional state-history retention policy with bounded bytes; always retain digests and stop reason.
- Remove `bodyStepId`, `exitStepId`, and user-authored `loopBack` from the normal contract.

### Card and inspector

The card should show immutable **Repeat**, editable Title, a concise condition, maximum iterations, activation budget,
and latest stop reason. The managed region should visibly contain the body and expose Iteration, Continue, Break,
Completed, and Exhausted boundaries with accessible names.

The inspector should use the common field picker and expression builder, preview the initial evaluation, step through a
sample next-state sequence, estimate body activation multiplication, and explain exhaustion. Advanced should expose the
compiled region and raw expression read-only rather than asking users to maintain IDs or flags.

### Testing and evidence

Isolated testing should accept a pinned initial state and fixture body returns, support step-by-step simulation, and
stop at configured safety limits. It should make live effects opt-in.

Run detail should display an iteration timeline with condition result, input state digest, next-state diff, body status,
usage, effects, duration, and control decision. The loop summary must show final state, iteration count, stop reason,
activation budget used, and recovery history.

## Fix checklist

- [ ] **P0: Introduce an explicit Exhausted outcome.** Acceptance: condition completion, Break, exhaustion, and execution
      error remain distinguishable in ports, journal events, run status, and downstream mappings.
- [ ] **P0: Replace IDs and `loopBack` with a managed Repeat region.** Acceptance: one visual structure defines body,
      next-state return, Break, and exits; the compiler rejects external or ambiguous ingress and egress.
- [ ] **P0: Add Break and Continue contracts.** Acceptance: Continue validates one next state; Break produces Completed
      with reason `break`; pending body work and effects receive deterministic disposition.
- [ ] **P0: Prove bounded durable recovery.** Acceptance: crash tests before and after state return, iteration advance,
      and budget update never skip, duplicate, or apply stale iteration state.
- [ ] **P1: Propagate and enforce state schema.** Acceptance: condition fields autocomplete, body state is typed, and an
      invalid returned state fails at the Continue boundary with field-level diagnostics.
- [ ] **P1: Add activation, time, and cost preflight.** Acceptance: the inspector estimates nested worst-case work and
      publish/run fail closed above run limits.
- [ ] **P1: Add loop-centered evidence.** Acceptance: run detail provides a state-diff timeline, stop reason, budget use,
      effects, and retry/recovery actions without requiring raw activation reconstruction.
- [ ] **P2: Add deterministic simulation and condition warnings.** Acceptance: authors can step sample state through the
      loop and receive a warning when the condition cannot observe any field changed by the body.
- [ ] **P2: Add concise card and outline summaries.** Acceptance: condition, limits, validation, and latest stop reason
      are scannable without opening the inspector.

## Dependencies and open decisions

Shared dependencies are managed graph regions, schema propagation and the common expression builder, expected-outcome
routing, cancellation and effect safety, run-level activation/time/spend budgets, lease recovery, and node-centered run
evidence.

Open product decisions:

- Whether Break is a dedicated control node inside regions or a special region port available on any body node.
- Whether Continue may omit state to preserve the current state, or must always return an explicit state.
- Whether elapsed-time exhaustion shares the Exhausted outcome or has a distinct Timeout outcome.
- How much state history to retain when values contain secrets or large artifacts.
- Whether nested waits and child workflows are allowed in a Repeat body and how their elapsed time counts against limits.

## Source map

- Registry and manifest: `apps/agentic/src/workflows/stepRegistry.ts`
- Definition and `loopBack`: `apps/agentic/src/workflows/definition.ts`
- Compiler checks: `apps/agentic/src/workflows/compiler.ts`
- Loop execution and scopes: `apps/agentic/src/workflows/workflowExecutor.ts`
- Budget persistence: `apps/agentic/src/persistence/workflowJournalStore.ts`
- Persistence schema: `apps/agentic/src/persistence/schema.ts`
- Editor and inspector: `apps/web/src/routes/WorkflowEditorPage.tsx`,
  `apps/web/src/routes/WorkflowEditorInspector.tsx`
- Run evidence: `apps/web/src/routes/RunDetailPage.tsx`
- Focused tests: `compiler.test.ts`, `workflowExecutor.test.ts`, `workflowJournalStore.test.ts`,
  `WorkflowEditorPage.test.tsx`, `RunDetailPage.test.tsx`
