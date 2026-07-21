# Collect node review

Status: Source-backed review

Last reviewed: 2026-07-20

This document distinguishes **Source fact** from **Recommendation**. It reviews the current implementation; it does
not claim that recommended behavior exists.

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `collect` |
| Registry order | 08 |
| Version and phase | Version 1, phase 3 |
| Category | `data` |
| Execution and mutation | `control`, `none` |
| Capability requirements | None |
| Registered label | Collect |

**Source fact:** Collect is registered as a deterministic data node that "Collects parallel results in source order."
It accepts a `many` object input named `items` and returns `collection` as array or object. Config can contain `mode`,
`keyField`, and `maximumItems`; none is required by the registry schema.

## Intended job and mental model

Collect should form one bounded collection from multiple contributions at a synchronization point. A maker should read
it as: "wait for the declared contributors, preserve a visible deterministic order, validate a common item shape, then
return either an array or a keyed object under an explicit duplicate policy." It should not make users infer scheduler
or binding-key internals.

Collect is aggregation, while Join is synchronization policy. Their boundary must be explicit: Collect currently has a
many input but readiness still uses generic incoming dependency counts, so it effectively does both for ordinary graph
paths without exposing that distinction.

## Current contract

### Configuration and defaults

**Source fact:** `mode` may be `array` or `keyed`; any value other than exact `keyed`, including omission, executes as
array. In keyed mode, `keyField` is a required-at-runtime nonblank top-level field name. `maximumItems` defaults in the
executor to 1,000. The add-node UI explicitly creates `{ mode: "array", maximumItems: 100 }`, and the inspector displays
100 when the value is absent. Thus UI-created, displayed, and runtime defaults are not one contract.

Input cardinality `many` wraps each object contribution into an array. Output is statically union-typed array/object;
the compiler narrows it to object only when `mode === "keyed"`, otherwise array. There is no item schema, nested key
path, grouping, flattening, include/exclude fields, empty-input policy, duplicate policy, null policy, ordering config,
or collection byte bound.

### Compiler and contribution readiness

**Source fact:** Shared compiler checks allow multiple connections only because `items` is `many`, validate mapping
compatibility against a generic object item, and narrow the output's top-level shape from mode. It does not require an
incoming contribution, require `keyField` in keyed mode, validate that the key exists/is scalar, detect duplicate keys,
name contributors, or define order.

Generic scheduling sets a target activation's dependency count from incoming connections and merges contribution
bindings as predecessors complete. Collect becomes ready after all ordinary incoming success connections contribute.
Failed or never-activated branches have no Collect-specific completion policy; failure-route enforcement is absent.

### Executor and ordering

**Source fact:** `resolveActivationInput` sorts incoming connections lexicographically by connection ID. Within each
connection it sorts stored binding keys lexicographically; item scopes use zero-padded indexes. It concatenates those
contributions into `items`. Array mode returns them unchanged. Keyed mode parses every item as an object, reads only
`object[keyField]`, accepts string or number keys, converts keys with `String`, and calls `Object.fromEntries`.

Duplicate keys silently keep the last item. Numeric `1` and string `"1"` collide. JavaScript object property ordering
can also reorder integer-like keys, so keyed output cannot preserve the claimed source order in all cases. The maximum
counts items but not total bytes.

## Authoring experience

**Source fact:** The inspector offers **Collection mode**, conditional text **Key field**, and numeric **Maximum items**.
The mode labels are **Ordered array** and **Keyed object**. Key field is free text with no upstream schema picker. The
node card shows no contributor count, order, key, limit, output shape, or waiting state, and graph handles have no
visible labels/cardinality. The outline sorts graph traversal by connection metadata but does not explain collection
order.

There is no isolated test, pinned sample, collection preview, duplicate warning, item schema, or latest output in the
inspector. Whole-draft tests navigate to generic run details.

## Runtime, persistence, and evidence

**Source fact:** The successful attempt stores raw input bindings and resolved output collection. No separate datum,
ordering manifest, contributor identity list, duplicate report, truncation record, usage, or evidence is emitted. Run
Diagnostics shows raw input/output JSON and activation scope. For loop contributions, zero-padded item scope keys can
be inspected, but the final collection does not retain item provenance.

If collection fails, the dispatcher records generic `step_failed`; run summary supports generic retry. There is no
partial collection or resumable recovery policy. Re-execution recomputes from persisted activation bindings.

## Representative behavior matrix

| Case | Current source-backed behavior | Judgment |
| --- | --- | --- |
| Two array items | Returns both in resolved binding order. | Basic case works; order is internal, not author-visible. |
| Empty `items: []` at direct execution | Returns `[]` or `{}` in keyed mode. | Executor supports it, but graph activation with no incoming edge is a separate topology issue. |
| Omitted mode | Executes/narrows as array. | Implicit default. |
| Omitted maximum | Runtime permits 1,000; inspector displays 100. | P1 contract drift. |
| At maximum | Accepted. | Item-count bound works. |
| Over maximum | Throws with actual and maximum counts. | Covered by tests. |
| Keyed scalar string/number | Builds object with stringified key. | Basic keyed case works. |
| Missing/object/boolean key | Throws. | Runtime-only validation; boolean is rejected. |
| Duplicate keys | Last item silently overwrites earlier item. | P0 data-loss defect. |
| Numeric/string equivalent keys | Collide after string conversion. | P0 data-loss defect. |
| Nested key path | Not supported; key field is top-level literal. | Major discoverability/expressiveness gap. |
| Parallel completion order changes | Binding IDs, not completion time, determine result. | Deterministic, but "source order" is undefined in UI. |
| Integer-like keyed order | JavaScript object enumeration may reorder keys. | Contradicts ordered mental model. |
| Upstream failure/missing branch | No explicit skip/fail/partial policy; generic graph can leave target blocked or run fail. | P0 orchestration ambiguity. |
| Retry/lease recovery | Generic retry recomputes from persisted bindings. | No dedicated partial recovery or provenance evidence. |
| Timeout | No node timeout or wait deadline. | A stalled contributor can leave aggregation unresolved. |

## Validation, tests, and gaps

**Source fact:** Executor tests cover array output, keyed output, maximum overflow, and a nonscalar key. Registry tests
assert maximum metadata. Compiler tests exercise shared many-cardinality and top-level output narrowing indirectly.
Editor tests cover initial array mode, 100-item UI default, switching to keyed, and key-field visibility. Loop/join tests
cover scoped binding ordering in adjacent orchestration code.

Missing tests include duplicate/stringified collisions, deterministic multi-connection order, integer-like key order,
omitted/default config parity, zero and no-contributor behavior, nested keys, byte-size limits, upstream failure or
cancelled branch, late contribution after readiness, lease recovery, partial evidence, schema propagation, preview,
and keyboard/accessibility behavior.

## Expert judgments

### Competitive Expert

n8n Aggregate makes the aggregation target explicit: individual fields or all item data, output field, inclusion rules,
dot notation, list merge, binaries, and missing/null behavior. Make aggregators center a source module, target structure,
grouping, and the fact that bundles between source and aggregator are not available afterward. Power Automate usually
works from one explicit array, with Select to shape it and Join to delimit it, using dynamic content. Agency's many-port
aggregation is powerful for durable branches and loop scopes, but it needs an equally visible source/contributor model,
item schema, and completion policy. Silent keyed overwrite is below all three products' least-surprise bar.

### UX Expert

"Ordered array" claims a guarantee without showing the order. A user sees several unlabeled wires converging and a
free-text key field. The inspector should list contributors in draggable or graph-defined order, show an item specimen,
and present duplicate and empty policies alongside a live result preview.

### User Researcher

Silent loss is the dominant trust issue: duplicate keys produce a plausible object with missing items and no warning.
Users also cannot trace a result item back to its branch or loop iteration in run detail. Limits are helpful, but a
1,000-item array can still contain an unbounded payload and surprise storage or downstream model cost.

## Findings

### P0

1. **Keyed mode silently overwrites duplicates.** Evidence: `Object.fromEntries` receives unvalidated duplicate keys.
   Impact: irreversible, invisible data loss, including number/string collisions.
2. **Contributor completion/failure semantics are undefined.** Evidence: Collect relies on generic dependency counts and
   has no failed, skipped, cancelled, late, or partial policy. Impact: parallel workflows can block, fail, or omit work
   without an author-visible contract.
3. **"Source order" is not a product-level order.** Evidence: runtime sorts connection and scoped binding IDs; keyed
   objects can reorder integer-like keys. Impact: users cannot predict or audit ordering.

### P1

1. **Defaults disagree.** Evidence: add/inspector use 100 while executor defaults to 1,000 and schema requires neither
   mode nor maximum. Impact: visually identical definitions can have different limits.
2. **Key and item contracts are runtime-only.** Evidence: free-text top-level key and generic object item schema. Impact:
   authoring errors and heterogeneous collections fail late.
3. **No collection-size bound beyond item count.** Evidence: each JSON item can be large. Impact: journal growth and
   downstream cost remain unbounded.
4. **Evidence loses contributor lineage.** Evidence: only raw final collection is stored. Impact: operators cannot
   explain missing, duplicated, or reordered items.

### P2

1. **Card/outline lack aggregation summary.** Impact: parallel graphs are difficult to scan.
2. **No common aggregation options.** Impact: users add extra nodes for field selection, grouping, flattening, and null
   handling, while still lacking a preview.

## Recommended target contract, UI, testing, evidence, and safe defaults

**Recommendation:** Separate collection shape from synchronization policy while presenting them together coherently.
Define contributors from visible incoming edges or a managed loop boundary, give each contributor a stable display
name/order, and require an item schema. Array mode returns items in declared contributor order and loop-index order.
Keyed mode uses a schema-aware key expression and requires an explicit duplicate policy: **Fail** (default), **Keep
first**, **Keep last**, or **Group into array**.

Define empty and incomplete behavior: fail on required contributor failure by default; allow explicitly configured skip
or collect-errors output; support a bounded wait deadline where branches can remain unresolved. Late contributions
after terminal aggregation must be rejected or start a new scoped aggregation, never mutate committed output.

The inspector should show contributor list/order, item schema and sample, mode, key picker, duplicate/null/empty/failure
policies, item and byte limits, and output preview. The card should summarize contributor count, mode/key, limits, and
waiting progress. Run evidence should include contributor activation/attempt IDs, selected ordering keys, duplicate
decisions, omitted/errors count, final item/byte count, and collection digest.

Safe defaults: array mode, explicit 100-item maximum in the canonical manifest, bounded serialized bytes, graph-defined
deterministic order, fail on duplicates, fail on required contributor error, preserve nulls unless configured, and no
partial result without an explicit policy.

## Fix checklist

- [ ] **P0: Add explicit duplicate-key policy.** Acceptance: default rejects duplicates and number/string collisions
  with item indexes and key; first/last/group modes are deterministic and covered by tests.
- [ ] **P0: Define durable contributor completion policy.** Acceptance: success, failed, skipped, cancelled, late,
  timeout, retry, and lease-recovery cases have documented and tested outcomes; committed collection is immutable.
- [ ] **P0: Make order author-visible and executable.** Acceptance: canvas/inspector show the exact contributor order;
  loop indexes sort numerically; runtime evidence records it; integer-like keyed output does not claim sequence order.
- [ ] **P1: Unify defaults in the authoritative manifest.** Acceptance: new, omitted, imported, compiled, displayed, and
  executed config all use explicit array mode and the same 100-item limit.
- [ ] **P1: Add item schema and key expression picker.** Acceptance: upstream schemas drive a typed specimen and nested
  key selection; incompatible contributors and nonscalar keys fail validation before run.
- [ ] **P1: Add serialized-byte and contribution bounds.** Acceptance: preflight estimates and runtime enforce both item
  and byte limits with actionable errors and exact boundary tests.
- [ ] **P1: Persist aggregation evidence.** Acceptance: run detail lists each contributor and provenance, ordering,
  duplicate/null decisions, omissions/errors, count, bytes, and digest without reverse-engineering binding IDs.
- [ ] **P1: Add isolated preview/testing.** Acceptance: sample contributions produce a preview for array/keyed modes and
  expose empty, duplicate, invalid-key, and failure-policy behavior with keyboard-accessible controls.
- [ ] **P2: Improve card and outline summaries.** Acceptance: immutable Collect identity, contributor count, mode/key,
  limits, waiting progress, and latest test status are scannable.

## Dependencies and open decisions

- Shared schema propagation, expression/data picker, sample fixtures, and labeled cardinality-aware ports.
- Durable Join/For each semantics for contributor completion, late arrivals, cancellation, and scope recovery.
- Standard expected-error routing and collect-errors envelope.
- Decision: whether Collect remains a standalone synchronization point or only shapes an already-completed Join result.
- Decision: canonical ordering source for arbitrary parallel branches and whether authors can reorder it.
- Decision: default byte limit and whether large collections spill to artifacts instead of attempt JSON.
- Decision: keyed output as JSON object, ordered entry array, or both.
- Decision: behavior for null/missing items and failed optional contributors.

## Source inventory

- `apps/agentic/src/workflows/stepRegistry.ts`
- `apps/agentic/src/workflows/definition.ts`
- `apps/agentic/src/workflows/compiler.ts`
- `apps/agentic/src/workflows/workflowExecutor.ts`
- `apps/agentic/src/persistence/workflowJournalStore.ts`
- `apps/agentic/src/persistence/schema.ts`
- `apps/web/src/routes/WorkflowEditorPage.tsx`
- `apps/web/src/routes/WorkflowEditorInspector.tsx`
- `apps/web/src/routes/WorkflowEditorOutline.utils.ts`
- `apps/web/src/routes/RunDetailPage.tsx`
- Relevant registry, compiler, executor, journal, editor, outline, and run-detail tests
- n8n Aggregate documentation; Make aggregator documentation available at review time; Microsoft Power Automate
  Compose, Select, Join, and data-operation documentation