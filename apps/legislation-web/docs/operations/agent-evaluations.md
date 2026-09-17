# Agent evaluations

The evaluation runner executes the same model loop and research-tool schemas as chat, against argument-matched frozen
query-service fixtures. Langfuse stores datasets, experiment links, root observations, and scores. OpenRouter performs
candidate inference and optional independent Astra judge/critic calls using the configured application key.

## Commands

Change into the application folder first:

```powershell
Set-Location apps/legislation-web
pnpm tool agent/evaluate-agent
pnpm tool agent/evaluate-agent --sync
pnpm tool agent/evaluate-agent --execute --case greeting
pnpm tool agent/evaluate-agent --execute --case greeting --judge
pnpm tool agent/evaluate-agent --execute --config evals/agent-experiment.json
pnpm tool agent/evaluate-agent --report tmp/agent-evaluations/RUN_ID
pnpm tool agent/evaluate-agent --upload tmp/agent-evaluations/RUN_ID
pnpm tool agent/evaluate-agent --resume tmp/agent-evaluations/RUN_ID
pnpm tool agent/regrade-agent --run tmp/agent-evaluations/OLD_RUN_ID
pnpm tool agent/regrade-agent --run tmp/agent-evaluations/OLD_RUN_ID --execute
pnpm tool agent/regrade-agent --run tmp/agent-evaluations/OLD_RUN_ID --execute --resume tmp/agent-regrades/REGRADE_ID
```

The default is a no-network dry-run. `--sync` publishes the selected cases and initial evaluator prompt definitions without
inference. `--execute` permits paid inference and Langfuse writes. `--case` filters by comma-separated exact case IDs. `--dataset path.json`
accepts additional cases validated by the canonical schemas in `src/modules/evaluations/contracts.ts`; keep a reviewed cumulative
regression dataset there rather than duplicating schemas. Existing runs retain their own dataset snapshot.

`--langfuse-dataset NAME` loads active executable cases from a pinned hosted dataset version, including during dry-run.
Replay fixtures are stored as `metadata.fixturesJson` and parsed before schema and case-hash validation; this preserves
floating-point search scores and source whitespace through hosted storage. Re-sync executable datasets after changing
their storage contract. A fixture contains either `output` or a captured `error` with its domain category and message,
never both. Captured errors replay as real service failures without adding a fixture gap; unrecorded inputs still fail
as coverage gaps. Do not fabricate successful aliases for invalid identifiers.

The supplied 12 smoke tasks are synthetic, draft, diagnostic cases, not a reviewed benchmark or representative traffic.
They require `allowDrafts: true`. Fixture matching is exact after structured argument normalization; unrecorded alternative
valid plans are harness coverage gaps, not empty results or agent-quality failures. Expand fixtures before using these
cases to compare autonomous retrieval. There is no live-query fallback and no production database mutation.

Vote detail tools paginate member positions without dropping voter records. Continue with the returned `nextCursor` and
unchanged selection; a roll call may span several pages, with `positionOffset` and `positionsTruncated` describing each
slice. Vote-level tallies remain totals for the roll call, not counts for the position slice. Shared cursors bind both
selection and captured response content; changed evidence requires restarting. Replay tests must consume every page and
compare all positions, not merely check that the first response fits. MCP first resolves HTTP position continuations,
then uses the same shared byte-bounded pages.

## Configuration and costs

`evals/agent-experiment.json` specifies candidates with explicit model IDs and numeric Langfuse prompt versions, repeats,
the evaluator model, `evaluate`, and shared call/input-character limits. Set `evaluate: true` or pass `--judge` to run separate judge and
critic calls on frozen outputs. They do not rewrite answers. Candidate order is interleaved per case and recorded via the
run ID; each repeat produces a new generation. Reasoning is currently fixed at low for all configurations and provider
fallbacks are disabled, matching chat.

`maximumModelCalls` is enforced before every candidate model step and each evaluator call. It includes judge/critic
calls, not just user tasks. The input-character limit rejects oversized inputs rather than silently truncating evidence.
These are resource bounds, not a dollar spending guarantee. Set an appropriate OpenRouter key/workspace spending limit
before unattended runs; the runner does not change billing limits. Each candidate turn has the production output-token
and timeout limits; the local journal marks incomplete or budget-blocked work and never approves a release.

Paid execution, calibration, and regrading share an exclusive filesystem lock at `tmp/agent-evaluations/active.lock`,
independent of the working/output directory. The lock records its PID and start time. It is released in normal failure
and cancellation paths. After a forced kill, verify that the owner is stopped before manually removing a stale lock;
never auto-steal it. This coordinates this checkout, not other machines or unrelated applications sharing the same key.

OpenRouter may reject in-flight credit reservations even when the key's monthly allowance remains positive. Grading
retries only explicit reservation errors (`402` with `in_flight_budget_exhausted`), HTTP 429, and DNS lookup failures,
at most three attempts. Honor `Retry-After` up to 120 seconds; longer guidance defers the stage without an early retry.
Every attempt reserves a call durably before dispatch. Permanent/ambiguous billing and authentication errors stop the run.
Timeouts and ambiguous connection resets are not automatically replayed. Candidate transport failures stop execution and
remain ungradable; they are not retried within a partly executed tool trajectory or counted as model-quality failures.
Uploads use batched score writes; failed uploads remain local for `--upload`, without repeating inference.

## Durable recovery

New runs pin the `checkpointed-evaluation` execution contract. `--resume` uses the saved dataset, prompt text/versions,
evaluator definitions, limits and source hashes, rejects overrides or changed inputs, and retains the cumulative call
budget from `calls.jsonl`. Candidate, judge, critic, and successful-upload checkpoints are separate atomic files. A critic
failure cannot discard a successful judge result. Each grading attempt has its own 120-second timeout; retry waiting
does not consume a shared judge-plus-critic deadline. Failures record sanitized status/reason, stage, delay and input hash,
not raw request bodies, headers or credentials. Run summaries are saved before exporter shutdown.

Completed candidate results are never regenerated by resume, including unsuccessful results. If a process dies between
provider completion and its atomic checkpoint, its durable dispatch marker blocks automatic candidate redispatch. Reconcile
the uncertain attempt before explicitly starting replacement work; exactly-once external inference cannot be guaranteed.
The ledger retains the attempt. Inspect ungradable results rather than treating an all-files-present run as a pass.

Old runs without this execution contract cannot be resumed in place. `pnpm tool agent/regrade-agent` reads frozen candidate outputs
and the original evaluator prompts, writes a separate versioned grading directory, and makes no candidate-model calls.
Its `--resume` reuses completed judge/critic stages and verifies source output, dataset and evaluator implementation hashes.
Original outputs/scores are not overwritten. The regrade writes independent Langfuse observations/run links and local
upload files; retry those with `pnpm tool agent/evaluate-agent --upload GRADING_DIRECTORY` if necessary.

Grading now uses `deduplicated-reference-evidence`: a reference containing an exact JSON copy of successful tool data
replaces only that duplicate with a call/turn/hash pointer into the unchanged evidence events. Independent expected facts
and references not found in retrieved evidence remain untouched. This is lossless input deduplication, not a summary,
truncation, or substitute for curated expected facts. The observed person-case payload fell from 264,530 to 133,045
characters. Comparisons reject mixed input contracts; regrade all arms consistently before comparing with old scores.

## Historical calibration and pilot comparisons

The temporary calibration and pilot-capture programs were removed after producing the frozen datasets. Retained datasets
can still be evaluated and compared from the app folder:

```powershell
pnpm tool agent/evaluate-agent --execute --dataset tmp/agent-pilot/CAPTURE_ID/dataset.json --config evals/agent-pilot-comparison.json
pnpm tool agent/evaluate-agent --execute --config evals/agent-repeat-comparison.json
pnpm tool agent/summarize-agent-comparison tmp/agent-evaluations/RUN_ID
```

The calibration used 16 controlled vote/status/quotation answers: 10 intentional errors and six correct/paraphrased
controls. It did not establish independent human calibration. Pilot capture used read-only transactions and preserved
source responses, URLs, hashes, and exclusions: 48 source-captured public cases plus 12 synthetic cases. All remain draft
pending independent domain review.

The pilot configuration compares prompt versions 1 and 2 on Luna, and Sonnet 4.5 against Luna with prompt 1. The repeat
configuration runs those same arms three times on smoke cases. Production labels are not moved. The comparison script
writes a new `comparison.json`, reports missing/ungradable pairs, and provides exploratory family-clustered bootstrap
intervals conditional on gradable pairs. Differential exclusions can bias these estimates; they cannot approve a release.

Required environment: `OPENROUTER_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and HTTPS `LANGFUSE_BASE_URL`.
Langfuse writes verify the legislation project ID before publishing. Evaluator prompts are published as
`legislative-research-judge` and `legislative-research-critic` for inspection. The current executable evaluator definitions
start in `src/modules/evaluations/evaluators.ts`. Runs with judging enabled resolve the Langfuse `evaluation` label once at startup,
then pin both evaluator versions and text hashes. Move that label to a new version to test an updated rubric.

## Continuous conversation collection

Online evaluation runs in Langfuse, not the application. The app emits a
`legislative-research-conversation` observation containing the submitted conversation, resolved references and
clarification context, prompt text/version/hash, tool schemas, visible tool arguments/results/errors, answer, response
IDs, timing and token counts. No capture sampling or content-length truncation is applied. Tool retrieval limits remain
unchanged. Credentials, headers and hidden reasoning are excluded. The existing SDK handles export; there is no local
queue, watcher, paid-call ledger, grader or automatic dataset writer for live chat.

The legislation project's **All legislative research conversations** rule matches that observation name at 100%
sampling. Two native evaluators use its **OpenRouter** connection with `openai/gpt-5.6-luna-20260709`:

- `legislative-research-quality`: supported, minor issues, material issues or ungradable, with reasoning covering
	grounding, citations, usefulness, coverage honesty and clarification.
- `legislative-research-critical-defects`: established critical defect, none established or ungradable, with offending
	spans, evidence IDs and remedies.

Manage prompts, models, rules, execution status and scores in Langfuse's Evaluators interface. Langfuse owns scheduling
and retries. Variables map to the same observation's input messages and complete output/evidence bundle; evaluators do
not automatically load child spans. Generation telemetry and the complete observation share session/capture IDs.

These are evidence-relative automated signals, not independently verified factual correctness or release approval.
All turns remain available as observations in Langfuse. Add selected observations to datasets in Langfuse for regression
experiments; collection does not imply a golden expected answer or coverage of unobserved retrieval alternatives.
There is no automatic prompt promotion or mandatory human-review gate for this personal prototype.

## Artifacts and metrics

Each immutable run directory includes configuration and code hashes, pinned prompt text, dataset and fixtures, per-case
answers, tool events, response IDs/model metadata, timing/token counts, critic/judge outputs, and upload requests.
Reasoning deltas, request headers and raw SDK request/response bodies are not captured. The artifact guard rejects common
credential patterns and sensitive URLs; it is not a general PII detector. Full research content is retained for this
personal prototype. Do not commit run artifacts or secrets.

`--upload` retries stored links/scores without regenerating answers. Runs use separate Langfuse experiment names per
candidate/repeat. Structural checks cover current-turn citation anchors, numbering, required citations, isolated
clarification, research-free cases, terminal behavior, and explicit text constraints. Semantic judges evaluate correctness,
grounding, completeness, and usefulness. Exact quotation extraction and semantic claim attribution are not yet deterministic
release checks. Scores with no applicable denominator are omitted, not treated as perfect.

The report lists every saved outcome and its failed checks; it is diagnostic, not a confidence interval or human-confirmed
success estimate. `humanOutcome` remains pending; `releaseApproved` is always false. Cost is unknown where the provider
does not supply reconciled billing metadata, never assumed zero. Inspect provider generation IDs in OpenRouter for billing.

## Remaining acceptance work

This implements the offline diagnostic foundation, not the entire scientific release process. Domain-reviewed references,
broader fixture/search-world coverage, optional human adjudication ingestion,
calibrated judges, paired statistical reports, dollar-cost reconciliation, release gates, and live canary monitoring remain
necessary before promotion decisions. Multi-turn smoke supports scripted new messages and a real clarification skip;
choice-label response policies need expansion before full conversation benchmarking.

Paid evals are never part of default Vitest or repository verification. Run focused offline tests explicitly:

```powershell
pnpm exec vitest run app/chat/agent.test.ts app/chat/prompt.test.ts app/evals/evaluation.test.ts
```