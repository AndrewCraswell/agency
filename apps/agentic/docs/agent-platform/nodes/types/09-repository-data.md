# Repository Data Node Review

Status: Design review

Last reviewed: 2026-07-20

## Identity

| Property | Current value |
| --- | --- |
| Kind | `repository_data` |
| Version and phase | Version 1, Phase 4 |
| Category | Data |
| Execution class | Provider |
| Mutation policy | None |
| Capability | `repository.read` |
| Registry ports | Optional `query` object in; required `result` object out |
| Registered error | Generic `{ code, message, retryable? }` object |

The registry describes one generic read node, while the executor implements nine GitHub-specific operations: metadata,
file content, commit, code search, pull request, pull request files, checks, reviews, and comments. The registry contract
and card do not expose those operation-specific request and response shapes.

Primary evidence: [stepRegistry.ts](../../../../src/workflows/stepRegistry.ts),
[repositoryDataExecutor.ts](../../../../src/workflows/repositoryDataExecutor.ts), and
[WorkflowEditorInspector.tsx](../../../../../web/src/routes/WorkflowEditorInspector.tsx).

## Job and mental model

The intended job is: read a bounded, validated fact or content item from the workflow repository without changing the
repository. Authors should be able to think of it as a typed repository query, not as an untyped GitHub REST request.

That mental model currently breaks in three places. The selected operation changes what `query` must contain without
changing the visible port contract; a configured branch such as `main` can move between runs; and `repository_data`
overlaps GitHub reads offered by `provider_data` without a stated ownership rule. The useful product distinction would
be repository-native content and revision operations here, with general integration records in Provider data.

## Current contract

### Configuration and operation shapes

The registry requires `operation` and a repository object, but declares `operation` as any string and the repository as
an open object. The executor applies a stricter schema with `owner`, `name`, and a nonblank `ref` defaulting to `HEAD`.
The editor instead creates `ref: "main"`, copies owner/name from the workflow repository, and offers a fixed operation
dropdown.

| Operation | Runtime query | Runtime result and bound |
| --- | --- | --- |
| `metadata` | None | Provider-neutral metadata object |
| `file_content` | Required `path`; optional `ref` | UTF-8 content and blob SHA; at most 65,536 bytes |
| `commit` | Optional `ref` | SHA, message, author, URL |
| `code_search` | Required `text`; optional `maximumItems` | Up to 100 items; default 25; provider `incomplete` flag retained |
| `pull_request` | Required positive `pullRequestNumber` | GitHub pull-request object |
| `pull_request_files` | Required positive `pullRequestNumber` | First page, at most 100 files; each patch at most 65,536 bytes |
| `reviews` | Required positive `pullRequestNumber` | First page, at most 100 reviews |
| `comments` | Required positive `pullRequestNumber` | First page, at most 100 issue comments |
| `checks` | Accidentally requires `pullRequestNumber`; optional `ref` | First page, at most 100 check runs for the ref |

`checks` parses `pullRequestNumber` before choosing its ref even though the value is unused. This is a concrete contract
defect: the operation cannot run with the ref-only query its implementation otherwise implies.

### Ports and failure semantics

Both ports use open object schemas. Missing operation fields, invalid bounds, malformed provider responses, byte-count
mismatches, HTTP failures, and unavailable execution all fail the attempt. The dispatcher preserves a typed code only
for model and provider-catalog errors; repository-data failures become generic `step_failed`. There are no Not found,
Rate limited, or Incomplete outcomes and no operation-specific output schema for downstream mapping.

The reader performs one request with no timeout, retry, backoff, or cancellation signal. Workflow `maximumAttempts` is
stored but is not an automatic retry loop; recovery is an operator-requested activation retry.

## Authoring experience

The inspector shows the workflow repository read-only, an operation dropdown, and an editable ref. It does not show the
query fields required by the selected operation, output fields, bounds, pagination, resolved revision, rate-limit
behavior, or a sample/test control. Query values must be supplied on a generic connection mapping.

The card shows the editable title, Data category, generic description, and unlabeled handles. It does not retain
`Repository data`, the operation, repository/ref, or bounded-read status. Registry `ui.fields` is empty for this node;
the working inspector and defaults are hard-coded in the web application, creating drift among registry, runtime, and
editor contracts.

## Runtime, persistence, and evidence

The worker uses a GitHub installation token and calls GitHub directly rather than the provider catalog/broker used by
Provider data. The executor validates provider responses and maps metadata, file, commit, and search results toward
provider-neutral names, but several pull-request results retain GitHub field names.

The execution package seals the graph and generic step definition, but it does not resolve a repository ref to a commit
for this node. `main`, `HEAD`, pull-request state, comments, reviews, checks, and search results can therefore differ
between identical package/input runs. The executor digest is derived from registry version, kind, version, and execution
class rather than executable code, so a package digest does not prove the exact reader implementation.

Successful output and input are persisted on the attempt. No dedicated datum records the request URL, operation,
resolved commit SHA, repository identity, response timestamp, pagination/truncation state, ETag, rate-limit state, or
credential/resource provenance. Run detail can display generic attempt input/output but cannot explain why two reads
differ. This node declares no external effect, which is correct for repository mutation, but read scope still needs
least-privilege enforcement because repository content can be sensitive.

## Validation, tests, and gaps

Existing tests in [repositoryDataExecutor.test.ts](../../../../src/workflows/repositoryDataExecutor.test.ts) use a mock
fetcher and cover all operations, URL construction, explicit/configured refs, response normalization, bounds, invalid
config, byte mismatch, and provider errors. Dispatcher tests prove delegation and output commit. Editor tests prove
repository scoping, operation selection, ref editing, and draft persistence.

Important gaps:

- no compiler check that repository owner/name equals a sealed workflow resource binding;
- no generated operation request/output schemas or connection compatibility tests;
- no test for the ref-only Checks contract, pagination beyond 100, cancellation, timeout, 429, or transient retry;
- no package/replay test proving a resolved commit is reused;
- no provenance assertion in the journal or run detail;
- no isolated-node fixture, pinned response, rate-limit fixture, or captured provider contract test;
- no browser acceptance evidence for operation query authoring, result inspection, keyboard flow, or recovery.

Per the documentation-only task, no tests or browser verification were run for this review.

## Behavior matrix

| Case | Current behavior | Target behavior |
| --- | --- | --- |
| Valid immutable read | Returns validated output when given an explicit commit SHA | Show typed request/result and record the resolved SHA and source |
| Empty query | Works only for metadata; other operations fail at runtime | Inspector and compiler require exactly the selected operation's fields |
| Invalid operation | Registry accepts a string; runtime enum rejects it | One shared operation manifest rejects it before save/publish |
| Moving branch | Reads current branch state on each attempt | Resolve at run preparation by default; offer explicit live-read mode |
| File over limit | Provider response validation or byte check fails | Prestate the limit and offer artifact-backed bounded alternatives |
| More than 100 records | First page is returned without a general truncation contract | Return page metadata and explicit bounded/truncated status |
| Checks by ref | Also requires an unrelated pull-request number | Require only ref or a selected pull request and derive its head SHA |
| 404 or permission failure | Generic failed attempt | Typed Not found/Forbidden error with safe details and recovery action |
| 429 or transient 5xx | Fails after one request | Bounded policy-driven retry with attempt evidence and server hints |
| Timeout/cancel | No request timeout or cancellation signal | Enforce deadline and cancellation; persist timeout/cancel evidence |
| Operator retry | Re-reads current remote state | Reuse pinned revision unless author explicitly chooses Refresh source |

## Expert judgments

### Competitive Expert

n8n and Make commonly change fields and outputs by operation and expose pagination options; Power Automate presents
connector actions as separate typed operations with dynamic content. Agency's one node can remain more compact, but it
should generate operation-specific forms and schemas from one manifest. Agency should intentionally exceed those tools
by sealing the resolved revision and retaining durable read provenance.

### UX Expert

Selecting an operation without seeing its required query is the largest interaction failure. The operation should
reconfigure the inspector immediately, the card should summarize `File content from owner/repo at <ref>`, and the
result preview should expose selectable fields. Ref semantics and bounds belong in Basic, with raw response/provenance
under Advanced.

### User Researcher

Users deciding whether to trust repository evidence will ask which repository, which commit, when it was read, whether
the result was complete, and whether a retry read the same source. Current run output answers only some of these after
manual JSON inspection. Repeatability should be the safe default, and a deliberate live-read mode should be visible.

## Findings

### P0

1. **The operation contract is not authoritative.** Registry, editor, and executor define different levels of detail,
   and Checks has an unintended required field. Generate config, ports, validation, defaults, and inspector controls
   from operation manifests.
2. **Read scope is not compiler-enforced.** The UI copies the workflow repository, but the executor trusts owner/name in
   step config. Compile only sealed, authorized repository resources and reject drift before execution.
3. **Published runs are not reproducible by default.** Mutable refs and live records are not resolved or evidenced.
   Resolve revision-sensitive operations to a commit at run preparation and persist live-read provenance for mutable
   records.

### P1

1. Add timeout, cancellation, rate-limit handling, bounded retry, and typed failure codes.
2. Make pagination/completeness explicit and preserve normalized result schemas across every operation.
3. Persist read evidence including repository, requested ref, resolved SHA, operation, request digest, observed time,
   page state, and implementation identity.
4. Clarify the product boundary with Provider data and use the same credential/resource enforcement infrastructure.

### P2

1. Add reusable query presets, pinned fixtures, and a result-field picker.
2. Show freshness and resolved revision on cards and outline rows.
3. Offer content as an artifact when bounded inline payloads are insufficient.

## Target design

### Ports and configuration

- Input: operation-specific `query`, optional only when the selected operation requires no fields.
- Outputs: typed `result`; optional `notFound` or `incomplete` expected-outcome ports where useful; standard `error`.
- Basic config: operation, sealed repository resource, revision policy (`Pin at run start` default or `Read live`), and
  operation fields not mapped from input.
- Advanced config: maximum items, page policy, timeout, retry policy, cache/freshness policy, and raw response access.
- Eliminate owner/name free text. Select the authorized workflow repository and store its immutable resource reference.

### Card and inspector

The card retains `Repository data`, operation, repository, requested/resolved ref policy, and a bounded/live badge.
Named handles show the operation's real ports. The inspector provides operation-specific fields, upstream field pickers,
limits, output shape, sample fixture selection, and the latest input/output/error/provenance.

### Testing, evidence, and safe defaults

- Default to pinning a revision at run start, 25 search items, at most 100 list items, a finite request timeout, and no
  unbounded pagination.
- Use deterministic provider fixtures for isolated tests; require an explicit live-test action for real GitHub reads.
- Record requested and resolved source, response digest, completeness, timing, retries, and sanitized provider IDs.
- Pin executable semantics with a build/code digest, not registry metadata alone.

## Fix checklist

- [ ] Define one manifest per operation with config, query schema, result schema, bounds, and expected outcomes.
  Acceptance: registry, compiler, editor, and executor consume the same manifests, and drift tests cover all operations.
- [ ] Remove the unrelated Checks `pullRequestNumber` requirement.
  Acceptance: a ref-only Checks case compiles and executes; missing ref follows the documented revision policy.
- [ ] Seal and enforce repository resource identity.
  Acceptance: edited owner/name outside the workflow binding fails compilation and no provider request is sent.
- [ ] Add revision pinning and live-read policy.
  Acceptance: two retries under Pin at run start use the same SHA; live mode records both observed SHAs.
- [ ] Add pagination and completeness contracts.
  Acceptance: every list result states returned count, limit, and truncation/next-page state.
- [ ] Add timeout, cancellation, retry, and typed error mapping.
  Acceptance: deterministic timeout, 429, 5xx, cancel, and exhausted-retry tests produce distinct journal evidence.
- [ ] Build the operation-aware inspector and labeled ports.
  Acceptance: users can configure every operation without raw JSON and connect only schema-compatible fields.
- [ ] Add isolated fixtures and provenance views.
  Acceptance: node tests can run without GitHub, and run detail shows repository, operation, resolved source, timing,
  completeness, and request/response digests.

## Shared dependencies and open decisions

Shared dependencies: authoritative node/operation manifests, schema propagation, common data picker, standard outcomes,
retry/timeout enforcement, executable digests, isolated-node testing, and inline attempt evidence.

Open decisions:

- Is Repository data limited to repository-native Git/content/revision operations, with all issue/PR records moving to
  Provider data, or is it the canonical GitHub repository connector?
- Which operations must be revision-pinned, and which intentionally observe live mutable state?
- Should bounded overflow return an explicit incomplete result, paginate to a configured cap, or fail?
- Which read provenance is safe to retain for sensitive repositories, and what redaction/retention policy applies?