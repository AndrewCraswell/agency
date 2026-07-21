# Compose Markdown node review

Status: Source-backed review

Last reviewed: 2026-07-20

This document distinguishes **Source fact** from **Recommendation**. It reviews the current implementation; it does
not claim that recommended behavior exists.

## Identity

| Property | Current value |
| --- | --- |
| Registry kind | `compose_markdown` |
| Registry order | 07 |
| Version and phase | Version 1, phase 3 |
| Category | `data` |
| Execution and mutation | `control`, `none` |
| Capability requirements | None |
| Registered label | Compose Markdown |

**Source fact:** Compose Markdown is a deterministic control node described as creating Markdown from a template and
workflow input. It requires a string `template`, accepts one generic object `values`, and outputs a strict Markdown
artifact reference with digest, size, producer, and classification.

## Intended job and mental model

This node should render a bounded Markdown document from declared upstream data and persist it as a retrievable,
immutable workflow artifact. A maker should read it as: "fill this document template using these typed values, preview
the result, store the exact bytes, and return a durable reference." It is a document-composition node, not n8n's
Markdown/HTML conversion operation and not Power Automate's generic Compose action.

## Current contract

### Configuration, placeholders, and ports

**Source fact:** Config requires `template: string`; the schema has no length constraint and permits additional config
properties. The editor seeds `# Report\n\n{{summary}}`. The single `values` input accepts any object. Placeholders match
`{{ path.to.value }}` using letters, digits, underscore, dot, and hyphen. Paths are dot-split; missing paths throw.
Strings render verbatim; all other JSON values render with `JSON.stringify`. There is no escaping, fallback, loop,
conditional, helper, schema declaration, or unresolved-placeholder mode.

The output contains only an artifact reference, not inline Markdown. Classification is always `internal`. Content is
limited after UTF-8 encoding to 65,536 bytes. No input-size, placeholder-count, render-time, secret-flow, or Markdown
dialect policy is declared.

### Compiler

**Source fact:** Shared compiler checks validate topology, port mapping, and generic config shape. It does not parse
placeholders, verify paths against upstream schemas, bound the template, preview rendered size, detect sensitive source
fields, or require an artifact backend. The execution package snapshots the generic input and strict artifact-reference
output, but the executor digest is metadata-derived rather than tied to the rendering algorithm.

### Executor and artifact write

**Source fact:** Execution requires activation/attempt provenance. It renders and byte-checks content, hashes the bytes,
derives a deterministic artifact ID from activation, ordinal, name, and hash, and attempts a write to
`workflow/{activation}/{ordinal}/{artifactId}.md` as `text/markdown`. The write is optional-chained:
`context.artifactStore?.write(...)`. Even when no store exists, the executor returns a valid-looking reference and emits
an artifact datum. When a store is supplied, local storage writes bytes; Azure storage uses immutable create semantics,
digest sidecars, and verification on reads.

## Authoring experience

**Source fact:** The specialized inspector is one multiline **Markdown template** field with the hint "Insert declared
values with {{path.to.value}}". There is no dynamic-content picker, autocomplete, syntax highlighting, missing-field
validation, sample values, rendered preview, byte estimate, classification choice, or sensitivity warning. The card
shows category and generic description, not template summary or output artifact metadata. Ports are handles without
visible labels.

Whole-draft testing starts a durable run and navigates to run detail. There is no isolated render, pinning, fixture, or
inline latest output. Editor tests cover the seeded template and editing text only.

## Runtime, persistence, artifacts, and evidence

**Source fact:** A successful attempt stores raw resolved input and the artifact reference output. `workflow_data`
stores a second artifact datum containing the same reference and digest. Run detail lists raw attempts and the datum
reference under **Data and artifacts**, but it does not load, preview, download, or verify the Markdown bytes. The
reference has no persisted relative path or artifact-store provider, and the run-detail API exposes no artifact content
endpoint in this reviewed surface.

Classification is fixed to `internal` even if interpolated values are sensitive. Inputs and rendered content can
therefore have different sensitivity without policy or evidence describing the transition.

## Representative behavior matrix

| Case | Current source-backed behavior | Judgment |
| --- | --- | --- |
| String placeholder | Inserts the raw string. | Basic deterministic case works. |
| Object/array/number/null | Inserts compact JSON text. | Deterministic but formatting is not configurable. |
| Missing path | Throws and dispatcher records generic `step_failed`. | Correct to avoid silent omission, but authoring cannot preflight it. |
| Placeholder-like text outside regex | Remains unchanged. | Silent unresolved token risk. |
| Empty template | Produces a zero-byte Markdown artifact. | Allowed; product intent undecided. |
| Exactly 65,536 UTF-8 bytes | Accepted. | Boundary is explicit at runtime. |
| More than 65,536 bytes | Fails before write. | Covered by executor test. |
| Missing execution provenance | Throws. | Covered by unit test; dispatcher always supplies provenance. |
| Missing artifact store | Returns reference and datum without writing bytes. | P0 evidence-integrity defect. |
| Store write failure | Dispatcher records step failure. | Good fail behavior when a store exists. |
| Retry | New attempt ordinal produces a different artifact ID/path even for identical bytes. | Preserves attempt provenance; may duplicate storage intentionally. |
| Sensitive value | Artifact still classified `internal`. | P0 information-governance defect. |
| Timeout | No intrinsic timeout; rendering is synchronous and bounded only by final bytes. | Add input/template bounds rather than a user timeout. |

## Validation, tests, and gaps

**Source fact:** Executor tests cover successful rendering/write, provenance requirement, and 65,537-byte rejection.
Artifact-store tests cover local/Azure writes, immutable conflict behavior, and digest verification. Registry tests do not
assert Compose UI metadata. Editor tests cover basic authoring. Generic journal tests establish artifact datum storage,
but there is no end-to-end Compose artifact retrieval test.

Missing tests include exact 65,536-byte behavior, UTF-8 multibyte accounting, missing/nested paths, null and object
formatting, unresolved nonmatching tokens, absent store, store failure through the dispatcher, retry identity, sensitive
classification, compiler placeholder checks, rendered preview parity, artifact download, and accessible editor use.

## Expert judgments

### Competitive Expert

n8n's Markdown node converts Markdown and HTML, offers explicit modes, destination keys, parser options, and recommends
testing option interactions. Power Automate Compose accepts expressions/dynamic content and makes its output directly
selectable downstream. Make Text Aggregator is closer when composing many bundles, while its mapping model makes source
data selection visible. Agency appropriately differs by producing a durable artifact with provenance, but it currently
lacks the competitors' discoverable data insertion and preview, and its optional persistence breaks the value of its
stronger artifact contract.

### UX Expert

A raw textarea plus a syntax hint is too little for a document node. Users cannot discover available fields or see
whether JSON insertion, Markdown characters, or missing data will produce the desired document. A split editor/preview
with field insertion, issue markers, and size/classification status would make the node understandable without exposing
storage internals.

### User Researcher

Users will trust the artifact reference because it contains a hash and producer IDs. Returning that reference when no
bytes were stored is therefore worse than a visible failure. Fixed `internal` classification also creates false
assurance when a document includes secrets or personal data. Operators need to open the exact artifact from run detail
and verify its provenance without finding a filesystem path.

## Findings

### P0

1. **A successful node can reference nonexistent bytes.** Evidence: artifact write is optional, while reference and
   datum are always returned. Impact: downstream consumers and audit evidence can point to an artifact that never
   existed.
2. **Classification ignores source sensitivity.** Evidence: every reference is `internal`. Impact: sensitive rendered
   data can be mislabeled, exposed, or retained under the wrong policy.

### P1

1. **Placeholder validity is runtime-only.** Evidence: compiler does not parse or schema-check placeholders. Impact:
   simple authoring mistakes consume a full run and fail generically.
2. **No preview or dynamic-content picker.** Evidence: inspector is a textarea and hint only. Impact: users cannot
   predict output, formatting, or byte limits.
3. **Evidence cannot retrieve or display the artifact.** Evidence: run detail shows reference JSON only. Impact:
   operators cannot inspect the document the run produced.
4. **Template/runtime contract is underspecified.** Evidence: implicit regex, raw string insertion, JSON stringification,
   no escaping/dialect declaration. Impact: extensions or executor changes can silently alter documents.

### P2

1. **Card summary omits document and size state.** Impact: nodes are hard to distinguish on a canvas.
2. **No artifact name/filename or media policy.** Impact: downstream downloads and multiple document composition are
   less usable.

## Recommended target contract, UI, testing, evidence, and safe defaults

**Recommendation:** Keep Compose Markdown as a deterministic artifact producer with one canonical, versioned template
expression grammar shared across nodes. Bind placeholders to propagated input schemas, support explicit missing-value
policy (`fail` by default, optionally fallback), and define rendering for every JSON type. Require an artifact store and
confirm the write before committing output. Include immutable locator/store metadata in protected persistence while
keeping portable references free of environment secrets.

The inspector should combine a Markdown editor, schema-aware field insertion, sample input, rendered preview, unresolved
field list, UTF-8 byte estimate, classification control/inference, and artifact name. The card should summarize artifact
name, classification, and template field count. The run view should render sanitized Markdown, provide verified
download, and show hash, bytes, producer attempt, classification, and source lineage.

Safe defaults: fail on unresolved values, maximum 64 KiB rendered bytes, bounded template/input and placeholder count,
GitHub-flavored Markdown declaration if that is the product dialect, no raw HTML rendering in UI, classification at
least as restrictive as inputs, immutable writes, and no automatic retry unless storage failure is classified
transient.

## Fix checklist

- [ ] **P0: Require successful artifact persistence before returning.** Acceptance: absent/unready store and failed
  write fail the attempt; no datum/reference is committed; an end-to-end test reads and verifies exact bytes.
- [ ] **P0: Implement sensitivity propagation.** Acceptance: classification cannot be less restrictive than selected
  inputs without an authorized downgrade; run evidence records the decision; sensitive fixtures stay redacted.
- [ ] **P1: Version and validate the template grammar.** Acceptance: compiler identifies missing fields and malformed or
  unresolved placeholders with source locations; runtime and preview use the same renderer and fixtures.
- [ ] **P1: Add a schema-aware editor and preview.** Acceptance: users can insert fields without typing paths, preview
  sample output, see byte count/limit and unresolved values, and operate all controls by keyboard.
- [ ] **P1: Add artifact retrieval and verified run evidence.** Acceptance: authorized users can preview/download the
  exact bytes from run detail; hash, size, media type, producer, classification, and store verification are visible.
- [ ] **P1: Expand focused tests.** Acceptance: string/JSON/null, missing fields, Unicode boundary, empty document,
  absent/failing store, retry, classification, sanitization, and retrieval cases cover compiler through journal.
- [ ] **P2: Add artifact naming and card summary.** Acceptance: a bounded filename is authorable and the card/outline show
  immutable node type, artifact name, classification, and latest test status.

## Dependencies and open decisions

- Shared expression/data picker, schema propagation, sample fixtures, and sensitivity metadata.
- Artifact content API, authorization, retention, redaction, preview sanitization, and verified download.
- Executable-semantics pinning rather than metadata-only executor digest.
- Decision: Markdown dialect and whether raw HTML is allowed, escaped, or stripped.
- Decision: missing/null formatting and explicit fallback syntax.
- Decision: automatic sensitivity inference versus mandatory author selection.
- Decision: one fixed `markdown` artifact per attempt or authorable names/multiple documents.
- Decision: local artifact storage durability expectations outside Azure deployments.

## Source inventory

- `apps/agentic/src/workflows/stepRegistry.ts`
- `apps/agentic/src/workflows/compiler.ts`
- `apps/agentic/src/workflows/workflowExecutor.ts`
- `apps/agentic/src/workflows/executionContracts.ts`
- `apps/agentic/src/prototype/artifacts.ts`
- `apps/agentic/src/azure/artifactStore.ts`
- `apps/agentic/src/persistence/workflowJournalStore.ts`
- `apps/agentic/src/persistence/schema.ts`
- `apps/web/src/routes/WorkflowEditorPage.tsx`
- `apps/web/src/routes/WorkflowEditorInspector.tsx`
- `apps/web/src/routes/RunDetailPage.tsx`
- Relevant registry, executor, artifact-store, journal, editor, and run-detail tests
- n8n Markdown documentation; Make aggregator/text-aggregator documentation available at review time; Microsoft Power
  Automate Compose and data-operation documentation