# Node Type Development Best Practices

Status: Design and engineering standard

Last reviewed: 2026-07-20

This guide defines the target standard for proposing, implementing, reviewing, and operating workflow node types. It
synthesizes the [workflow node design review](workflow-node-design-review.md) and the
[source-backed reviews of all registered node types](types/00-node-type-review-index.md).

The guide is normative for new node design, but it is not a claim that every existing node already meets the standard.
When current behavior differs, the implementation and its node-type review remain the source of truth until the gap is
fixed. Use the following terms deliberately:

- **MUST** identifies a correctness, safety, contract, or core-authorability requirement.
- **SHOULD** identifies the expected design unless a documented exception is approved.
- **MAY** identifies an optional capability that must still obey the shared contracts when implemented.

## Quality bar

A high-quality node is a bounded, independently testable unit of work whose manifest, compiler behavior, durable
runtime, editor experience, evidence, and documentation all describe the same contract.

Every node has three inseparable quality dimensions:

1. **Functional correctness:** accepted configurations execute exactly as compiled, with typed data, bounded work,
   durable recovery, and truthful outcomes.
2. **Authoring usability:** users can understand the node's job, configure it without internal knowledge, connect it
   correctly, test it safely, and repair mistakes.
3. **Operational trust:** users can predict effects and cost, identify what happened, inspect evidence, and choose a
   safe recovery action.

A polished inspector does not compensate for incorrect runtime semantics. A durable executor does not compensate for
an opaque authoring model. Treat all three dimensions as release gates.

## Start with the job

### Prefer reuse over another node kind

Before adding a registry kind, determine whether the need belongs in:

- an existing node's versioned operation manifest;
- an additional expected outcome or typed port;
- a reusable expression, mapping, artifact, effect, or evidence capability;
- a managed branch, loop, or composition region; or
- a genuinely new user-recognizable unit of work.

Create a new kind only when it has a distinct mental model, runtime behavior, configuration experience, or operational
contract. Do not create separate kinds merely to change a provider operation, preset, label, or default.

### Define one coherent job

A node SHOULD be explainable in one sentence without using "and then." It SHOULD perform one transformation, decision,
synchronization, invocation, external effect, trigger, suspension, or terminal outcome.

Split a proposal when its parts have different:

- retry, timeout, cancellation, or idempotency needs;
- capabilities or sealed-resource access;
- effect risk or approval requirements;
- expected outcomes;
- evidence, retention, or sensitivity requirements; or
- scaling dimensions and limits.

Do not split behavior that must be atomic to remain correct. Reserving and dispatching one provider effect, for example,
is one durable operation even if it has multiple internal persistence stages.

### Classify the node before designing it

Record these properties in the proposal:

| Property | Questions to answer |
| --- | --- |
| Work class | Is it deterministic local work, remote read, external effect, model call, workspace task, orchestration, suspension, or termination? |
| Data contract | What enters, what leaves, and which schemas can be known before execution? |
| Outcomes | Which alternatives are normal domain outcomes, and which conditions are execution errors? |
| Durability | Can it suspend, fan out, wait for siblings, invoke a child, or survive a worker crash? |
| Safety | Which capabilities, resources, credentials, approvals, and sensitivity rules apply? |
| Boundedness | What limits bytes, items, depth, time, retries, concurrency, activations, effects, tokens, spend, and retention? |
| Repeatability | Which versions, code, provider operations, repository revisions, model metadata, or child interfaces must be pinned? |
| Recovery | What can retry automatically, what needs reconciliation, and what requires an author or operator change? |

If these answers are unknown, the node is not ready for implementation.

## One authoritative manifest

Every node MUST have one versioned manifest that owns the complete public contract. The editor, compiler, runtime,
documentation, and tests MUST consume or verify that contract rather than maintaining independent per-kind copies.

The manifest MUST contain every applicable area below. Mark an area as not applicable rather than omitting it silently.

| Area | Required content |
| --- | --- |
| Identity | Stable kind, version, display name, icon, category, description, and operation identity where applicable. |
| Configuration | Closed schema, canonical defaults, constraints, field presentation metadata, and Advanced classification. |
| Ports | Stable keys, labels, direction, schema, cardinality, requiredness, and outcome class. |
| Execution | Work class, capabilities, resource scope, effect class, retry policy, total deadline, cancellation behavior, and idempotency contract. |
| Limits | Item, byte, depth, expression, artifact, time, attempt, concurrency, activation, token, spend, and evidence bounds that apply. |
| Evidence | Input/output/error policy, specialized evidence, artifacts, usage, provenance, redaction, classification, truncation, and retention. |
| Testing | Fixture support, mock or dry-run behavior, sample inputs, and whether paid or live testing requires explicit confirmation. |
| Semantics | Node semantic version or executable digest plus versions for expression, template, schema, scheduler, decoder, adapter, or worker behavior. |

Provider, repository, event, and other operation-driven nodes MUST use versioned operation manifests for operation-
specific request schemas, result schemas, capabilities, effects, limits, error taxonomy, and UI controls. A generic
`query: object` or `result: object` is not acceptable when the operation contract is known.

### Prevent contract drift

- Defaults MUST have one owner and MUST be identical in add-node behavior, inspector state, compilation, and runtime.
- The registry MUST NOT advertise fields, retries, routes, or outcomes that the executor ignores.
- The executor MUST NOT accept hidden public configuration that the manifest and compiler do not understand.
- Generated controls MUST preserve the exact manifest value, including unknown-but-valid forward data where the contract
  explicitly allows extension.
- Adding a node with defaults MUST produce a configuration that can compile or an intentional, clearly marked incomplete
  state with direct guidance.
- Documentation examples MUST compile against the same manifest used by the product.

## Stable identity and versioning

The node kind, operation, icon, and version MUST remain visible independently of the editable **Title**. Titles describe
the workflow-specific task; they do not replace type identity.

Use stable machine keys for kinds, ports, outcomes, and configuration fields. Labels MAY evolve without changing graph
identity. Do not encode labels, array positions, or localized text into persisted routing keys.

### Pin behavior, not just metadata

An immutable execution package MUST identify the semantics that can change a result, branch, effect, cost, order, or
recovery decision. A digest derived only from registry metadata is insufficient.

Pin applicable versions or content digests for:

- executor and scheduler behavior;
- expression, path, template, and schema dialects;
- provider operation and adapter semantics;
- webhook decoder and normalized event shape;
- repository revision or base commit;
- model catalog observation, provider route policy, and pricing basis;
- workspace worker image, tools, agent content, and policy; and
- child workflow package and interface.

Change the node semantic version when the same input and configuration could produce different routing, ordering,
rendering, retry, timeout, late-arrival, effect, or evidence behavior. Cosmetic labels and help text do not require a
semantic change.

The Agentic application is an unreleased prototype. Replace obsolete contracts directly and update canonical fixtures
and seed data; do not add compatibility aliases or version-suffixed implementations for discarded behavior.

## Configuration contracts

### Validate early and strictly

Configuration schemas MUST be closed unless an explicit extension point requires otherwise. Validate at three layers:

1. **Edit time:** provide immediate field-level feedback without requiring a run.
2. **Compile time:** reject malformed configuration, invalid embedded schemas, incompatible mappings, unavailable
   capabilities, unsafe topology, and impossible policies.
3. **Runtime:** revalidate defensively at the trust boundary before doing work or reserving an effect.

Runtime validation is defense in depth, not a substitute for compilation. A deterministic configuration error SHOULD
be impossible in a published package.

Validation messages MUST identify the field, explain the constraint in task language, and suggest a correction when
one exists. Do not silently normalize a malformed required value to `{}`, `[]`, an empty string, zero, or a default.

### Make defaults safe and visible

Defaults MUST minimize effects, cost, and irreversible work. They SHOULD produce the smallest useful bounded result.
Display effective defaults before execution, especially when the runtime fills them implicitly.

Good defaults include:

- one attempt for deterministic local work;
- finite total deadlines for remote work;
- small page and collection limits;
- concurrency of one for fan-out;
- mock or fixture mode for provider, model, workspace, and effect tests;
- read-only workspace access;
- explicit Exhausted and Timeout handling; and
- unknown usage or cost represented as unknown, never zero.

Do not use a default merely because it is convenient in the executor. Defaults are product decisions and part of the
immutable contract.

## Data and port contracts

### Use truthful typed ports

Every port MUST have a stable key, visible label, schema, cardinality, and outcome class. The graph MUST distinguish:

- ordinary successful output;
- expected alternative outcomes;
- execution Error; and
- Indeterminate where an external effect may have happened without confirmation.

Dynamic cases, operations, and child interfaces SHOULD generate operation-specific ports. Do not force users to
understand an internal branch envelope or inspect raw JSON to know what a port carries.

Port compatibility MUST be checked while connecting and again during compilation. Cardinality such as one, optional,
many, ordered-many, or exactly-one-of-many MUST be explicit. The editor SHOULD explain an incompatible connection at
the attempted edge, not only in a global error list.

### Propagate schemas and examples

The compiler MUST propagate the most precise known output schema through the graph. Sources include:

- workflow input and output interfaces;
- provider and repository operation manifests;
- event decoder manifests;
- assignments and mappings;
- validation refinements;
- model output mode and structured schema;
- loop item and state types;
- child workflow interfaces; and
- branch and synchronization result contracts.

Use propagated schemas for compatibility checks, field selection, autocomplete, preview data, and output-shape
inspection. Preserve an explicit unknown schema when precision is unavailable; do not substitute a falsely reassuring
open object.

### Use one expression and data-reference model

Mappings, assignments, templates, conditions, correlations, provider requests, and output construction MUST use one
bounded, versioned expression system. It SHOULD provide:

- schema-aware field selection;
- structured paths that preserve property names losslessly;
- constants and explicit fallback behavior;
- lightweight, named conversions;
- missing-value and null behavior;
- compile-time type checking where possible;
- bounded evaluation depth, operations, and output size; and
- a safe sample evaluator.

Do not invent separate dot paths, path arrays, mustache strings, and ad hoc template rules for each node. Do not add
implicit coercion merely to make a mapping succeed.

### Keep topology graph-visible

Visible graph edges or a managed visual region MUST be the single authority for branch, merge, loop, and child
composition. Do not duplicate ownership in hidden fields such as body step IDs, join step IDs, exit IDs, branch keys,
or loop-back flags.

Managed regions MUST have stable boundaries and atomic edit operations. Renaming, reordering, or deleting a case or
region MUST update its ports and edges safely or block with a precise explanation.

## Outcomes and errors

Use the following taxonomy consistently:

| Class | Meaning | Examples | Required behavior |
| --- | --- | --- | --- |
| Success | The node completed its job with valid typed data. | Valid value, confirmed read, persisted artifact. | Route through a typed success output and record evidence. |
| Expected outcome | A normal alternative the workflow may handle. | Invalid, Not found, Refused, Incomplete, Needs review, Exhausted, Timeout, child Failure. | Expose a named typed port; do not classify as an executor fault. |
| Error | The node could not execute its contract. | Transient provider fault, persistence failure, invalid dynamic operand, escaped defect. | Record a typed error and apply the declared retry or failure policy. |
| Indeterminate | An external effect may have happened, but confirmation is unavailable. | Provider accepted a request and the response was lost. | Block blind retry and enter explicit reconciliation. |
| Domain Failure | The author intentionally terminates with a business failure. | Policy rejected, required approval denied. | Keep distinct from `execution_error`, with authored code, message, details, and recovery guidance. |
| Ingress disposition | A delivery did not become workflow data. | Duplicate, unauthorized, unmatched, ignored, quarantined. | Record control-plane evidence unless the workflow explicitly models it. |

Unhandled expected outcomes MUST have an explicit compile-time or workflow-level policy. They MUST NOT silently become
Success, disappear, or be converted to a generic failure.

Error contracts SHOULD include a stable code, safe message, classification, retryability, and structured details.
Preserve provider or internal diagnostics in protected evidence rather than leaking secrets through user-facing text.

## Runtime semantics

### Attempts, retries, and deadlines

- Deterministic local nodes SHOULD default to one attempt and no node timeout when their limits make execution bounded.
- Remote nodes MUST use one total deadline across all internal tries. Starting another try MUST NOT reset the total
  deadline.
- Retry only classified transient errors, with a finite attempt count and bounded jittered backoff.
- Every try MUST retain duration, classification, and incremental usage or cost evidence.
- A manual retry MUST create a new attempt with clear lineage to prior attempts.
- Retrying unchanged deterministic invalid input SHOULD guide the user to repair upstream data or publish a corrected
  configuration instead.
- An indeterminate effect MUST NOT retry automatically. Retry an effect only when nonacceptance is proven or a provider-
  enforced idempotency contract makes repetition safe.

Timeout SHOULD be a graph-routable expected outcome for waits, remote reads, models, joins, workspaces, and child
workflows. A deadline on an external effect produces Timeout or Failed only when nonacceptance is proven; if the effect
may have been accepted, it produces Indeterminate and enters reconciliation. Internal implementation timeouts that do
not represent the user's total deadline MUST not be presented as the complete node policy.

### Cancellation and terminal monotonicity

Cancellation MUST be durable, propagated across active work, and aware of effects that cannot be recalled. The runtime
MUST stop scheduling ordinary activations once a run has selected a terminal state.

Terminal state MUST be monotonic. A succeeded, failed, or cancelled run cannot return to running because of a late
activation, lease recovery, child completion, or provider response. Late events and contributions MAY be recorded as
evidence, but they MUST follow an authored policy and cannot rewrite the winner set.

Detached work requires an explicit contract, visible authoring, independent ownership, and evidence. It MUST NOT arise
accidentally from early Join completion or terminal selection.

### Idempotency and recovery

Use stable logical operation identities so lease recovery and operator retry cannot duplicate fan-out, effects, waits,
child invocations, or terminal transitions.

Persistence transitions that choose a winner, reserve an effect, claim a delivery, create a child, resume a wait, or
select a terminal MUST be atomic and fenced. A crash at any boundary MUST leave one of three states:

- safe to continue idempotently;
- safe to retry because nonexecution is proven; or
- explicitly Indeterminate and awaiting reconciliation.

Never leave a permanent `dispatching` or `in progress` state without a lease, expiry, reconciler, or operator action.

### Resource and capability enforcement

Compile and runtime checks MUST enforce the same capability and sealed-resource boundaries. Provider or workspace
outputs MUST also be verified to remain inside the authorized scope; validating only the request is insufficient.

Treat event payloads, repository content, provider responses, model output, child output, and resume data as untrusted.
Validate at ingress and before crossing each typed boundary. Apply path, host, repository, provider, credential, tool,
and data-classification restrictions at the executor or broker boundary, not only in the editor.

## Boundedness and safety

Every scaling dimension MUST have an explicit limit, an owning layer, a visible effective value, and deterministic
behavior at the boundary.

| Dimension | Typical controls |
| --- | --- |
| Data | Encoded bytes, nesting depth, properties, array items, string length, path length, and aggregate result bytes. |
| Computation | Expression operations, mapping rows, cases, contributors, iterations, activations, and validation complexity. |
| Concurrency | Parallel branches, loop items, provider calls, child runs, workspace tasks, and queue depth. |
| Time | Total node deadline, wait expiry, schedule catch-up window, child timeout, and retention. |
| Recovery | Attempts, internal tries, backoff duration, reconciliation attempts, and late-arrival window. |
| AI and workspace | Prompt bytes, input/output tokens, tool calls, commands, file count, changed paths, runtime, and spend. |
| Effects | Target count, operation count, approval scope, idempotency window, and blast radius. |
| Evidence | Artifact size, event count, preview size, retained attempts, redaction, and truncation. |

Each limit MUST have one authoritative owner. Applicable layers MUST derive consistent preflight, trust-boundary
validation, runtime enforcement, or persistence ceilings from that source; a layer need not duplicate checks it cannot
meaningfully evaluate. If layers require different defensive ceilings, the user-visible limit MUST be no larger than
the smallest downstream ceiling.

Do not silently truncate workflow data, lower a quorum, drop contributors, skip loop items, or clip a rendered artifact.
Return a typed boundary outcome or Error with the observed and allowed values. Evidence previews MAY be truncated when
the full data remains safely retrievable and the UI labels the truncation.

### External-effect safety

Nodes that mutate an external system MUST:

1. validate and render the complete effect before reservation;
2. show target, operation, values, count, sensitivity, reversibility, and blast radius;
3. bind any approval to a digest of that exact preview;
4. server-enforce Mock, Dry run, Live, and Approval-required modes;
5. reserve a stable logical effect and Agency idempotency key;
6. pass provider idempotency keys where supported;
7. journal dispatch lease, provider request identity, confirmation, failure, and unknown outcome;
8. reconcile Indeterminate outcomes before permitting another live dispatch; and
9. resume downstream work exactly once after the final disposition is durable.

A browser confirmation is not a security or safety boundary. Draft tests MUST default to Mock or Dry run. Paid model
tests, write-capable workspace tests, and live external effects require explicit server-authorized opt-in.

## Evidence and provenance

Design evidence at the same time as execution. Do not defer observability until after the node works.

Every attempt MUST retain a bounded representation of:

- resolved Input and configuration identity;
- typed Output or expected outcome;
- Error classification and safe details;
- start, end, duration, attempt, retry, lease, and recovery history;
- artifacts and content hashes;
- usage and cost, including an explicit unknown state;
- provider, model, repository, workspace, scheduler, decoder, and child provenance where applicable;
- effect reservation, approval, dispatch, confirmation, reconciliation, and actor evidence; and
- downstream lineage or winner-set information needed to explain routing.

Specialized evidence SHOULD answer the user's likely operational question directly. Examples include why a condition
matched, which Switch case won, which Join contributors counted, why a schedule fired late, what a model prompt rendered
to, which repository revision was read, and which child run completed.

### Artifacts and sensitive data

An artifact reference MUST NOT be returned until the bytes and metadata are durably persisted. Artifact creation SHOULD
be immutable and content-addressed where practical. Record classification, provenance, hash, size, media type, and
retention.

Sensitivity MUST propagate at least as restrictively as the inputs unless an explicit authorized transformation permits
a downgrade. Apply consistent redaction, encryption, preview, export, and retention policy to Input, Output, Error,
artifacts, usage, and evidence. Do not put secrets or full sensitive payloads in logs merely to improve diagnostics.

## Authoring experience

### Canvas card

Every node card SHOULD show:

- immutable type and selected operation;
- editable **Title**;
- one concise configuration summary;
- validation and latest-run status;
- visible named ports and outcome labels; and
- relevant provider, effect, approval, AI, cost, concurrency, timeout, and limit badges.

Summaries should answer what the node will do, not restate field names. Badges should communicate operational
consequences, not decorate the card. Raw step IDs, package digests, edge flags, and schema JSON belong in Advanced or
diagnostic views.

### Inspector structure

Use progressive disclosure in a predictable order:

1. **Basics:** the task, operation, target, and common required configuration.
2. **Data:** schema-aware input mapping, expressions, output shape, and examples.
3. **Behavior and safety:** outcomes, limits, retries, deadline, effects, approval, cost, and cancellation.
4. **Test:** sample or pinned input, fixture or mock selection, preview, and isolated execution.
5. **Latest run:** Input, Output, Error, Artifacts, Usage, Evidence, duration, and recovery action.
6. **Advanced:** raw schemas, immutable references, semantic versions, expert policies, and diagnostics.

Do not require a user to edit raw JSON, CRON text, digests, or internal IDs for the common path when a picker, builder,
generated form, or visual policy control can represent the contract safely.

### Validation, preview, and repair

- Validate while editing and focus the first invalid control after a blocked action.
- Preserve user input across failed validation and test attempts.
- Preview resolved values, output shape, effects, cost range, fan-out, and schedule occurrences before execution.
- Explain missing upstream data in terms of the source node and field.
- Keep incomplete states visible and recoverable; do not silently delete edges or mappings.
- Pair errors with the appropriate repair action: edit mapping, change policy, retry transient work, reconcile an effect,
  replay an event, inspect a child, or publish a corrected version.

### Isolated testing

Every independently executable node SHOULD support:

- sample input generated from its schema;
- saved and pinned fixtures;
- Test node, run to here, and retry from here where semantics permit;
- resolved-input and output preview;
- provider, model, event, workspace, and child substitutes;
- deterministic expected-output assertions for local work; and
- clear separation between fixture, mock, dry-run, and live results.

The editor SHOULD display the latest test result inline. Whole-workflow testing remains necessary for topology,
synchronization, terminal, and durable recovery behavior.

### Accessibility and interaction

- Ports, icon buttons, badges, validation states, and status indicators MUST have accessible names.
- Color MUST NOT be the only distinction between Success, expected outcome, Error, and Indeterminate.
- All add, configure, connect, reorder, test, inspect, and delete workflows MUST be keyboard-operable.
- Focus MUST move predictably after adding or removing dynamic cases, mappings, and managed regions.
- Text MUST remain readable without colliding with handles, badges, controls, or adjacent content in supported desktop
  layouts.
- Customer-facing labels SHOULD use plain task language and consistent outcome verbs rather than internal runtime terms.

## Category-specific guidance

The shared contracts apply to every category. The following requirements are additions, not exceptions.

### Triggers

**Manual triggers** MUST use the workflow input interface as the sole input contract. Validate input before creating a
run or attempt. Make saved examples available for testing and rerun. Define whether multiple manual triggers are legal;
the compiler and start API MUST agree.

**Provider events** MUST persist and authenticate a delivery before acknowledgement, normalize it once into a versioned
event schema, match sealed resources, and start each matched node idempotently. Distinguish original replay, current-
decoder replay, synthetic test delivery, duplicate, unauthorized, unmatched, and quarantined dispositions. Expose the
event-specific schema, filters, payload specimen, and captured-event replay.

**Schedules** MUST persist intended occurrences separately from dispatch attempts. Authors need timezone and recurrence
pickers, next-fire previews, daylight-saving behavior, misfire and bounded catch-up policy, overlap policy, dispatch
retry, cadence preservation, and auto-pause behavior. Evidence MUST distinguish intended fire, actual dispatch,
lateness, retry, and policy decision.

### Deterministic transformations and validation

Assignments MUST declare source type, target path, missing-value policy, collision policy, keep-input policy, and write
order. Mapping SHOULD be a strict typed projection with explicit conversions rather than a permissive object mutation.

Validation MUST route **Valid** and structured **Invalid** outcomes unless a deliberately selected fail policy converts
Invalid into domain termination. Schema compilation errors are configuration errors; data that fails a valid schema is
an expected outcome. Define whether Invalid carries the raw value, a reference, or a redacted sample.

Rendering nodes MUST define template dialect, escaping, missing/null behavior, output media type, encoded-byte bound,
and sensitivity propagation. They MUST fail closed when durable artifact storage is unavailable.

### Aggregation and collection

Aggregation MUST define contributor identity, readiness, order, completeness, duplicate behavior, empty behavior, item
schema, result schema, maximum items, and maximum encoded bytes. Never silently overwrite duplicate keys.

Keep collection and synchronization responsibilities explicit. A data-oriented Collect node should not conceal durable
Join policy, and a Join should not invent data-shaping semantics without declaring them.

### Provider and repository reads

Generate operation-specific request forms and result schemas from versioned operation manifests. Define pagination,
cursor handling, completeness, freshness, cache behavior, rate-limit evidence, total deadline, transient retry, item and
byte bounds, and error taxonomy.

Pin revision-sensitive repository reads by default. If a read is intentionally live, label that repeatability tradeoff
and record the resolved revision. Validate that every returned resource belongs to the sealed provider, repository,
organization, or project scope.

### AI model nodes

Model nodes MUST expose the rendered prompt, message roles, model and route policy, supported parameters, output mode,
typed structured schema, total deadline, output bound, retry policy, token and spend ceiling, fixture behavior, and
provider provenance.

Preflight SHOULD estimate tokens, cost range, and context fit without implying certainty. Record refusal, truncation,
invalid structured output, and missing usage as distinct outcomes where the workflow can reasonably handle them. Do not
report missing usage or cost as zero. Make paid live testing explicit; fixtures are the default authoring loop.

Model retries can duplicate spend even when the response was lost. Bound all internal tries by one deadline, retain
cost per try, and document provider retry behavior that the platform cannot control.

### Structured judgment

A judgment node MUST add a meaningful domain contract beyond generic structured output. Define the decision vocabulary,
criteria, rationale, evidence references, missing-evidence behavior, escalation or Needs review outcome, and regression
cases. Do not emit numerical confidence by default without a calibration contract and evaluation evidence.

Treat evidence as untrusted content. Separate instructions from evidence, bound both, and retain enough provenance to
reproduce the evaluation conditions without exposing sensitive content unnecessarily.

### Workspace and repository agents

Workspace nodes SHOULD default to read-only. Editing requires explicit allowed paths, commands, tools, model policy,
network policy, validation commands, runtime, token, spend, file, and byte budgets.

Enforce guardrails inside the worker boundary, not only by checking the final patch. Pin the base commit, worker image,
agent content, tools, effective model policy, and executor build. Journal workspace creation, progress, cancellation,
validation, cleanup, and retention. Preserve reviewable patches, commands, validation results, usage, artifacts, and
failure evidence even when the task does not complete.

### Provider actions and external effects

Use operation-specific forms and exact effect previews. Define target cardinality, reversibility, approval policy,
provider idempotency support, timeout ambiguity, error taxonomy, and reconciliation before implementation.

Expose distinct **Confirmed**, **Rejected**, **Failed**, and **Indeterminate** outcomes. Rejected is a deterministic
provider or policy refusal; Failed is an execution fault whose classification states whether nonacceptance and retry
safety are proven. A generic Error port is insufficient for an effect whose result may be unknown. Never allow client-
only checks to authorize live draft effects, and never redispatch an unknown effect simply because an operator clicked
Retry.

### Branches and decisions

Condition and Switch nodes MUST generate stable, visible, named outcome ports. Preserve the original value by contract
unless the node explicitly transforms it. Persist the evaluated operands, selected outcome key, and safe result summary.

Use a schema-aware rule builder and sample evaluation. Case reordering MUST have deterministic first-match semantics and
stable keys. An Otherwise outcome SHOULD be explicit. Manage exclusive reconvergence as part of the branch region
rather than exposing an unexplained generic merge node.

### Joins and synchronization

A Join policy MUST define:

- the known or dynamic contributor set;
- readiness for All, First success, or Quorum;
- contributor failure and impossible-quorum behavior;
- timeout and no-contributor behavior;
- immutable winner selection;
- ordering of results;
- loser cancellation, continuation, or detachment;
- late-arrival evidence;
- branch-effect warnings; and
- behavior after restart, lease expiry, and retry from here.

Use one durable policy-aware scheduler for static and dynamic fan-in. Do not implement a policy name only in the
inspector while ordinary runtime readiness still behaves as All. Once a winner set is durable, late contributions MUST
not change it.

### For each and repeated work

Render loops as managed regions with typed boundaries. **For each** needs Item, index, count, and Completed contracts;
**Repeat** needs State, Iteration, Continue, Break, Completed, Exhausted, and Error semantics as applicable.

Define empty input, ordering, concurrency, per-item failure, partial results, fail-fast behavior, cancellation, nested
wait or child behavior, and retry ownership. Preflight the worst-case activations, remote calls, effects, tokens, spend,
time, and result bytes. Exhaustion MUST be explicit and MUST NOT masquerade as Success.

### Durable waits

Waits MUST bind to an authenticated source and use a closed event schema. Build correlation from typed fields and show
collision risk. Persist occurrence, claim, resume, timeout, duplicate, late, unauthorized, and manual-override evidence.

Resumption MUST use consuming, idempotent, single-winner semantics for the event-versus-timeout race. Expose **Resumed**,
**Timeout**, and **Error** outcomes. Permission-gate manual resume and make its actor and supplied payload visible.

### Child workflows

Use a workflow and version picker, not pasted package digests as the primary experience. Generate typed input mappings
and output ports from the pinned child interface, show interface diffs before upgrade, and reject recursion or excessive
invocation depth at compile time.

Persist one idempotent parent-child link and reconcile authoritative child terminal status. Expose **Success**,
**Failure**, **Timeout**, and **Error** with explicit parent-cancellation, child-cancellation, retry-reuse, late-completion,
and detach policies. Provide a direct link to the child run and retain invocation provenance.

### Terminal nodes

Success MUST be a run-level return boundary unless scoped terminals are a separately designed feature. It MUST construct
and validate the final value against the workflow output interface and atomically prevent incompatible pending work from
starting.

Failure is for intentional domain termination, not provider outages, malformed configuration, or escaped executor
faults. Configured code and message MUST win unless the author explicitly selects an input-mapping mode. Terminal nodes
do not have ordinary downstream outputs or automatic retry.

## Testing strategy

Test depth should match the node's blast radius, but every node needs more than executor happy-path coverage.

| Layer | Minimum evidence |
| --- | --- |
| Manifest | Closed config, canonical defaults, generated controls, stable keys, serialized round trip, and semantic identity. |
| Compiler | Valid package, invalid config, schema compatibility, cardinality, capability/resource checks, topology, outcomes, and budget rejection. |
| Executor | Valid, invalid, empty, boundary, expected outcome, error classification, cancellation, limit enforcement, and deterministic evidence. |
| Persistence | Atomic transitions, duplicate delivery, idempotent replay, lease expiry, worker crash, retry, timeout races, late arrival, and monotonic terminal state. |
| Service/API | Trust-boundary validation, permissions, sealed resources, live-mode authorization, input/output interfaces, and safe error projection. |
| Editor | Add, configure, connect, dynamic fields and ports, inline validation, preview, fixture, Test node, evidence, repair, and deletion. |
| Browser | Complete supported desktop and mobile workflows with keyboard use where applicable, accessible names, focus recovery, empty states, errors, latest evidence, and safe test mode. |
| Documentation | Accurate mental model, contract, defaults, outcomes, examples, limits, evidence, recovery, and known restrictions. |

### Required behavior cases

Select all applicable cases and explain exclusions:

- smallest valid input and representative normal input;
- missing, malformed, incompatible, and unexpected configuration or data;
- empty arrays, objects, contributor sets, branches, and optional values;
- every exact limit and one value beyond it;
- every expected outcome and unhandled-outcome policy;
- transient, permanent, permission, authentication, and rate-limit failures;
- retry with cost, idempotency, and prior-attempt evidence;
- total deadline and event-versus-timeout race;
- cancellation before dispatch, during work, and after an external effect;
- duplicate delivery, replay, lease expiry, crash, restart, and reconciliation;
- late branch, child, provider, model, or event completion;
- artifact persistence failure and sensitive-evidence redaction; and
- isolated fixture or mock behavior versus explicitly authorized live behavior.

Use the real compiler and durable journal for orchestration, suspension, effects, and terminal behavior. Mocking an
executor call cannot prove scheduler, persistence, recovery, or exactly-once semantics.

## Development and review workflow

### 1. Proposal gate

Write a short design before code. It MUST define:

- the one-sentence job and why an existing kind or operation cannot own it;
- intended users and representative workflows;
- work, capability, resource, and effect classes;
- configuration, typed ports, schemas, cardinality, and propagated output;
- Success, expected outcomes, Error, and Indeterminate behavior;
- limits, retry, total deadline, cancellation, idempotency, and recovery;
- persistence, evidence, artifacts, usage, sensitivity, and retention;
- card summary, inspector flow, test mode, and accessibility behavior;
- semantic pinning and compatibility impact;
- category-specific decisions and unresolved product questions; and
- acceptance cases across compiler, durable runtime, API, editor, and browser.

Do not begin implementation while correctness depends on an unresolved outcome, topology, effect, or recovery policy.
Record lower-risk open choices explicitly with an owner and decision point.

### 2. Contract gate

Implement or extend the authoritative manifest first. Review stable keys, closed schemas, defaults, ports, capabilities,
limits, evidence, generated controls, and semantic identity together. Confirm the manifest can represent every behavior
the runtime and editor intend to expose.

### 3. Compiler gate

Implement schema propagation, mapping checks, capabilities, sealed resources, topology, outcome handling, budget checks,
recursion, and impossible-policy rejection. Every accepted package must be executable without discovering deterministic
configuration defects at runtime.

### 4. Durable runtime gate

Implement the executor and persistence transitions as one contract. Prove retries, total deadline, cancellation,
idempotency, atomic winner selection, effect handling, lease recovery, late arrivals, and terminal monotonicity where
applicable.

### 5. Authoring gate

Build generated or task-specific controls from the manifest. Add card identity and summary, named ports, inline
validation, schema-aware data selection, preview, limits, safe test mode, latest evidence, and recovery actions. Keep
raw contracts under Advanced.

### 6. Acceptance gate

Run focused automated cases, then exercise the complete integrated authoring and operational workflow. Review through
three perspectives:

- **Competitive:** Is the node as discoverable and composable as comparable n8n, Make, and Power Automate features,
  while preserving stronger durable and typed semantics?
- **UX:** Can a user understand, configure, connect, test, inspect, and repair it without knowing internal runtime
  structures?
- **User trust:** Can developers, workflow specialists, platform engineers, and operators predict data, effects, cost,
  repeatability, failure, and recovery?

Review every changed customer-facing string with the Fluent Agent MCP when it is available, using the Microsoft Content
Style Guide and relevant Fluent interaction guidance. Exercise supported desktop and mobile layouts. After focused
checks pass, run the repository's required final verification command.

### 7. Review and documentation gate

Add each new registry kind to the numbered review index exactly once and complete the required source-backed node review.
Update the owning review when an operation or shared contract changes materially. Record the implemented contract,
acceptance evidence, remaining gaps, and accepted exceptions. Do not describe a recommendation as implemented until
acceptance evidence proves it.

## Dos and don'ts

| Do | Don't |
| --- | --- |
| Derive defaults, controls, validation, ports, and documentation from one manifest. | Maintain unrelated registry, inspector, compiler, and executor contracts. |
| Keep immutable type and operation visible beside the editable Title. | Make users infer type from a custom title or icon. |
| Use named typed ports for Success, expected outcomes, Error, and Indeterminate. | Turn invalid business data, refusal, exhaustion, timeout, or child failure into generic `step_failed`. |
| Propagate schemas and use one expression system. | Add another free-text path or template syntax for one node. |
| Derive orchestration from visible edges or managed regions. | Duplicate topology in hidden IDs, edge flags, and configuration. |
| Bound every scaling dimension and show effective limits. | Use hidden executor limits or silently truncate, overwrite, skip, or lower thresholds. |
| Retry only classified transient failures within one total deadline. | Treat a stored retry count as implemented behavior or retry deterministic defects. |
| Reconcile unknown external effects before redispatch. | Assume timeout means an effect did not happen. |
| Pin executable and adapter semantics in immutable packages. | Claim repeatability from a metadata-only digest. |
| Persist compact structured evidence and provenance. | Require operators to reconstruct decisions from raw logs and JSON. |
| Return artifact references only after durable storage. | Emit a valid-looking reference when bytes were not written. |
| Default tests to fixtures, mocks, or dry runs. | Let a browser warning be the only barrier to live effects or spend. |
| Expose unknown usage, cost, completeness, or effect state honestly. | Report unknown as zero, complete, successful, or safe to retry. |
| Test crashes, races, retries, and late arrivals through the durable runtime. | Infer recovery correctness from isolated executor unit tests. |

## Decision record for intentional exceptions

Some node behavior is a product choice rather than a universal rule. Record and approve the choice instead of allowing
different layers to choose implicitly. Recurring examples include:

- support for non-object JSON roots in the workflow data plane;
- schema-default application semantics;
- assignment merge and collision policy;
- validation Invalid payload retention;
- Markdown dialect, raw HTML, and classification downgrade authority;
- collection versus Join ownership of contributor readiness;
- revision-pinned versus intentionally live reads;
- model route pinning, refusal routing, retry ownership, and prompt retention;
- schedule daylight-saving, overlap, misfire, and catch-up policy;
- branch reconvergence and fan-out rules;
- Join winner, denominator, loser, ordering, and detached-work policy;
- loop concurrency, partial recovery, Break, Continue, and nested suspension;
- Wait source types, manual resume permissions, and late-event retention;
- child retry reuse, timeout cancellation, detach, recursion, and terminal mapping;
- run-level versus scoped terminals and the meaning of domain Failure; and
- effect approval defaults and authority to abandon an Indeterminate effect.

An exception MUST state its scope, user rationale, runtime consequences, evidence, test cases, and why the shared default
does not apply. It MUST NOT weaken authentication, sealed resources, server-enforced effect safety, atomic persistence,
terminal monotonicity, or truthful evidence.

## Definition of done

A node type is complete only when:

- its manifest, defaults, operation definitions, and semantic identity are authoritative and versioned;
- the registry, compiler, runtime, persistence, API, editor, evidence, tests, and documentation express one contract;
- every accepted package can execute without deterministic contract discovery at runtime;
- schemas propagate and all ports, cardinality, expected outcomes, and unhandled behavior are explicit;
- retry, total deadline, cancellation, idempotency, recovery, and terminal behavior are enforced rather than merely
  configured;
- topology is graph-visible and durable scheduling is proven for synchronization or repeated work;
- effects, capabilities, sealed resources, approvals, live tests, and Indeterminate outcomes are server-safe;
- all work, data, cost, and evidence dimensions are bounded and visible;
- attempts retain enough structured evidence to explain input, output, decision, effect, provenance, cost, and recovery;
- isolated safe testing and the complete accessible authoring workflow are accepted in the integrated product;
- valid, invalid, empty, boundary, failure, retry, timeout, cancellation, crash, race, and recovery cases pass where
  applicable; and
- every implemented behavior has a decided and documented policy, while intentional exceptions and explicitly deferred
  future capabilities are not misrepresented as current behavior.

Do not call a node complete because its executor returns the happy-path value. Completion means users can author it
correctly, the platform can execute and recover it durably, and operators can trust the result.