# Provider Data Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Field | Current value |
| --- | --- |
| Kind | `provider_data` |
| Version | `1` |
| Phase | `6` |
| Category | Data |
| Execution class | Provider |
| Mutation policy | None |
| Capability | `provider.read` |
| Input port | `query`, optional generic object |
| Output port | `result`, one generic object |

The node reads GitHub or Linear data through a sealed connection/resource binding. Its intended mental model is:
**Choose a provider operation, map its required query fields, and receive a typed, bounded result with freshness and
pagination evidence.** The registry definition is in [stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L522-L540).

## Job And Mental Model

Authors should think in domain operations such as **Get pull request**, **List pull request comments**, or **Get Linear
task**, not a generic request object. Selection of an operation should define required inputs, output shape, pagination,
resource scope, failure classes, and evidence. Connection details should remain sealed platform concerns.

Today the operation catalog selects the adapter and capability, but does not describe the operation contract. Required
query fields are discovered only through runtime failures, collection results can truncate silently, rate limits are
opaque, and one Linear path does not enforce the selected team boundary.

## Current Contract

### Catalog, Binding, And Compilation

- Config requires `provider`, `operation`, and `binding`; query/result ports accept broad objects
  ([stepRegistry.ts](../../../../src/workflows/stepRegistry.ts#L522-L540)).
- The catalog enumerates eight reads across GitHub and Linear. Each entry contains ID, provider, mode, resource type,
  capability, and label only. It has no request/result schema, operation version, pagination, rate-limit, retry, or
  evidence policy ([providerCatalog.ts](../../../../src/workflows/providerCatalog.ts#L3-L164)).
- The compiler confirms sealed connection/external identity, provider, read mode, resource type, and capability
  ([compiler.ts](../../../../src/workflows/compiler.ts#L632-L709)). It cannot validate operation-specific query or result
  shapes and does not seal operation/adapter semantics into the package.
- Compile-time binding checks accept less than the strict runtime binding schema. A partial embedded binding can match a
  sealed identity and then fail in `ProviderStepConfigSchema` at execution.
- Multiple binding keys for the same connection/external ID are ambiguous because compiler lookup takes the first match
  and later reports the other binding unreferenced.

### Runtime Operations

- The executor rechecks operation/provider/mode/capability, connected status, exact resource identity/name, and stale
  state before calling a provider port ([providerExecutor.ts](../../../../src/workflows/providerExecutor.ts#L44-L148)).
- Provider ports accept `Record<string, unknown>` and return `unknown`; operation-specific Zod parsing lives inside
  adapters rather than in the catalog ([providerExecutionAdapters.ts](../../../../src/integrations/providerExecutionAdapters.ts#L45-L168)).
- Current query/result behavior:

| Operation | Required query | Current completeness |
| --- | --- | --- |
| `github.repository` | None | Provider JSON, unvalidated |
| `github.pull_request` | Positive `pullRequestNumber` | Provider JSON, unvalidated |
| `github.pull_request_comments` | Positive `pullRequestNumber` | Array, first 100 only |
| `github.pull_request_reviews` | Positive `pullRequestNumber` | Array, first 100 only |
| `github.checks` | Nonempty `ref`, plus erroneously parsed `pullRequestNumber` | First 100 check runs |
| `linear.ready_issues` | Optional `limit`, default 25, maximum 100 | Generic GraphQL data, no page info |
| `linear.issue` | Nonempty `issueId` | Global issue lookup, no team verification |
| `linear.issue_comments` | Nonempty `issueId` | Global issue lookup, first 100 comments |

- Linear single-issue reads query globally by issue ID and do not request or verify `issue.team.id`. A workflow sealed to
  team A can read an issue from team B when the connection has access to both
  ([providerExecutionAdapters.ts](../../../../src/integrations/providerExecutionAdapters.ts#L145-L168)).
- Collection endpoints request one capped page and return no cursor, `hasMore`, truncation marker, or request count.
- The credential broker exposes response data but not response status/headers such as `Retry-After`. Provider throttling
  cannot drive real retry scheduling or rate-limit evidence.
- Step `failurePolicy.maximumAttempts` is stored but not automatically enforced for provider reads. A provider exception
  fails the activation/run until an operator explicitly retries it.

### Persistence And Evidence

The entire result is stored in attempt output JSONB; attempt evidence remains generic and normally empty. There is no
provider-read observation containing operation version, sealed resource, request digest, observed time, response
digest, item/page count, cursor, completeness, freshness, rate-limit state, provider request ID, or retry history.
Serialized byte size and nested field size are not explicitly bounded at this node boundary.

Existing immutable packages snapshot generic step definitions and resource references, but runtime resolves the current
catalog and adapter. Provider semantics can change without changing the package digest.

## Authoring Experience

- A new node defaults to GitHub repository metadata and may inherit the workflow repository binding
  ([WorkflowEditorPage.tsx](../../../../../web/src/routes/WorkflowEditorPage.tsx#L161-L163)).
- The specialized inspector loads inventories and operations, then offers Provider, Operation, and Linear Team. It does
  not render required query fields, upstream mappings, result schema, pagination, freshness, or rate-limit behavior
  ([WorkflowEditorInspector.tsx](../../../../../web/src/routes/WorkflowEditorInspector.tsx#L1707-L1805)).
- Changing a Linear operation rebuilds config and can remove an otherwise compatible team binding, forcing reselection.
- Resource selection values use names, so duplicate names across connections can resolve to the wrong first match.
- Registry-driven `ui.fields` is empty. Card and outline omit provider, operation, resource, query requirements, result
  type, page policy, and latest observation.

## Behavior Matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid single-record read | Adapter returns provider JSON | Validate typed request and normalized typed result |
| Missing query field | Publishes, then adapter throws | Inline/compiler error on the exact required field |
| Wrong query type | Runtime Zod failure | Schema-aware mapping rejects before execution |
| Empty collection | Provider-specific wrapper/array | Typed empty collection with completeness metadata |
| More than first page | Silently truncated | Explicit auto-page or cursor outcome with bounds |
| Rate limit | Generic provider exception | Retryable `throttled` outcome with reset/backoff evidence |
| Stale/disconnected resource | Runtime fails | Preflight health warning and routable connection error |
| Linear issue outside team | Currently readable | Reject as resource-scope violation |
| Changed adapter after publish | Old package uses new semantics | Pin operation schema and adapter semantic digest |
| Retry | Operator-only activation retry | Enforce bounded policy using retry classification |
| Large result | Stored as arbitrary JSON | Enforce item/byte bounds and artifact or page strategy |

## Validation, Tests, And Gaps

Existing tests cover catalog routing, common happy paths, default Linear limit, stale resources, selected compiler binding
errors, and provider selection in the editor. Missing coverage includes cross-team access, every operation's request and
result schema, partial binding drift, duplicate binding identity, pagination boundaries, cursors, 429/`Retry-After`,
automatic retries, malformed provider responses, payload byte bounds, freshness evidence, binding retention, and card
summaries.

This documentation review did not run tests or browser acceptance, per task constraint.

## Expert Judgments

### Competitive Expert

n8n's request tooling exposes response headers/status and pagination modes; Make presents typed input/output bundles and
inspectable operation data; Power Automate custom connectors define request/response schemas, required fields, tests,
pagination, and retry behavior. Agency's sealed resources and capability checks are a stronger security base, but the
operation catalog is not rich enough to offer parity in authoring or completeness. Agency should preserve sealed
provider-neutral bindings while adopting versioned connector-style operation manifests.

### UX Expert

Selecting **Task comments** without seeing an `issueId` input is incomplete authoring. Operation selection should
immediately reshape the inspector and ports, display required/optional fields, and preview the result. Pagination and
freshness need human labels such as **Up to 100 newest comments** or **All pages, maximum 500 items**.

### User Researcher

Users often treat a successful list read as complete. Silent truncation creates false confidence and can corrupt later
AI judgments or actions. The run must state when data was observed, from which resource, how many requests/items were
read, and whether more data existed. Scope violations are especially serious because the selected team communicates a
security boundary that runtime currently does not uphold.

## Findings

### P0

1. Linear issue and issue-comment reads do not enforce the sealed team boundary.

### P1

1. Operation requests and results are generic, so malformed workflows publish and some array results contradict the
   registry's object output.
2. Pagination is hidden and collections truncate silently.
3. Rate-limit status, retry classification, and `Retry-After` are discarded; configured attempt policy is not enforced.
4. Immutable packages do not pin operation schema or adapter semantics.
5. Read evidence lacks provenance, freshness, completeness, request counts, and response digests.
6. Compile-time and runtime binding schemas disagree; duplicate resource identities can become unpublishable.
7. Result size is not bounded coherently at the node boundary.

### P2

1. `github.checks` unnecessarily requires `pullRequestNumber` before reading `ref`.
2. Compatible Linear operation changes can remove the selected team.
3. Duplicate resource names and empty inventory states make the inspector brittle.
4. Card, outline, and validation focus omit operation-specific identity.

## Recommended Target

### Manifest, Ports, And Outcomes

- Extend each operation manifest with semantic version/digest, request schema, normalized result schema, examples,
  resource-scope assertion, pagination modes and limits, freshness semantics, retry/error taxonomy, byte/item limits, and
  evidence policy.
- Generate operation-specific input fields and a typed `result` port. Collection results should use a stable envelope:
  `{ items, pageInfo, completeness, observedAt, source }`.
- Standard outcomes: `result`, `not_found`, `throttled`, `connection_error`, `permission_denied`, `invalid_response`, and
  `limit_exceeded`. Expected outcomes may be routed; execution faults retain structured error evidence.

### Card And Inspector

- Card summary: **Linear: Get task comments from Platform team**, page policy, and last item count/freshness.
- Inspector basics: connection/resource, operation, schema-generated query mapping, bounds, and result preview.
- Pagination section: first page, all pages up to a bound, or cursor passthrough. Show estimated requests.
- Test area: saved/pinned sample, fixture mode, live read with explicit request bound, and latest input/output/evidence.
- Advanced: raw schemas, operation digest, provider response metadata, retry policy, and byte budget.

### Evidence And Safe Defaults

- Default to the smallest useful bounded page, never claim completeness without page evidence, and stop before provider
  or workflow byte/item budgets are exceeded.
- Record operation/version, resource/connection reference, request and response digests, observed time, provider request
  ID, page/request/item counts, completeness, freshness, rate-limit snapshot, retries, and normalized schema version.
- Verify every returned object's resource scope where the provider endpoint is not inherently scoped.

## Fix Checklist

- [ ] **P0: Enforce Linear team scope.** Acceptance: `linear.issue` and `linear.issue_comments` request team identity and
  reject an issue outside the sealed team; cross-team tests cover shared connections.
- [ ] **P1: Create versioned operation manifests.** Acceptance: all eight reads define request/result schemas, examples,
  scope, pagination, error taxonomy, and semantic digest used by compiler, inspector, executor, and package digest.
- [ ] **P1: Generate typed authoring and ports.** Acceptance: required query fields appear on operation selection,
  upstream mappings are schema-checked, array/object result shape is truthful, and invalid queries cannot publish.
- [ ] **P1: Implement explicit pagination.** Acceptance: first-page, bounded auto-page, and cursor modes expose page info,
  truncation/completeness, request count, and deterministic item/byte ceilings.
- [ ] **P1: Preserve rate-limit metadata and enforce retries.** Acceptance: 429 and provider throttling produce structured
  reset evidence, bounded jittered backoff, attempt history, and a routable terminal outcome.
- [ ] **P1: Add provider-read evidence.** Acceptance: every attempt records source, operation digest, observed time,
  request/response digests, page/item counts, completeness, freshness, and provider request IDs when available.
- [ ] **P1: Unify binding identity.** Acceptance: compiler validates the full sealed binding, shared resources have one
  canonical reference, and changing a compatible operation retains selection.
- [ ] **P2: Improve summaries and correction focus.** Acceptance: card/outline show operation/resource/page policy and
  compiler issues focus Provider, Operation, Resource, or Query fields precisely.

## Dependencies And Open Decisions

Dependencies: shared expression/data picker; schema propagation; versioned provider manifests; broker response metadata;
retry scheduler; standard outcome ports; artifact/page strategy; canonical resource references.

Open decisions:

1. Should collection output always be an envelope, or should single-page operations expose arrays plus evidence?
2. Which operations default to first page versus bounded auto-pagination?
3. What are global and per-operation item, page, request, time, and byte budgets?
4. How long may cached or pinned provider data be treated as fresh?
5. Which provider response fields are normalized versus preserved under an expert raw view?
