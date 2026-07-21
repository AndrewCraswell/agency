# Invoke Workflow Node Review

Status: Design review

Last reviewed: 2026-07-20

This review covers `child_workflow@1`, displayed as Invoke workflow. It traces immutable selection, interface
validation, durable child linkage, completion reconciliation, authoring, evidence, and inspected tests. No tests or
browser acceptance were executed for this documentation-only review.

## Identity and intended job

| Attribute | Current value |
| --- | --- |
| Registry kind | `child_workflow` |
| Display label | Invoke workflow |
| Version and release | Version 1, phase 7 |
| Category and execution | Action, control execution, external effect mutation policy |
| Capability | `workflow.invoke` |
| Intended job | Start one pinned child workflow with validated input, wait durably, and return its terminal result to the parent. |

The user mental model should be: "Run this reusable workflow version with these mapped inputs, wait up to this long,
then continue through Success, Failure, or Timeout." The runtime contains much of that durable composition model, but
the editor exposes it as two cryptographic digests and one generic object input/output.

## Current contract

### Configuration and ports

The manifest in `apps/agentic/src/workflows/stepRegistry.ts` requires:

| Field | Current contract |
| --- | --- |
| `packageDigest` | Required SHA-256 digest pasted by the author. The editor default is empty. |
| `interfaceDigest` | Required SHA-256 digest pasted by the author. The editor default is empty. |

The input and output are open objects. The child workflow name, version, input fields, required mappings, output fields,
timeout, cancellation policy, and failure outcomes are absent from the manifest. The capability and external-effect
classification correctly signal that invocation creates durable work beyond the parent activation.

Package and interface digests are valuable immutable runtime references, but they should be compiler outputs from a
human workflow/version selection. Requiring authors to paste them makes a safety mechanism the primary UX.

### Compiler validation

The generic compiler validates config syntax, capability availability, ports, and mappings. It cannot resolve the
selected child's interface at draft authoring time from the current config alone, generate typed mappings, compare
versions, reject recursion, calculate invocation depth, or require handling of child Failure and Timeout.

The runtime performs important validation later: it loads the package, requires exactly one Manual run trigger,
calculates/compares the interface digest from child input/output schemas, and validates the supplied child input. These
checks are authoritative but occur after a parent run has started rather than during normal authoring and publish.

## Authoring experience

`ChildWorkflowInspector` in `apps/web/src/routes/WorkflowEditorInspector.tsx` places raw package and interface digest
fields under Advanced. There is no basic workflow picker, version policy, interface preview, field mapper, compatibility
warning, timeout, or child output browser. Empty digest defaults make a newly added node invalid without giving a normal
path to a valid selection.

The canvas card displays editable title, category, and description. It does not retain the selected child name/version,
input completeness, effect status, or Success/Failure/Timeout ports. The generic handles are unlabeled.

Run detail lists child-link records, including child run ID and immutable digests, but the inspected rendering does not
establish a clear navigable parent-to-child execution link or a child-centered summary. Users must correlate IDs
manually to inspect the called run.

## Runtime, persistence, and evidence

The dispatcher resolves parent input, loads the child package, requires one Manual run trigger, then calls
`invokeChildWorkflow()`. That journal transaction:

- validates the child interface digest and input schema;
- idempotently reuses a link for the same immutable parent activation;
- creates the child run and initial trigger activation;
- creates one parent-to-child link with package and interface digests;
- suspends the parent attempt on an internal wait;
- assigns a fixed expiry seven days in the future.

The link primary key `(parentRunId, parentActivationId)` and unique child-run index make invocation idempotent for the
parent activation. The child package is immutable, so retries cannot silently call a newly edited child version.

The dispatcher polls child links. `getChildRunCompletion()` looks for a succeeded Success terminal or a failed Failure
terminal. This is narrower than journal run status: a child that terminally fails because an arbitrary step fails may
not have a failed Failure-node activation, so reconciliation can fail to discover a completed failed child.

On discovery, the dispatcher first calls `recordChildRunCompletion()`, then separately calls `resumeWait()` for success
or `failWait()` for failure. The immutable link update is idempotent, and the wait methods are transactional, but the
two operations are separate transactions. A crash between them leaves a completed link with a still-waiting parent
until polling repairs it. That can be recoverable, but atomic completion/resume and its latency guarantee are not
established as one contract.

Child failure cancels the wait and terminally fails the parent. The fixed internal wait timeout also reaches the generic
timeout path, which terminally fails the parent; no child cancellation or late-completion policy is authored. Success
passes the child result to the generic `output` port.

Run detail retains parent and child IDs, package and interface digests, terminal status, result/error, completion time,
wait state, attempts, and events. It does not present mapped inputs/outputs against field names, version compatibility,
invocation duration, timeout disposition, recursive depth, or a one-click child execution trace.

## Validation, tests, and gaps

Executor and journal tests cover child invocation, immutable link creation and listing, interface/input validation,
idempotent completion recording, and success/failure reconciliation in selected paths. Editor tests cover persistence of
the raw digests. Run-detail tests cover generic child-link presence.

The inspected suite does not establish:

- picker-driven draft selection and generated typed mappings;
- publish-time interface compatibility and version change handling;
- failed child discovery when no Failure terminal activation succeeds or fails;
- an atomic or fully proven crash-recoverable completion-link plus parent-resume protocol;
- configurable timeout, parent cancellation, child cancellation, and late child completion;
- recursion and maximum invocation-depth limits;
- capability/resource inheritance and delegated authorization across the boundary;
- navigable parent/child evidence and accessible end-to-end authoring.

## Behavior matrix

| Scenario | Current behavior | Target behavior |
| --- | --- | --- |
| Valid pinned child and input | Creates child run/link and parent wait atomically, then resumes parent after child success is reconciled. | Preserve immutable invocation and expose typed Success. |
| Child package missing | Runtime invocation fails after the parent run starts. | Block draft/publish selection and retain a structured configuration error only for races or deleted prototypes. |
| Child lacks exactly one Manual run trigger | Runtime rejects invocation. | Filter picker choices and block publish with a clear interface requirement. |
| Interface digest changed | Runtime rejects the selected package/interface mismatch. | Show interface diff during authoring and require explicit remap or repin. |
| Parent input violates child schema | Runtime rejects before creating invalid child work. | Validate mappings at compile time and sample time; retain runtime defense. |
| Child succeeds | Link records result, then a separate transaction resumes parent with `output`. | Emit typed Success and make completion plus parent transition observably atomic or provably reconciled. |
| Child fails through Failure terminal | Link records failure and parent is failed. | Emit Failure with structured child error and let the parent route it. |
| Child fails at an arbitrary step | Completion lookup may not find a failed Failure-node activation. | Reconcile from authoritative child run terminal state and terminal evidence. |
| Seven-day limit expires | Parent wait times out and parent fails; author cannot configure or route it. | Emit Timeout and apply explicit child cancellation/late-completion policy. |
| Parent is cancelled | Child disposition is not an authored contract. | Journal propagate, detach, or leave-running policy and surface the result. |
| Reconciliation worker crashes between link completion and resume | Separate transactions can leave a completed link and waiting parent until later polling. | Repair deterministically with bounded latency and no duplicate parent output, or transition both in one transaction. |
| Recursive invocation | No reviewed compile-time depth/cycle contract. | Reject direct recursion and enforce a sealed maximum invocation depth. |

## Expert judgments

### Competitive Expert

n8n Execute Sub-workflow lets authors select a workflow, derive inputs, choose whether to wait, and navigate between
parent and sub-executions. Power Automate's Run a Child Flow uses a picker, displays child-defined inputs, exposes child
outputs, and keeps parent and child in a shared solution; its documented parent wait lifetime is explicit. Make's
fetched Call a scenario page was not substantive enough for detailed claims. Agency's pinned package, interface digest,
validated input, idempotent link, and durable parent wait are stronger reproducibility primitives. The competitive gap
is discoverability and truthful failure/timeout composition, not the absence of a low-level durable model.

### UX Expert

Two digests are not a viable primary task interface. Selection should begin with workflow name, version policy, status,
owner, and typed interface. Required child inputs should generate mapping rows immediately, and outputs should appear in
the parent data picker. Immutable digests belong in a read-only Advanced provenance section. The card should show the
selected child and version, not merely the broad Action category.

### User Researcher

Users need confidence that the called workflow is the one they reviewed and that changes will not silently break the
parent. A picker plus interface diff can preserve both usability and pinning. During incidents, the dominant questions
are "Did the child start?", "Where is its run?", "Why is the parent still waiting?", and "What happens if I retry?"
Direct navigation, one shared invocation timeline, and clear idempotency behavior are therefore core, not optional
diagnostics.

## Findings

### P0

1. **Failed child completion is inferred from a Failure-node activation rather than authoritative run termination.** A
   child can fail elsewhere and remain undiscovered by the reviewed lookup.
2. **Failure and timeout are not routable parent outcomes.** Child failure and fixed wait expiry terminally fail the
   parent, preventing normal compensation and fallback workflows.
3. **Completion recording and parent transition are separate transactions.** Idempotency helps, but crash recovery and
   bounded reconciliation latency need an explicit invariant and proof.
4. **The node is not authorable without opaque external knowledge.** Raw digests and generic objects provide no normal
   workflow selection or interface mapping path.

### P1

1. **Timeout is fixed at seven days.** The author cannot choose a business deadline or a child/late-completion policy.
2. **Interface validation is runtime-late.** Strong digest and schema checks exist, but draft and publish do not provide
   typed mapping or compatibility feedback.
3. **Cancellation, recursion, and depth are undefined.** Parent cancellation and recursive invocation can create
   uncontrolled durable work without an authored contract.
4. **Evidence is not navigable or interface-aware.** Link records exist, but the UI does not make the child trace and
   mapped fields a primary path.

### P2

1. The card and outline omit child name, version, wait policy, and latest child status.
2. No reusable mapping presets or interface-change review flow exist.

## Recommended target contract

### Ports and outcomes

After selecting a child interface, generate:

- Input `Child input<I>`: exact child workflow input schema with required-field mappings.
- Outcome `Success<O>`: exact child output schema plus child run reference.
- Outcome `Failure`: structured child terminal error with child run reference and failed step summary.
- Outcome `Timeout`: deadline, elapsed time, child run reference, and child disposition.
- Standard `Error`: selection, package, permission, persistence, or scheduler faults before a child outcome exists.

The package digest, interface digest, and child trigger identity are sealed compiled provenance, not author-entered
business fields.

### Configuration and safe defaults

- `workflowId`: selected from accessible reusable workflows.
- `versionPolicy`: default `pin active version at parent publish`; optional explicit published version.
- `inputMappings`: generated from child required and optional fields using the common mapper.
- `timeout`: required, unit-aware, default 24 hours, constrained by platform retention.
- `onParentCancel`: default `cancel child` when safe; alternatives require explicit policy.
- `onTimeout`: default `request child cancellation and route Timeout`; never silently detach.
- `maximumDepth`: platform-enforced and sealed; direct and indirect recursion rejected by default.
- Child capability/resource requirements checked at publish against delegated parent permissions.

The compiler resolves selection to immutable package and interface digests. A newly published child version never changes
an already published parent package.

### Card and inspector

The card should show immutable **Invoke workflow**, editable Title, child name and pinned version, required mapping
status, timeout, effect badge, and latest child status. Success, Failure, and Timeout ports must be named.

The inspector should provide searchable workflow/version selection, child owner/status, input/output schema, generated
mapping rows, sample validation, interface diff, timeout and cancellation policy, and a test fixture. Advanced should
show package/interface digests, compiled trigger identity, capabilities, and provenance read-only.

### Testing and evidence

Isolated testing should allow a real pinned child in draft-test mode or a typed fixture with success, failure, and
timeout cases. It must state whether child effects are live and preserve the parent/child test link.

Run detail should show a navigable child run link, selected workflow/version, package/interface digests, mapped input
and output by schema field, invocation and wait duration, terminal child status, timeout/cancellation disposition,
reconciliation attempts, and parent transition. Parent and child event timelines should cross-link one correlation ID.

## Fix checklist

- [ ] **P0: Reconcile from authoritative child run terminal state.** Acceptance: every succeeded, failed, cancelled, or
      abandoned child state has a deterministic parent outcome even when no Success or Failure terminal activation ran.
- [ ] **P0: Add Success, Failure, Timeout, and Error outcomes.** Acceptance: child business failure and expiry can be
      routed without terminally failing the parent; unhandled outcomes are explicit at compile or policy time.
- [ ] **P0: Prove atomic or idempotently reconciled completion.** Acceptance: crash tests before and after link update and
      parent transition repair within a bounded interval, never duplicate output, and expose reconciliation evidence.
- [ ] **P0: Replace digest entry with a workflow/version picker.** Acceptance: an author can select an eligible child,
      complete required mappings, and publish without discovering or typing a digest.
- [ ] **P1: Generate and compile typed interfaces.** Acceptance: required child inputs create mapping controls,
      incompatible mappings fail compile, child outputs propagate to the parent picker, and runtime validation remains.
- [ ] **P1: Add interface diff and repin workflow.** Acceptance: changing the selected version shows added, removed, and
      changed fields and requires explicit resolution before the parent can publish.
- [ ] **P1: Make timeout and cancellation explicit.** Acceptance: timeout is configurable and bounded; parent cancel,
      timeout, retry, and late child completion each have journaled child disposition and focused tests.
- [ ] **P1: Enforce recursion, depth, capability, and resource rules.** Acceptance: direct/indirect cycles fail publish,
      depth has a hard run bound, and delegated access is sealed and auditable.
- [ ] **P1: Add navigable composition evidence.** Acceptance: parent and child run pages link both ways and show one
      interface-aware invocation timeline, mapped data, status, duration, and reconciliation history.
- [ ] **P2: Add concise summaries and reusable mappings.** Acceptance: card and outline show child/version/policy/status,
      and authors can reuse a mapping only when its interface digest remains compatible.

## Dependencies and open decisions

Shared dependencies are a reusable-workflow catalog, published interface metadata, the common mapper and schema
propagation, standard expected outcomes, capability delegation, cancellation/effect safety, lease and reconciliation
infrastructure, and cross-run navigation.

Open product decisions:

- Whether parents may select draft children for draft tests only, or only published child versions.
- Whether a parent retry reuses a terminal child result, creates a new child, or depends on failure classification.
- Whether timeout requests cancellation synchronously, records an asynchronous request, or permits explicit detach.
- Which child terminal states map to Failure versus Error, especially cancelled and abandoned.
- Whether recursive workflows are permanently forbidden or allowed only with a separate bounded recursion construct.
- How child secrets, resource bindings, and connection identities are delegated without copying credentials.

## Source map

- Registry and manifest: `apps/agentic/src/workflows/stepRegistry.ts`
- Compiler: `apps/agentic/src/workflows/compiler.ts`
- Dispatcher and reconciliation: `apps/agentic/src/workflows/workflowExecutor.ts`
- Child invocation and link persistence: `apps/agentic/src/persistence/workflowJournalStore.ts`
- Link and wait schema: `apps/agentic/src/persistence/schema.ts`
- Workflow service: `apps/agentic/src/workflows/service.ts`
- Editor and inspector: `apps/web/src/routes/WorkflowEditorPage.tsx`,
  `apps/web/src/routes/WorkflowEditorInspector.tsx`
- Run evidence: `apps/web/src/routes/RunDetailPage.tsx`
- Focused tests: `workflowExecutor.test.ts`, `workflowJournalStore.test.ts`, `WorkflowEditorPage.test.tsx`,
  `RunDetailPage.test.tsx`