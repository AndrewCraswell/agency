# Workflow Node Design Review

Status: Design baseline

Last reviewed: 2026-07-20

This review evaluates the 24 workflow node types registered in `stepRegistry.ts`. Three independent LLM judges reviewed
the same implementation evidence from competitive-product, interaction-design, and developer-user-research
perspectives. Their shared rubric covered conceptual clarity, composability, data discovery, failure semantics,
scalability, observability, safety, and least-surprise behavior.

The review is a product-design baseline, not a claim that the recommended behavior is already implemented.

Use the [node type development best practices](node-type-development-best-practices.md) as the normative design,
implementation, and acceptance standard for new node types and operations. The reviews in this document and under
`types/` remain implementation assessments and may identify gaps against that target standard.

## Executive judgment

The execution model is stronger than the authoring experience. Typed ports, bounded execution, immutable packages,
durable waits, provider effect journaling, artifacts, usage evidence, and compiler topology checks form a credible
foundation. The editor does not expose those guarantees clearly enough to help users compose workflows confidently.

The judges agreed on six systemic gaps:

1. Node cards foreground an editable label and category instead of retaining visible type and operation identity.
2. Upstream data is referenced through unrelated text syntaxes rather than one schema-aware data picker and expression
   model.
3. Ports are technically typed but visually unlabeled, and expected outcomes such as invalid, timeout, and provider
   failure are not consistently authorable or routable.
4. Branches, merges, loops, and child workflows require graph edges plus hidden step IDs or flags, creating two sources
   of truth for topology.
5. Whole-workflow draft testing has strong durable evidence, but isolated node testing, pinned samples, mocks, cost
   preflight, and inline latest-run input/output inspection are missing.
6. The registry contains useful contracts and UI metadata, but defaults, controls, executor dispatch, and specialized
   inspectors remain hard-coded by node kind.

The competitive judge additionally identified runtime contracts that must be resolved before the UX can truthfully
represent them: configured retries and failure routes are not fully enforced, ordinary Join policies need scheduler
proof, and executor identity is not actually pinned by the current metadata-derived digest.

## High-quality node definition

A high-quality node is a bounded, independently testable unit of work with one authoritative manifest and predictable
composition semantics.

Every node must satisfy these principles:

1. **Stable identity:** display immutable type, operation, icon, and version independently from an editable task title.
2. **One coherent job:** perform one user-recognizable action, transformation, decision, synchronization, or outcome.
3. **Explicit contracts:** expose named, typed input, output, error, and expected-outcome ports with cardinality.
4. **Discoverable data:** propagate schemas and offer one field picker and expression language across mappings,
   templates, assignments, rules, correlations, and provider requests.
5. **Visible behavior:** summarize configuration, effects, cost, limits, and branch behavior on the card and outline.
6. **Safe defaults:** bound collections, concurrency, iterations, retries, time, payloads, artifacts, effects, and spend.
7. **Truthful failures:** distinguish expected business outcomes from execution faults; declare and enforce retry,
   timeout, idempotency, and recovery behavior.
8. **Single topology source:** derive orchestration from visible graph structure or manage it as one visual container;
   do not duplicate it in hidden IDs.
9. **Testability:** support sample input, isolated execution, run-to-here/from-here, pinned output, and safe provider/model
   mocks.
10. **Operational evidence:** retain input, output, errors, artifacts, usage, effects, duration, provenance, and recovery
    actions for each attempt.
11. **Progressive disclosure:** make the common task visual and direct while keeping raw schemas, digests, and expert
    policy under Advanced.
12. **Extensibility:** derive defaults, validation, documentation, controls, port rendering, and compatibility from the
    same versioned manifest.

## Reusable node anatomy

Every canvas node should contain:

- immutable node type and operation;
- editable **Title**;
- concise configuration summary;
- status and validation state;
- effect, provider, AI, cost, and limit badges when relevant;
- visible named ports with outcome and cardinality;
- latest test status and duration when test evidence exists.

Every inspector should contain:

- task-oriented basic configuration;
- schema-aware data and expression pickers;
- inline validation and output-shape preview;
- sample input and isolated test controls;
- latest Input, Output, Error, Artifacts, Usage, and Evidence views;
- Advanced configuration for raw schemas, immutable references, and expert policy.

## Full node review task list

The scorecards below establish the initial direction. Complete the following tasks to replace each scorecard with a
full, source-backed review of every node kind currently registered in `stepRegistry.ts`. Keep a task open until its
review satisfies the shared definition of done. Add a task whenever a new registry kind is introduced.

### Definition of done for each node

- Trace the registry manifest, configuration schema, ports, defaults, inspector controls, compiler checks, executor
   path, persistence behavior, run evidence, and existing tests.
- Explain the node's intended job, user mental model, inputs, outputs, expected outcomes, errors, retries, timeouts,
   limits, effects, idempotency, and versioning behavior.
- Build representative valid, invalid, empty, boundary, failure, retry, timeout, and recovery cases where those cases
   apply.
- Execute focused automated tests against the real compiler and durable runtime; use provider, model, or workspace
   fixtures only where a real external call is unsafe or unnecessary for the behavior under review.
- Exercise the complete desktop authoring workflow in the integrated browser, including add, configure, connect,
   validate, test, inspect evidence, edit, remove, keyboard use, accessible names, empty states, and error recovery.
- Assess the node independently from the Competitive Expert, UX Expert, and User Researcher perspectives defined in
   this review.
- Compare the node's behavior with the closest n8n, Make, and Microsoft Power Automate patterns, noting where Agency
   should intentionally differ because of durable execution, typed contracts, or effect safety.
- Record what works, correctness defects, authoring friction, missing behavior, contract drift, operational risk,
   accessibility issues, extension constraints, and test gaps with source and acceptance evidence.
- Define the recommended node contract, labeled ports and outcomes, configuration experience, card summary, test
   experience, run evidence, safe defaults, and P0/P1/P2 implementation tasks.
- Reconcile node-specific recommendations with the cross-node principles in this document so shared platform work is
   specified once rather than reimplemented per node.

### Triggers

- [x] Review [`manual_trigger` (`Manual run`)](types/01-manual-trigger.md).
- [x] Review [`provider_event` (`Provider event`)](types/13-provider-event.md).
- [x] Review [`schedule` (`Schedule`)](types/14-schedule.md).

### Data and transformation

- [x] Review [`set_fields` (`Set fields`)](types/02-set-fields.md).
- [x] Review [`map_fields` (`Map fields`)](types/03-map-fields.md).
- [x] Review [`validate` (`Validate`)](types/04-validate.md).
- [x] Review [`compose_markdown` (`Compose Markdown`)](types/07-compose-markdown.md).
- [x] Review [`collect` (`Collect`)](types/08-collect.md).
- [x] Review [`repository_data` (`Repository data`)](types/09-repository-data.md).
- [x] Review [`provider_data` (`Provider data`)](types/15-provider-data.md).

### AI and workspace

- [x] Review [`repository_agent` (`Repository agent`)](types/10-repository-agent.md).
- [x] Review [`ai_model` (`AI model`)](types/11-ai-model.md).
- [x] Review [`structured_judgment` (`Structured judgment`)](types/12-structured-judgment.md).

### Provider actions

- [x] Review [`provider_action` (`Provider action`)](types/16-provider-action.md).

### Decisions and synchronization

- [x] Review [`condition` (`Condition`)](types/17-condition.md).
- [x] Review [`switch` (`Switch`)](types/18-switch.md).
- [x] Review [`exclusive_merge` (`Exclusive merge`)](types/19-exclusive-merge.md).
- [x] Review [`join` (`Join`)](types/20-join.md).
- [x] Review [`for_each` (`For each`)](types/21-for-each.md).
- [x] Review [`bounded_loop` (`Repeat`)](types/22-bounded-loop.md).

### Durable composition

- [x] Review [`wait` (`Wait`)](types/23-wait.md).
- [x] Review [`child_workflow` (`Invoke workflow`)](types/24-child-workflow.md).

### Outcomes

- [x] Review [`success` (`Success`)](types/05-success.md).
- [x] Review [`failure` (`Failure`)](types/06-failure.md).

### Cross-node synthesis

- [ ] Confirm that the completed reviews cover every kind returned by `listWorkflowStepDefinitions()` exactly once.
- [ ] Consolidate repeated findings into shared contracts for ports, expressions, schema propagation, failures, retries,
   orchestration, testing, evidence, effects, cost, and node extension.
- [ ] Resolve contradictory recommendations across nodes and document intentional exceptions to the shared node
   anatomy.
- [ ] Convert accepted P0/P1/P2 findings into sequenced work in the authoritative platform plan with executable exit
   gates.

## Node assessments

Priorities use P0 for correctness or core authorability, P1 for major usability and safety, and P2 for refinement.

### Triggers

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| Manual run | Simple pass-through trigger; workflow input is schema-validated and draft-testable. | Node-level input schema and workflow-level input contract are ambiguous; examples are absent. | Use one visual workflow input contract, show it on the trigger, and support saved test examples. | P1 |
| Provider event | Catalog-backed GitHub and Linear events, sealed resources, and synthetic draft injection. | Event shape, filtering, resource scope, and ingress differences are not visible. | Show event-specific schema and payload specimen, add filters, replay captured events through decoding, and provide Send test event. | P1 |
| Schedule | Supports interval or CRON, timezone validation, and durable scheduling. | CRON/timezone are text-first; next fires, daylight-saving behavior, overlap, and missed-run policy are hidden. | Provide recurrence and timezone pickers, next-fire preview, and explicit skip/queue/catch-up and overlap policies. | P1 |

### Data and transformation

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| Set fields | Deterministic shallow overlay; optional input is preserved. | Values are constants only, collisions are silent, and nested writes or lineage are unavailable. | Assignment rows choose constant or upstream expression, support nested targets, declare merge policy, and preview before/after. | P1 |
| Map fields | Deterministic selection and rename. | Source paths are runtime-validated text; targets are flat; no defaults or conversions. | Two-column schema-aware mapper with nested targets, optional/default behavior, lightweight conversions, and output preview. | P1 |
| Validate | JSON Schema validation with useful issue paths and unchanged valid output. | Invalid data is treated as an execution failure; schema editing is raw and advanced. | Add Valid and Invalid outputs, structured issues, visual schema editing, sample evaluation, and an option to fail instead of route. | P0 |
| Compose Markdown | Bounded artifact creation with hash and provenance. | Placeholders are text-only; no preview, fallback, sensitivity selection, or guaranteed artifact store. | Use the common expression picker, render a live sample preview, detect unresolved fields, select classification, and fail closed if persistence is unavailable. | P1 |
| Collect | Bounded list and keyed-object aggregation. | Many-cardinality behavior and ordering are obscure; key field is text; duplicate keys overwrite silently. | Show contributing branches, item schema, ordering, key picker, empty behavior, and explicit reject/first/last duplicate policy. | P1 |
| Repository data | Bounded repository reads with response validation and repository scope. | Operations have different query needs but share generic ports; overlaps Provider data; mutable refs reduce repeatability. | Generate operation-specific request/result contracts and forms; clarify or unify the boundary with Provider data; optionally pin commit SHA. | P1 |
| Provider data | Capability-filtered GitHub/Linear reads with sealed bindings. | Query/result objects are generic; pagination, freshness, and rate-limit behavior are hidden. | Generate typed operation forms and result schemas from the provider catalog, including pagination and freshness evidence. | P1 |

### AI and workspace

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| AI model | Model snapshots, messages, structured output, artifacts, usage, and cost evidence. | Bindings are text templates; mode-specific output remains generic; no fixture, rendered prompt, or preflight cost. | Prompt workbench with field insertion, rendered preview, token/cost estimate, supported parameters, typed output by mode, fixtures, and routable provider/refusal errors. | P1 |
| Structured judgment | Useful opinionated structured-output primitive with untrusted-evidence framing. | Decision semantics, confidence, rationale, citations, calibration, and regression cases are undefined. | Define a reusable decision contract, typed evidence selection, expected test cases, and optional confidence/rationale/escalation conventions. | P1 |
| Repository agent | Pinned agent definition/commit, workspace isolation, policies, validation, budgets, and compact evidence. | Editor exposes agent and instructions but hides paths, commands, budgets, cost, and execution policy. | Show guardrails and estimated budget before execution, allow explicit policy configuration, preview changes, expose progress/cancellation, and publish a stable typed result. | P0 |

### Provider actions

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| Provider action | Durable effect reservation, idempotency, confirmation, and unknown-outcome reconciliation. | Request is opaque; draft tests can perform live effects; exact impact, approval, retry, and error paths are hidden. | Operation-specific request form, exact effect preview, dry-run/mock where possible, approval policy, blast-radius summary, and standard success/error/indeterminate outcomes. | P0 |

### Decisions and synchronization

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| Condition | Deterministic binary expression with exclusive branch semantics. | Field path is text, True/False ports are unlabeled, and merge ownership is duplicated in config. | Schema-aware rule builder, visible True/False outputs, sample evaluation, and automatically managed merge boundary. | P0 |
| Switch | Ordered cases, default route, and compiler checks for duplicate or unconnected keys. | One generic output plus separately typed edge keys; users must understand an internal branch envelope. | Cases generate visible named ports, original input flows automatically, Otherwise is explicit, and the merge is managed from graph structure. | P0 |
| Exclusive merge | Enforces exactly one selected contribution. | Appears as an unexplained generic many-input node and hides its owning Condition/Switch. | Render as the closing boundary of a managed branch group or insert/manage it automatically. | P1 |
| Join | Supports All, Any, and Quorum configuration and result collection. | Required branch count, late arrivals, cancellation, failures, and side effects are unclear; scheduler behavior needs proof. | Show required/available paths, name results, define timeout/failure/late-arrival and loser-cancellation policy, and enforce each policy durably. | P0 |
| For each | Bounded item count, concurrency, scoped activations, and Join integration. | Body and Join are represented by IDs plus edges; item schema, empty input, per-item errors, and multiplied cost are hidden. | Managed loop region with Item and Completed boundaries, item schema, empty behavior, fail-fast/continue/collect-errors policy, and maximum work/cost preview. | P0 |
| Repeat | Deterministic condition, iteration and activation budgets, scoped state, and exhaustion choice. | Body/exit IDs and loop-back flag duplicate the graph; state and exhaustion are hard to understand. | Managed loop region with typed State, Body, Back, and Exit boundaries; iteration simulation; Break/Continue; explicit exhausted outcome. | P0 |

### Durable composition

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| Wait | Durable suspension, correlation, event schema, expiry, and diagnostics. | Correlation is text, timeout is not an authorable outcome, source authentication and collision risk are hidden. | Schema-aware correlation builder, sample event validation, source-bound matching, and Resumed/Timeout/Error outputs. | P0 |
| Invoke workflow | Pinned package/interface validation, durable child linkage, and propagated result. | Users paste opaque digests; interface mapping, version comparison, timeout, and failure behavior are hidden. | Workflow/version picker with interface diff, generated typed mappings, visible child-run link, configurable timeout, and Success/Failure/Timeout outputs. | P0 |

### Outcomes

| Node | What works | Main gaps | Target behavior | Priority |
| --- | --- | --- | --- | --- |
| Success | Small explicit terminal with durable result. | Workflow output contract is not visible or clearly enforced at this boundary; sibling work semantics are unclear. | Build and preview final output with the common mapper, validate it against workflow output schema, and stop incompatible pending work safely. | P0 |
| Failure | Explicit terminal code/message and optional details. | Incoming data may override configured identity; expected failure and execution error are conflated by surrounding routing. | Typed error builder with clear precedence and templating; reserve this node for intentional domain termination. | P1 |

## Cross-node platform changes

The following sequence reflects consensus across all three judges.

### P0: make contracts truthful

1. Implement and enforce standard success, expected-outcome, error, timeout, and indeterminate routing.
2. Enforce configured retry limits, backoff, retryability, timeouts, and idempotency instead of merely storing policy.
3. Prove durable scheduler semantics for Join policies, loop empty/error cases, late work, sibling cancellation, and lease
   recovery.
4. Validate specialized inputs and outputs and enforce workflow input/output interfaces at terminal boundaries.
5. Pin executable node semantics rather than hashing registry metadata alone.

### P1: make composition discoverable

1. Retain immutable type and operation identity beside the editable Title on cards, outline rows, search, and inspector.
2. Label typed ports and outcomes directly on the graph, including cardinality and compatibility feedback.
3. Introduce one schema-aware data picker and expression system for all values and references.
4. Propagate output schemas and examples through the graph for autocomplete, previews, and preflight validation.
5. Replace duplicated branch/merge/loop IDs with managed graph regions or graph-derived ownership.
6. Generate provider, repository, event, and child-workflow forms from operation/interface manifests.
7. Add isolated node testing, run-to-here/from-here, pinned samples, mocks, and inline latest-run evidence.
8. Show effect, model, agent, fan-out, loop, and schedule impact before execution.

### P2: improve fluency

1. Add concise configuration summaries and result-shape previews to cards and outline rows.
2. Add reusable presets for judgments, schedules, provider operations, and common transformations.
3. Let experts inspect raw contracts and provenance without requiring novices to edit them.

## Persona-specific emphasis

- The **competitive expert** prioritizes familiar dynamic-content selection, visible outcomes, managed branch/loop
  structures, and removal of runtime contracts that do not behave as configured.
- The **UX expert** prioritizes persistent type identity, labeled ports, configuration summaries, task-oriented editors,
  progressive disclosure, and embedded test evidence.
- The **user researcher** prioritizes trust: data lineage, exact effects, safe test substitutes, cost and fan-out
  prediction, repeatability, event replay, and actionable recovery.

These are complementary rather than competing directions. A node is not high quality unless its runtime contract is
correct, its authoring model is understandable, and its operational consequences are visible.
