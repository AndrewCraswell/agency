# AI Model Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Kind | `ai_model` |
| Version and phase | Version 1, Phase 5 |
| Category | AI |
| Execution class | Model |
| Mutation policy | None |
| Capability | `model.inference` |
| Registry ports | Optional `context` object in; required `response` object out |
| Output modes | Text, Markdown artifact, structured JSON |

The node is a bounded OpenRouter chat-completion primitive with prompt templates, model catalog snapshots, structured
output, Markdown artifacts, usage, and provider evidence. The public port remains an open object even though each mode
has a different stable envelope.

Primary evidence: [modelExecutor.ts](../../../../src/workflows/modelExecutor.ts),
[modelCatalog.ts](../../../../src/workflows/modelCatalog.ts), and
[WorkflowEditorInspector.tsx](../../../../../web/src/routes/WorkflowEditorInspector.tsx).

## Job and mental model

The intended job is: transform optional workflow context into one model response under a declared prompt, output
contract, model snapshot, parameter set, deadline, and spend bound. Authors should be able to preview exactly what is
sent, know what can be returned, and test without accidental live spend.

Today the prompt editor is usable, but the node hides the rendered prompt, full parameter contract, timeout, provider
routing uncertainty, retry spend, and mode-specific output schema. Catalog snapshotting supports auditability but does
not make an OpenRouter model ID deterministic.

## Current contract

### Configuration

The registry requires `modelId`, `messages`, and `outputMode`. The strict executor also accepts `outputSchema`,
`parameters`, and `timeoutMs`, which the registry does not declare. It permits 1-64 system/developer/user messages and a
combined rendered prompt of at most 262,144 bytes. Timeout defaults to 120 seconds and is bounded to 1-300 seconds.

Supported parameters include sampling, penalties, seed, completion limit, stop strings, log probabilities, reasoning,
and verbosity. The compiler rejects configured parameters not advertised by the selected catalog snapshot and checks
`response_format` support for AI model structured mode. The editor exposes only temperature and maximum completion
tokens.

Default editor config selects no model, uses a careful-assistant system message and `{{context}}` user message, text
output, temperature 0.2, and 2,000 maximum completion tokens. Executor defaults are otherwise empty parameters, so
defaults are owned by the editor rather than the manifest.

### Prompt and output contracts

Templates support `{{path.to.value}}`; missing paths fail with `model_prompt_binding`, strings render directly, and other
JSON values are serialized. There is no escaping mode, optional binding, fallback, type declaration, field picker, or
stored rendered-prompt digest.

| Mode | Current response | Additional behavior |
| --- | --- | --- |
| Text | `{ mode: "text", text }` | Inline response, at most 262,144 bytes |
| Markdown | `{ mode: "markdown", artifact }` | Writes a Markdown artifact and emits a workflow artifact datum |
| Structured | `{ mode: "structured", value }` | Sends strict JSON Schema, parses JSON, and validates locally |

The registry output schema is only `object`, so downstream authoring cannot discover these envelopes or the configured
structured schema. Refusal, truncation, empty output, invalid JSON, schema mismatch, prompt/output size, timeout, and
provider failure are execution errors rather than authorable outcomes.

### Retry and cost

The executor tries at most twice. It retries 429, 5xx, network failures, and timeouts immediately, without backoff or a
recorded retry count. It sends no inference idempotency key; a lost response can therefore incur duplicate cost. Each
try receives the full configured timeout, so total elapsed time can exceed the displayed/default node timeout concept.
Workflow `maximumAttempts` is not an automatic retry mechanism.

Actual usage records input, cached input, output, total tokens, and estimated USD cost using the publication snapshot's
prices. If the provider omits usage, every count and estimated cost becomes zero, which looks authoritative even though
cost is unknown. Failed calls persist no usage/cost evidence.

## Authoring experience

The inspector loads catalog models, shows name/ID, context length and observation date, edits ordered messages, inserts
`{{context}}`, estimates prompt tokens as characters divided by four, selects output mode, edits/generates a structured
schema, and exposes temperature/max tokens. Schema generation is itself a live charged OpenRouter call; the dialog does
warn the author before generation.

Missing authoring features include upstream field insertion, rendered preview, binding validation, prompt/output token
and USD range, supported-parameter controls, timeout, retry policy, seed, provider/routing policy, fixtures/mocks, and
isolated node testing. The estimate uses template characters rather than rendered input and excludes completion cost.

The card shows editable title, AI category, generic description, and unlabeled handles. It does not show immutable type,
model, mode, token cap, estimated spend, or live-call status. Registry `ui.fields` is empty, while defaults and the
inspector are hard-coded in the web app.

## Runtime, persistence, artifacts, and provenance

Validation, publication, and draft test resolve each model ID from the current OpenRouter catalog and seal model name,
context length, prices, modalities, supported parameters, and observation time in the execution package. The executor
requires that snapshot and records requested model, provider-resolved model, catalog observation time, effective
parameters, output mode, finish reason, request ID, and elapsed time.

This is useful provenance, but it does not pin model weights, provider route, OpenRouter behavior, or sampling result.
The executor digest identifies registry metadata, not executable code. A seed is available but not exposed and may not
guarantee provider reproducibility. Prompt content is persisted in step config and input in attempt records, but the
exact rendered messages, their digest, response digest, retry history, HTTP/provider route, and failed-call usage are
not retained as structured evidence.

Markdown persistence is fail-open when no artifact store is configured: optional chaining skips the write but still
returns and journals an artifact reference. Production wiring supplies a store, yet the executor contract itself can
claim an artifact exists when it does not. Text and structured outputs remain inline; classification is always internal
for Markdown and is not author-selectable.

Run detail exposes attempt input/output/error/usage/evidence and common artifact data. It has no purpose-built rendered
prompt, cost, model, or refusal view, and no inline retry action scoped by model failure type.

## Validation, tests, and gaps

Executor tests use provider-shaped fetch mocks and cover structured output, Markdown artifact writes, judgment dispatch,
missing usage, missing snapshots/schema, schema failures, prompt/output bounds, empty output, artifact-write failure,
timeout, abort/network errors, and HTTP retry behavior. Compiler/service tests cover snapshot pinning, deduplication,
supported parameters, and structured-output capability. Editor tests cover model selection, prompts, context insertion,
mode selection, schema validation/generation, and guided parameters.

Important gaps:

- no manifest drift test covering executor-only fields and UI defaults;
- no prompt-binding fixture suite for escaping, arrays/null, missing optional fields, or injection boundaries;
- no cost ceiling, unknown-usage, failed-call usage, retry-cost, or context-window preflight tests;
- no deterministic recorded provider fixture or mock mode selectable by authors;
- no artifact-store-absent assertion that requires failure;
- no replay/reproducibility test that distinguishes catalog pinning from output determinism;
- no browser evidence for rendered prompt, live-call confirmation, evidence inspection, or error recovery.

Per the documentation-only task, no tests or browser verification were run for this review.

## Behavior matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid text | Returns inline text and usage/evidence | Typed Text output with prompt/response digests and cost evidence |
| Valid Markdown | Writes and references artifact when store exists | Fail closed without durable store; preview and classification are explicit |
| Valid structured | Provider strict schema plus local validation | Propagate configured schema to the output port and field picker |
| Empty optional context | `{{context}}` renders the resolved input object | Preview exact rendered value and validate declared context schema |
| Missing binding | Fails during execution | Flag inline before save/test and offer optional/default binding semantics |
| Prompt over bound | Fails after rendering | Preflight bytes/tokens/context window using sample or pinned input |
| Refusal | Fails with `model_refusal` | Routable Refused outcome with safe provider text and usage |
| Truncation | Fails with `model_truncated` | Routable Incomplete outcome or bounded policy-driven retry |
| Invalid structured result | Fails local validation | Preserve raw sanitized response artifact and schema issues for diagnosis |
| 429/5xx/network | Retries once immediately | Declared backoff/retry budget with attempt and cost evidence |
| Timeout | Up to two full timeout attempts | One total node deadline with per-try budget and Timeout outcome |
| Missing usage | Records zero cost | Record unknown usage/cost and provider billing provenance |
| Operator retry | New nondeterministic completion and spend | Show cost/routing impact; optionally use a pinned fixture in tests |

## Expert judgments

### Competitive Expert

n8n and Make offer model operations with expression insertion and credentials; Power Automate AI actions emphasize
dynamic content and governed connectors. Agency already has stronger package snapshots and durable usage evidence. It
should differentiate through typed mode-specific outputs, durable prompt/cost provenance, and safe fixtures rather than
copying connector-style untyped message fields.

### UX Expert

The prompt workbench needs a field picker and rendered preview as its primary interaction. Model, output mode, and cost
cap should remain visible while editing. Advanced should contain only parameters the selected snapshot supports. The
card should summarize model, mode, maximum output, estimated cost, and latest test status.

### User Researcher

Users need to know what data left the system, which model/provider answered, what it cost, whether a retry was charged,
and whether a test was real. Catalog observation time is useful but insufficient for reproducibility. Fixture-backed
tests, prompt redaction, and explicit unknown cost are trust requirements.

## Findings

### P0

1. **The canonical contract is split.** Registry omits output schema, parameters, timeout, defaults, and mode-specific
   outputs. Consolidate these in one manifest used by compiler, editor, executor, and tests.
2. **Retry and timeout semantics can duplicate spend without durable evidence.** Enforce one total deadline, bounded
   backoff, request identity where supported, and per-try usage/outcome records.
3. **Markdown can claim a nonexistent artifact.** Require durable persistence before returning a reference.
4. **Cost can be falsely reported as zero.** Treat absent provider usage/pricing as unknown and retain failed-call cost
   evidence where available.

### P1

1. Add schema-aware prompt bindings, rendered preview/digest, context-window validation, and mode-specific output ports.
2. Add cost/spend preflight and a configurable maximum input/output token or USD budget.
3. Add routable Refused, Incomplete, Timeout, Rate limited, and Provider error outcomes with safe diagnostics.
4. Pin executable implementation and record provider routing/retry provenance without retaining unnecessary prompt data.
5. Add deterministic fixtures/mocks and make live tests explicitly paid.

### P2

1. Expose supported parameter controls, presets, and side-by-side output previews.
2. Add prompt/version comparison and reusable prompt components.
3. Show latest duration, tokens, cost, mode, and model on the card/outline.

## Target design

### Ports and configuration

- Input: typed optional `context`, with field-level bindings and declared sensitivity.
- Outputs: discriminated Text, Markdown artifact, or configured Structured value; expected outcomes for Refused,
  Incomplete, and Timeout; standard `error` for infrastructure faults.
- Basic config: model, messages, output mode/schema, maximum output tokens, total deadline, and maximum estimated spend.
- Advanced config: only catalog-supported sampling/reasoning/log fields, provider routing policy, retry/backoff, seed,
  artifact classification, and prompt retention/redaction.

### Card and inspector

The card retains `AI model`, selected model, output mode, token/spend cap, live-call badge, and labeled outcomes. The
inspector includes upstream field insertion, sample/pinned inputs, exact rendered preview, token/context/cost estimate,
schema output preview, supported parameters, and latest prompt/output/error/artifact/usage/evidence tabs.

### Testing, evidence, and safe defaults

- Default node tests to a pinned fixture with zero external calls. Live test requires explicit confirmation and displays
  estimated maximum cost.
- Default to bounded temperature/max tokens, one total deadline, no automatic retry unless declared, and a per-node
  spend ceiling.
- Persist package/model snapshot, executor digest, rendered-prompt digest, response digest, requested/resolved model,
  provider request ID/route, each try, finish/refusal state, usage, known/unknown cost, timing, and artifact status.
- Retain prompt content only under a declared redaction/classification policy.

## Fix checklist

- [ ] Define the complete model config and output union in the canonical manifest.
  Acceptance: no executor/UI-only fields or defaults remain, and downstream schema follows selected mode/schema.
- [ ] Build schema-aware binding and rendered prompt preflight.
  Acceptance: missing fields, prompt bytes, context tokens, and output budget are validated before a live call.
- [ ] Enforce total deadline, retry/backoff, and spend policy.
  Acceptance: deterministic 429, 5xx, timeout, lost-response, and exhausted-budget tests show every try and cost state.
- [ ] Fail closed for Markdown persistence.
  Acceptance: no artifact reference is committed unless write and manifest registration succeed.
- [ ] Represent unknown usage/cost truthfully.
  Acceptance: absent usage or invalid pricing produces `unknown`, never numeric zero, in API and run detail.
- [ ] Add typed expected outcomes and recovery.
  Acceptance: refusal, truncation, timeout, rate limit, provider failure, invalid JSON, and schema mismatch are distinct and
  only policy-approved outcomes are routable/retryable.
- [ ] Add fixture/mock and paid live-test modes.
  Acceptance: fixture tests make no HTTP call and are reproducible; live tests show estimated cap and durable provenance.
- [ ] Pin and display execution provenance.
  Acceptance: run detail identifies executable build, catalog snapshot, requested/resolved model, retries, prompt/response
  digests, timing, and usage/cost with redaction policy.
- [ ] Complete browser and accessibility acceptance.
  Acceptance: desktop/mobile keyboard users can author, preview, test, inspect evidence, and recover without raw JSON.

## Shared dependencies and open decisions

Shared dependencies: canonical manifests, schema propagation, common expressions/data picker, standard outcomes,
retry/timeout enforcement, cost policy, fixture framework, artifact guarantees, executable digests, and evidence views.

Open decisions:

- Is a model ID plus resolved provider sufficient provenance, or must workflows pin a provider/route where available?
- Which prompt/input content is persisted, hashed, redacted, or omitted for sensitive workflows?
- Are refusal and truncation expected outcomes by default or execution faults unless explicitly enabled?
- Is the spend ceiling denominated in tokens, USD, or both, and how does unknown pricing behave?
- Should internal provider retry be disabled by default in favor of durable workflow attempts?