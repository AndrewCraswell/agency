# Provider Event Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Field | Current value |
| --- | --- |
| Kind | `provider_event` |
| Version | `1` |
| Phase | `6` |
| Category | Trigger |
| Execution class | Provider |
| Mutation policy | None |
| Capability | `provider.events` |
| Input ports | None |
| Output port | `event`, one generic object |

The registry describes this node as the workflow boundary for a normalized GitHub or Linear event. Its job is not to
call a provider. It should authenticate and durably accept one delivery, normalize it into a stable event contract,
match a sealed resource and event subscription, and start each matching workflow exactly once. The source definition is
in [stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L480-L498).

## Job And Mental Model

The author mental model is: **When this event occurs on this connected resource, start the workflow with a predictable
event object.** Users should not need to understand Nango receipt fields, adapter aliases, package digests, or journal
activation bindings. They do need to know which connection and resource are in scope, which event is selected, what
payload fields downstream nodes receive, and whether a captured delivery can be tested or replayed safely.

Today the model is only partially truthful. The catalog and sealed binding identify a provider event, but the output is
an untyped object, filtering is limited to exact catalog/resource matching, live and synthetic inputs have different
shapes, and accepted Nango deliveries are not durably recorded before acknowledgement.

## Current Contract

### Configuration And Catalog

- Required config is `{ provider, eventKey, binding }`; `provider` is `github` or `linear`, while `eventKey` and
  `binding` remain broad ([stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L480-L498)).
- The provider event catalog exposes provider, resource type, event key, and label, but no payload schema, example,
  normalization version, filter fields, or delivery guarantees
  ([contracts.ts](../../../../src/integrations/contracts.ts#L103-L120)).
- GitHub and Linear adapters map provider object/action pairs to catalog event keys. The mappings include aliases, but
  classification remains hand-coded and lossy ([providerAdapters.ts](../../../../src/integrations/providerAdapters.ts#L3-L121)).
- A workflow resource binding seals connection ID, provider, resource type, external ID, name, and capabilities
  ([definition.ts](../../../../src/workflows/definition.ts#L47-L67)). The compiler checks identity and provider equality,
  then explicitly skips catalog/capability validation for event nodes
  ([compiler.ts](../../../../src/workflows/compiler.ts#L632-L684)).
- `provider.events` is registry metadata rather than a resource capability granted by the integration inventory. Event
  scope therefore relies on resource type and exact ID, not an explicit subscription capability.

### Ports And Runtime

- The sole `event` output is labeled **Normalized event**, but its schema accepts any object. Event-specific fields and
  optionality cannot propagate to downstream authoring.
- Draft tests bind user JSON directly to the `event` port
  ([service.ts](../../../../src/workflows/service.ts#L792-L839)). The trigger executor passes `input.event` through
  ([workflowExecutor.ts](../../../../src/workflows/workflowExecutor.ts#L376-L387)).
- Live ingress calls `start()` with `input: { event }`; `start()` then binds that whole value to the `event` port
  ([service.ts](../../../../src/workflows/service.ts#L849-L924)). The trigger therefore emits `{ event: normalizedEvent }`
  instead of `normalizedEvent`. Live, draft-test, and operator rerun shapes are not equivalent.
- The normalized event retains provider, resource type/ID, event key, object type, and optional object ID. It omits the
  connection identity, received time, delivery identity, raw payload digest, normalization version, and provider fields
  needed for richer filters ([providerPorts.ts](../../../../src/integrations/providerPorts.ts#L21-L51)).

### Ingress, Persistence, And Evidence

- Nango signature and body-size checks occur before acceptance, but the server sends `202` before workflow routing and
  performs routing fire-and-forget ([server.ts](../../../../src/controlPlane/server.ts#L348-L380)). A process failure can
  lose an acknowledged delivery.
- Deduplication uses a digest of raw bytes plus normalized event key, not a provider delivery ID. Byte-identical valid
  deliveries collapse while semantically identical differently serialized deliveries do not.
- Receipt connection identity is not part of normalized matching. Matching uses provider, event key, resource type, and
  external resource ID ([publishedTriggers.ts](../../../../src/workflows/publishedTriggers.ts#L105-L121)).
- Journal run uniqueness is package plus trigger identity. The webhook trigger key omits node ID, so two matching event
  nodes in one immutable package compete for one run rather than fan out independently.
- Runs retain sealed input, attempt input/output/error/evidence, and journal events, but no first-class provider delivery
  row links raw receipt, decoder version, match decisions, rejection reason, retries, and started runs.
- **Run again** reuses sealed normalized input. It does not reprocess a captured delivery through authentication,
  decoding, normalization, or matching ([service.ts](../../../../src/workflows/service.ts#L633-L672)).
- The separate native GitHub webhook inbox does persist before acknowledgement and supports claim/retry/reconciliation;
  provider events through Nango do not use that stronger path.

## Authoring Experience

- A new node defaults to GitHub with an empty event key. Opening the custom inspector silently chooses the first catalog
  event ([WorkflowEditorPage.tsx](../../../../../web/src/routes/WorkflowEditorPage.tsx#L155-L158),
  [WorkflowEditorInspector.tsx](../../../../../web/src/routes/WorkflowEditorInspector.tsx#L1438-L1450)).
- GitHub inherits the workflow repository binding; Linear exposes a team picker. The inspector shows an event dropdown,
  but no connection identity for GitHub, payload specimen, schema, filters, captured deliveries, delivery health, or
  replay action.
- Registry-driven `ui.fields` is empty for this kind. Defaults and the specialized inspector are separate sources of
  truth.
- Card and outline reduce identity to GitHub or Linear event. They omit the selected event, resource, connection,
  normalization contract, and last delivery/test state.
- Synthetic draft testing starts after external ingress. It does not exercise signature verification, Nango forwarding,
  normalization, matching, or delivery deduplication, as documented in
  [manual-workflow-testing.md](../../manual-workflow-testing.md#L23-L38).

## Behavior Matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid catalog event | Exact resource/event match starts a run | Persist delivery, normalize once, record match, start each match idempotently |
| Invalid event key | Can compile; may fail catalog projection or never match | Block publish at the field with catalog/version evidence |
| Missing or stale binding | Compiler catches missing/unsealed identity; live health is not a subscription state | Block publish or show disconnected subscription with recovery action |
| Unknown provider action/object | Returns no match and leaves no durable rejection evidence | Retain ignored/quarantined delivery with explicit reason |
| Duplicate delivery | Raw-body-derived key may suppress or miss duplicates | Use provider delivery identity plus per-trigger match identity |
| Two matching nodes in one workflow | Trigger identities collide | One delivery record fans out to independently idempotent node matches |
| Draft test | Injects arbitrary JSON after ingress | Validate a typed sample or replay a captured normalized specimen |
| Live event | Output is double-wrapped | Output exactly one versioned normalized event object |
| Rerun | Reuses normalized run input | Label as workflow-input rerun; offer separate original/current decoder replay |
| Routing failure after `202` | Delivery can be lost | Durable inbox retries with backoff and quarantine |
| Wait resume failure | Can reject trigger fan-out | Isolate wait and trigger consumers; record each outcome |

## Validation, Tests, And Gaps

Existing tests cover registry availability, selected adapter mappings, immutable published matching, synthetic trigger
selection, and parts of the editor resource flow. They do not compose durable Nango receipt persistence, normalization,
multiple matching nodes, journal deduplication, runtime output shape, connection collisions, replay, quarantine, or
operator recovery. Event payload schemas and compatibility are untested because the catalog does not define them.

This documentation review did not run tests or browser acceptance, per task constraint. Findings are based on source and
existing test intent, not fresh execution evidence.

## Expert Judgments

### Competitive Expert

n8n makes production execution data reusable in the editor, Make exposes queued webhook items and request logs, and
Power Automate exposes trigger history, resubmission, and concurrency controls. Agency's durable-run foundation could be
stronger than all three, but its event ingress currently offers less delivery visibility and replay control. Agency
should intentionally differentiate with immutable raw-digest lineage and explicit **Replay with original decoder** and
**Replay with current decoder** actions, rather than treating rerun as replay.

### UX Expert

The event picker is recognizable, but silent first-event selection and hidden GitHub resource scope create accidental
configuration. The card does not answer the basic scanning question, "Which event on what resource?" A schema/specimen
preview and delivery test belong beside event selection; raw receipt and normalization details belong under Advanced.

### User Researcher

Trust depends on answering: Was the delivery received? Was it authentic? How was it normalized? Why did it match or get
ignored? Did replay preserve the original semantics? Current run JSON answers only the final workflow-input portion.
Users diagnosing missed automations would have no durable evidence for the earlier and more failure-prone stages.

## Findings

### P0

1. Nango deliveries are acknowledged before durable persistence and can be lost after `202`.
2. Live ingress violates the advertised event-port contract by double-wrapping normalized events.
3. Trigger deduplication omits matched node identity, so multiple matches in one package collide.
4. Publish does not validate event key/resource compatibility against a sealed, versioned event catalog; one malformed
   active package can also poison global catalog resolution.

### P1

1. No first-class delivery, normalization, match, rejection, retry, or quarantine evidence exists.
2. Replay does not re-run decoding; current **Run again** semantics are mislabeled for event diagnosis.
3. Event outputs are generic, filters are unavailable, and connection identity is discarded before matching.
4. Adapter normalization has unproven edge cases, including merged and removed/deleted distinctions.
5. Wait resumption and trigger fan-out are coupled so one consumer failure can block independent consumers.

### P2

1. Provider attribution and object classification rely on loose string rules.
2. Card, outline, and inspector omit useful subscription and latest-delivery summaries.
3. Catalog ordering acts as an implicit default rather than an explicit product decision.

## Recommended Target

### Contract And Ports

- Config: versioned `eventDefinitionId`, sealed connection/resource reference, optional typed filters, normalization
  version, and explicit subscription status.
- Output `event`: one operation-specific normalized schema with stable envelope fields: `deliveryId`, `provider`,
  `connectionId`, `resource`, `event`, `object`, `occurredAt`, `receivedAt`, `payload`, and `normalizationVersion`.
- Outcomes: `event` for matched delivery and operational evidence for `ignored`, `quarantined`, and `delivery_error`.
  Ignored ingress should not become a workflow branch unless the author explicitly opts into an administrative flow.
- Version provider event schemas and decoder semantics in the immutable package.

### Card And Inspector

- Card summary: **GitHub pull request merged on octo/agency**, connection health, filter count, and latest delivery/test
  state.
- Inspector basics: provider connection, resource, event, schema-derived filters, normalized specimen, and **Send test
  event** using a validated synthetic specimen.
- Test area: choose saved sample, captured delivery, or synthetic specimen; clearly distinguish post-ingress test from
  full ingress replay.
- Advanced: raw receipt metadata, decoder version, delivery identity policy, schema, and retention.

### Evidence And Safe Defaults

- Persist before acknowledgement; cap payload size; encrypt or redact raw sensitive fields; retain immutable digest and
  decoder version.
- Default to exact resource scope, no hidden event selection, independent fan-out, bounded exponential retry, and
  quarantine after a visible attempt ceiling.
- Record receipt, authentication, normalization, match decisions, run links, retries, and replay lineage.

## Fix Checklist

- [ ] **P0: Introduce a durable provider-delivery inbox.** Acceptance: a valid delivery is stored before `202`; duplicate
  provider delivery IDs return the existing record; a crash after acknowledgement is retried; terminal failures become
  operator-visible quarantined records.
- [ ] **P0: Make live and test payloads contract-identical.** Acceptance: live, synthetic, captured replay, and rerun all
  present exactly one normalized event at the `event` port and pass one shared schema test.
- [ ] **P0: Make fan-out idempotent per matched trigger.** Acceptance: two matching nodes in one package each start once;
  redelivery starts neither twice; evidence links both matches to one delivery.
- [ ] **P0: Validate sealed event definitions at publish.** Acceptance: unknown event, provider/resource mismatch, stale
  catalog version, and missing binding focus the correct inspector field without blocking unrelated active workflows.
- [ ] **P1: Add original/current decoder replay.** Acceptance: both modes create auditable replay lineage, preserve the
  source delivery, show normalized diffs, and cannot masquerade as a new provider delivery.
- [ ] **P1: Generate event filters and output schemas from the catalog.** Acceptance: downstream field pickers know the
  selected event schema and invalid filters cannot publish.
- [ ] **P1: Add delivery evidence and recovery UI.** Acceptance: operators can inspect received, ignored, retrying,
  matched, dispatched, and quarantined states with reason, timestamps, attempts, and linked runs.
- [ ] **P2: Show subscription identity everywhere.** Acceptance: card, outline, search, and inspector retain immutable
  node type plus event, resource, connection health, and last test/delivery summary.

## Dependencies And Open Decisions

Dependencies: shared schema propagation and field picker; versioned provider manifest; durable ingress store; standard
expected-outcome/error evidence; sensitive payload retention policy; per-trigger idempotency; run-detail delivery links.

Open decisions:

1. Which raw provider fields belong in the stable normalized envelope versus provider-specific `payload`?
2. Must event filters run before durable storage, before matching, or only as a workflow-level expected outcome?
3. What retention and redaction policy applies to raw, normalized, ignored, and quarantined deliveries?
4. Should replay with the current decoder start workflows automatically or require preview and explicit confirmation?
