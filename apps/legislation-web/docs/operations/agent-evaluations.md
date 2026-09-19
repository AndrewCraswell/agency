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
Known public research failures retain the code, reference and message supplied to the model in error events.
Other SDK error messages are recorded as unknown rather than exposing untrusted diagnostics. A historical generic
error placeholder does not prove which error explanation the model received; do not grade it as such.
Length and other non-answer terminations are recorded as agent failures, retaining their actual finish reason
without continuing dependent follow-ups. The summary's completed count describes recorded executions, not accepted
or complete answers; inspect per-case status and termination.

The supplied 12 smoke tasks are synthetic, draft, diagnostic cases, not a reviewed benchmark or representative traffic.
They require `allowDrafts: true`. Fixture matching is exact after structured argument normalization; unrecorded alternative
valid plans are harness coverage gaps, not empty results or agent-quality failures. Expand fixtures before using these
cases to compare autonomous retrieval. There is no live-query fallback and no production database mutation.

Two additional local draft datasets target the remaining claim-quality acceptance:

- `evals/vote-attribution-regressions.json` covers amendment sequencing, restoration, unread operative text, voice
  votes and partial member positions. Fixtures are authored projections with public-source references, not complete
  historical captures. Captured explicit page-limit requests have separate exact-match fixtures; other limits,
  cursors and versions remain coverage gaps rather than wildcard matches.
- `evals/legal-fiscal-regressions.json` covers legal conditions, proposed/final authority, fiscal net effects and
  sample/date scope. Public excerpts, retained research-service passages and hypothetical controls are labeled
  separately. Source-captured cases embed provenance in their references and use supplied-text questions, not
  live retrieval. Retained evidence includes S. 2081, the CBO S. 1339 estimate, Medicaid hearing/correction clauses
  and CMS proposed/final-framework passages. Truncation, encoding defects and missing dates remain explicit.
  The retained CBO passage permits evidence-relative acceptance; fresh publisher verification and H.R. 7148's
  final operative scope remain unresolved. Paired turns check both unread-text limits and appropriate use of
  subsequently supplied text without attributing future evidence to an earlier answer.

Validate either with `pnpm tool agent/evaluate-agent --dataset PATH --config evals/agent-smoke.json`, omitting
`--execute`, `--sync` and hosted-dataset flags. This validates local inputs without inference or hosted writes.
All cases remain draft; schema validation and authored rubrics do not establish model adherence or legal accuracy.

## Authored browser scenarios

`pnpm tool agent/run-scenarios --scenario authored.json` validates and prints a plan without loading a browser,
sending requests or creating run output. `--scenario -` reads JSON from stdin; `--help` describes the input.
This tracked driver replaces ad hoc campaign scripts for new runs, not their historical journals.

The plan declares full jurisdiction names, up to eight exchanges, ordered prompts and any discovery dependencies.
Jurisdiction clarification rules supply structured choices rather than inferred matches. Optional radio/checkbox
mappings must exactly name those choices; otherwise the driver pauses. Non-jurisdiction questions require an exact
authored answer. An unanswered/repeated clarification or absent discovery blocks dependent prompts unless an explicit
missing-records branch exists. Accepted narrowing must be recorded in the plan; it is never selected automatically.

Only `--execute --base-url http://127.0.0.1:3000` authorizes actual browser research against a credential-free loopback
application. This can incur the application's model/provider costs, including homepage suggestions. It creates a
fresh directory under ignored `artifacts/scenario-runs` and never resumes or rewrites an old run. Browser execution
requires the installed Playwright browser binary.

Reports separate planned, selected, executed and terminally answered steps from unassessed objectives.
Confirmation/resume request pairs are correlated by clarification ID; raw transport failures remain recorded even
when an answer was delivered. A completed browser exchange, record list or tool invocation is not semantic acceptance
or evidence of duplicate model billing. Offline policy tests and synthetic loopback browser fixtures verify the driver,
not production research quality.

Each submitted exchange gets an independent `exchange-N.receipt.json`, even if the final export fails. The receipt
records driver failures, Stop visibility/click failure, capture status, observed request IDs and validated server
`x-rostra-request-id` values. A successful `exchange-N.json` retains the conversation snapshot; the receipt includes
only newly observed assistant messages, outcomes, calls and measurements, never an earlier response's correlations.
Unknown outcome/capture fields are `null`, not evidence of zero work or a fabricated finish reason.

The default response wait is 170 seconds. After that deadline or a driver error, the runner persists a receipt,
tries Stop for at most two seconds, then attempts one final export for at most 15 seconds before closing its owned
browser. Export still runs if Stop is unavailable or fails. Browser shutdown has a five-second budget and a bounded
five-second force-close fallback. `--wait-ms` and `--capture-ms` can reduce their respective defaults for local
fixtures, not increase them. Stop uses the smaller of two seconds and the capture budget.
Late transport observations are retained in the journal, report and final receipt; transport completion never proves
answer completion or billing. A deadline remains a driver failure even if the final snapshot contains a completed
answer. No uncertain generation is retried and no dependent question is sent after recovery.

Run the deterministic CLI/browser and policy regressions with
`pnpm exec vitest run --project backend tools/agent/run-scenarios.test.ts tools/agent/scenario-policy.test.ts`.
They use only synthetic loopback HTTP/stream/download fixtures, not models, credentials or historical campaign output.

## Frozen vote fixtures

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
run ID; each repeat produces a new generation. Candidate reasoning defaults to low unless `candidates[].reasoning` is specified; use `{"effort":"high"}` to match
chat's configured reasoning. Judge and critic reasoning remains low. Candidate instructions combine the pinned hosted
prompt with the same application composition rules as chat and trusted date context derived from the persisted run
start time. Resume reuses that time; the exact composed instruction hash participates in the candidate checkpoint.
The source inventory records Git-reported tracked deletions with a null hash. Restored files are hashed normally;
unexpected missing files or other read failures stop preflight rather than silently omitting source provenance.
Retained provider metadata is scrubbed of credential fields and reasoning payloads before result artifacts or
evaluation observations are written. Supplied usage counters and costs remain available; reasoning-token counts
are measurements, not retained reasoning text.

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

The conversation evaluators' citation rubric was updated September 16, 2026 in Langfuse. It prefers `composition.text`
when supplied and distinguishes resolvable anchors from support for the claim's record, bill, jurisdiction, date, version,
and passage. It explicitly checks unrelated citations attached to empty results and metadata represented as quotations,
without penalizing honestly disclosed missing publisher URLs. Models, output categories, variable mappings, and the
existing 100% conversation rule were retained; bakeoff evaluators were not changed.

Native control batch `2987022b-b2f2-465c-b5d7-f599394944f5` contains three synthetic observations, not real legislative
evidence. Quality/critical scores were supported/no-established-critical-defect for disclosed missing provenance,
material-issues/critical-defect for a wrong-bill citation, and minor-issues/critical-defect for an unrelated empty-result
citation. All six scores came from Langfuse (`source=EVAL`). The severity disagreement remains visible; this small check
does not establish independent evaluator calibration or a production accuracy rate.

## Card-first quality iterations

On September 17, 2026, two runtime-prompt candidates were compared with retained original and card-first outputs on
the native `legislative-research/visualization-catalog` dataset: 16 draft cases, including 13 eligible views and three
prose controls. These are synthetic requests with frozen evidence and final-answer continuation only, not live retrieval.
All arms used managed prompt version 2 and `openai/gpt-5.6-luna-20260709` with low reasoning. Input hashes matched by
case; model, dataset and native evaluator versions were checked against the retained manifest before inference.

| Arm | Supported | Minor issues | Material issues | Critical defects | Ready views / 13 | Appropriate views / 13 |
| --- | --- | --- | --- | --- | --- | --- |
| Original runtime, retained | 6 | 2 | 8 | 5 | 11 | 11 |
| Card-first runtime, retained | 6 | 7 | 3 | 3 | 13 | 12 |
| Added top-level evidence limits | 5 | 5 | 6 | 3 | 11 | 11 |
| Narrower existing-rule edits | 8 | 6 | 2 | 3 | 11 | 9 |

The two new candidates made 32 total inference calls with no automatic retries; all terminated normally. Each received
all 144 expected native scores (`source=EVAL`, nine scores per answer). Quality and critical-defect judges remained at
version 3, visualization emission at version 1, and visualization choice at version 2. Historical outputs and scores
were not regenerated or rejudged. All arms kept the three prose controls view-free. The retained card-first prompt also
contained the subsequently removed conditional web-tool instruction; it is not byte-identical to the committed prompt.

The narrower candidate improved aggregate quality ratings and removed the vote-inspector completeness overclaim, but
missed two navigation cards and received two harmful/invalid visualization judgments for quotation presentation. Its
views had no renderer errors: those judgments concern suitability or duplication, not failed parsing. The expanded
candidate produced one invalid status view and one missed navigation card. Neither candidate met the combined goal of
preserving card follow-through and improving quality, so both were rejected and the committed prompt was restored.

Some quality judgments treated ready quotation views as absent text or raw spec output; the native visualization judge
recognized those same resolved blocks. These disagreements remain in the raw scores, not manually converted to passes.
Before further optimization, inspect the judges' rendered-content interpretation prospectively with controlled examples;
do not change historical scores or weaken evidence standards. A single sample per case, adaptive prompt selection and
this small reused dataset do not establish statistical non-inferiority, broad quality or end-to-end research reliability.

In the legislation Langfuse project, the new experiment names are
`visualization-quality-evidence-limits-20260917-current` and `visualization-quality-grounded-views-20260917-current`.
Local immutable manifests, outputs and complete native score receipts use prefixes
`tmp/visualization-quality-evidence-limits-074eeb2e` and `tmp/visualization-quality-grounded-views-074eeb2e`.
The retained comparison uses `tmp/visualization-current-quality-4bbace81`. The existing ignored diagnostic runner
`tmp/visualization-quality-check.mts` supports candidate runs and read-only score collection; no app-side grader was added.
No managed prompt labels, evaluator definitions, model settings, production deployment or commits changed in this iteration.

## Rendered-answer evaluator calibration

September 17, 2026: isolated native candidate judges were calibrated against synthetic positive/negative controls,
without changing production evaluators, historical scores, answer prompts or model settings. Both candidates use the
existing OpenRouter Luna model and the same request/output mappings. They assess prose together with ready resolved
blocks, distinguish visible quotations from compact source navigation, preserve pagination/truncation limits, and separate
presentation defects from fabricated evidence, wrong-source citations, unsupported legal effect and false completeness.
The rubric also reflects the renderer's approximately 600-character initial excerpt and collected-text expansion control.

The corrected calibration has 26 controls repeated twice. Expected categories were fixed locally before submission and
were not passed to judges; observation metadata contained only the synthetic batch and opaque sample identifiers. Ready
views were resolved with the actual composition parser. Failed/pending captures were explicit negative controls. There
was no answer-model inference. The original judges and candidate judges assessed the same new observations.

| Metric on 52 judgments per judge | Original judges | Candidate judges |
| --- | --- | --- |
| Quality category matches | 39/52 | 52/52 |
| Critical-defect category matches | 42/52 | 52/52 |
| Deliberately critical cases detected | 22/22 | 22/22 |
| False critical alarms on noncritical controls | 9 | 0 |

These are evaluator calibration counts, not application answer quality: more category matches and detected known defects
are better; fewer false alarms are better. All 208 corrected-batch scores came from native evaluators (`source=EVAL`).
The candidates recognized ready quotes and honest paging while still rejecting fabricated quotations, invented/wrong-bill
citations, unsupported current-law claims, source-instruction obedience and falsely complete partial data.

An initial 22-control, two-repeat batch produced 176 scores. A positive paging fixture accidentally gave HB 102 the URL
for HB 101; candidate flags correctly exposed this defect. That batch is retained but is not clean calibration evidence.
The fixture was corrected, duplication severity clarified, and four expandable/truncated-passage controls added before
the fresh corrected batch. No initial or historical scores were overwritten or rejudged.

Candidate evaluators are [rendered quality](https://us.cloud.langfuse.com/project/cmsw50z9p00dfad0i5wkf01jy/evals/cmu62uy63025aad0d386zknd2)
and [rendered critical defects](https://us.cloud.langfuse.com/project/cmsw50z9p00dfad0i5wkf01jy/evals/cmu62uybe0209ad0cgiyv3mq7),
both at version 2. Their sole calibration rule `cmu62uyt7020had0djtjyp7ge` is disabled after completion. Production quality
and critical judges remain at version 3; production conversation and visualization-experiment rule configurations were
read back unchanged. Candidates are not promoted automatically. The ignored runner is `tmp/rendered-evaluator-calibration.mts`;
immutable plans, manifests, observations and scores use prefixes `tmp/rendered-evaluator-calibration-074eeb2e` and
`tmp/rendered-evaluator-calibration-corrected-074eeb2e`.

This is an author-labeled, small synthetic calibration with repeated controls, not independent human validation or a
held-out generalization test. The corrected set partly reuses cases used to refine the rubric. Perfect agreement here
does not establish perfect judging on real conversations. Review the candidate rubrics before any prospective production
promotion; historical scores must remain pinned to their original judge versions.

## Fresh prompt comparison with calibrated judges

September 17, 2026: ran 32 fresh answers, alternating old and card-first runtime prompts within each of the 16 frozen
catalog cases. Both arms used managed prompt version 2, Luna with low reasoning, identical input hashes and no live tool
execution. The old runtime comes from the retained pre-card manifest; the card-first runtime is the previously reviewed
card-first prompt with its obsolete conditional web-tool paragraph removed. Neither arm includes concurrent Firecrawl
changes or the two rejected experimental prompt revisions. All answers terminated normally and all 288 native scores
arrived, with no ungradable answers. Both arms used the same rendered-quality/critical candidate judges at version 2,
visualization emission at version 1 and visualization choice at version 2.

The answer-quality index was specified before inference: supported = 100, minor-issues = 50, material-issues = 0,
averaged over gradable answers. It is an illustrative categorical weighting, not factual accuracy or calibrated utility.
Safety and visualization metrics remain separate rather than being concealed inside a composite score.

| Higher-is-better metric | Old prompt | Card-first prompt |
| --- | --- | --- |
| Answer-quality index / 100 | 65.6 | 56.3 |
| Fully supported answers | 8/16 | 7/16 |
| Answers without material quality issues | 13/16 | 11/16 |
| Answers without an established critical defect | 14/16 | 15/16 |
| Eligible cases with a ready view | 11/13 | 12/13 |
| Eligible cases with an appropriate visualization judgment | 9/13 | 11/13 |
| Exact target component selected | 9/13 | 11/13 |
| Prose controls correctly left without views | 3/3 | 3/3 |

Raw quality counts are supported/minor/material = 8/5/3 for old and 7/4/5 for card-first. Five paired quality categories
worsened, four improved and seven were unchanged. The card-first answer-quality index decreased while critical flags
fell from two to one and view selection improved. This does not establish an overall win or non-inferiority. The new
critical flag concerned a shortened/altered quotation labeled exact; historical scores were not touched.

Remaining evaluator limitations are visible: two old-arm answers were critical-flagged but quality-rated minor despite
the intended severity contract. The choice judge accepted the old arm's prose-only navigation response but marked the
new arm's equivalent omission as a missed card, showing that the arm-specific runtime contract affects suitability
judgments. Renderer counts are independently measured and should not be confused with those semantic judgments. No
scores were manually reconciled or converted to passes. This small reused frozen-evidence dataset remains a diagnostic,
not a held-out or end-to-end research benchmark.

Experiment names are `visualization-calibrated-pair-20260917-074eeb2e-before` and
`visualization-calibrated-pair-20260917-074eeb2e-current`. Immutable manifests, outputs and complete score receipts use
`tmp/visualization-calibrated-pair-074eeb2e`. The dedicated rule `cmu63fmmz01cqad0c5o3kkxza` was disabled after completion;
judge versions and production rule configurations were read back unchanged. No prompt/evaluator publication, production
settings, deployment, historical rejudging or commit occurred in this comparison.

## Fixed-policy judge consistency

September 17, 2026: revised only isolated candidate judges to address severity contradictions and arm-dependent
visualization policy. Quality and critical candidates share the same material-evidence decision rules. A diagnostic
flags `critical-defect` paired with a quality category other than `material-issues`; it never overwrites either score.
The visualization candidate uses a fixed product policy and frozen reference schemas, not each answer arm's generation
instructions. Production judges, answer prompts, historical scores and managed prompt labels are unchanged.

Rubrics and acceptance criteria were frozen before a separate subagent labeled 16 new synthetic controls. The first
labeling report contained category errors and was rejected before scoring; a second reviewer supplied the retained
labels and explicitly identified preference/framing ambiguities. Reviewers did not receive judge outputs, candidate
rubrics or prior calibration labels. This is separate-agent review, not independent human or known different-model
validation; the author still designed the fixtures and communicated the product policy.

Each control was sent under old/new generation metadata, but all judge mappings included only user messages and output.
Local hashes and hosted observation readback confirmed paired mapped inputs were identical. All 96 native scores
arrived: quality agreement 26/32, critical agreement 32/32 and visualization agreement 26/32, with zero severity
contradictions. Two visualization pairs nevertheless disagreed on identical mapped inputs: a ready short quote was
treated as raw unrendered syntax once, and a prose-only wrong citation was treated as an invalid visualization once.
Since excluded labels cannot explain differing judge inputs, these differences do not establish remaining label leakage;
they expose stochastic or semantic inconsistency. The first isolated rule was disabled after the completed batch.

A targeted visualization revision now maps only `$.messages`, `$.composition` and `$.events`; raw `output.text`, arm
labels and `compositionInstructions` are excluded. Ready quotation blocks are explicitly authoritative for delivery,
while evidence still determines correctness. Prose-only citation defects belong to research judges, not an invented
structured view. Misleading prose that describes an actual partial view as complete remains a visualization defect.
Quality and critical candidate definitions stayed frozen for this repair. Six unseen scenarios were separately labeled
before scoring, alongside the retained 16 regression controls; reused and unseen cases must be reported separately.

The local runner `tmp/judge-consistency-074eeb2e.mts` and immutable `tmp/judge-consistency-074eeb2e-*` artifacts retain
the first run. The repaired run uses `tmp/judge-consistency-resolved-views-074eeb2e-*`. Frozen definitions, reviewer labels,
mapped-input hashes, native score receipts and contradiction reports are retained independently. Candidate quality and
critical evaluators are version 3; the fixed-policy visualization candidate is
`legislative-research-fixed-policy-visualization-calibration`, version 2. These are not the production evaluator versions.
No automatic promotion or historical rejudging is authorized by a successful synthetic control run.

## Research-step reliability

Every live-research acceptance run must have normal termination, zero failed research calls and zero pending calls.
A recovered retry remains a failed call even if the final answer succeeds. Report research reliability separately from
answer quality, citation correctness and visualization suitability; none compensates for a failed research step.

The native code evaluator `legislative-research-step-reliability` (`cmu64uxt002wdad0f8qrdqbuk`) is enabled for future
`legislative-research-conversation` observations at 100% sampling through rule `cmu64uxvs017vad0cgzxwu72d`. It emits
`research_execution_measurement`, `research_call_count`, `research_failed_call_count`, `research_pending_call_count`,
`research_success_rate` and `research_steps_clean`. The pass flag requires at least one research call, normal termination,
and no failed/pending calls. Calls are paired with results/errors by turn and call ID; retries do not erase failures.
Clarification and generation events are not research calls. Missing/malformed event ledgers are ungradable, not passes.
This records a diagnostic pass flag; it does not automatically block deployment or alter the existing quality judges.

Frozen-evidence, fixture and synthetic scopes are not live-research reliability evidence. No-research answers are
reported separately, not counted as perfect retrieval. The previous paired visualization experiments only generated
final answers from supplied evidence; they cannot establish that real research executed without failures. Future live
evaluation workflows using other observation names must attach this evaluator explicitly and include scope metadata;
the default rule above matches conversation captures only. Keep missing or not-applicable runs out of the success-rate
denominator and report their counts. Tool-choice appropriateness and coverage still require separate evaluation.

Local deterministic checks cover clean calls, failed-then-recovered calls, pending calls, abnormal termination, missing
call entries, frozen inputs, result error envelopes, repeated error events and clarification-only runs. Three hosted
controls produced all 18 expected native scores; the temporary control rule was disabled. Historical scores were not
rewritten. The local source and receipts are `tmp/research-step-reliability-evaluator.ts` and
`tmp/research-step-reliability-074eeb2e-*`.

A read-only audit of the H.R. 1/H.R. 2 browser runs found 5/7 successful calls before the resolver metadata fix (two
failed `resolve_record` attempts), versus 6/6 after it, with no failed/pending calls in the rerun. The failure was an
unsupported `chamber: "House"` filter on bill resolution. The shared contract now describes chamber/organization as
vote-only; strict rejection is retained. This is one verified rerun, not a general error-rate guarantee. Audit traces:
`3daa8784406b503cb813238b70ec0f11` before and `1b37dc6d25bf3e3a7212d0995271be0b` after.

## Content once

The answer prompt now treats cards as answer content: a result list or group replaces a duplicate prose inventory of
the same bills, a full card replaces its visible fact recap, and a quote view replaces duplicate quotation prose.
Brief names in analysis, genuine comparisons, citations and coverage/version caveats remain useful; compact cards do
not replace facts they hide. The fixed-policy visualization candidate (not production) is now version 3 and includes
this rule. Four controls repeated twice produced eight expected native judgments: duplicated bullet lists rejected,
card-only lists, comparisons and hidden facts accepted. Its temporary rule is disabled.

The first browser check rendered a compact two-bill group with no duplicate bullet list, no overflow at 1280/390px and
keyboard-accessible links, but included the two failed resolver calls above. The clean resolver rerun still added a
short prose status recap, so the prompt is guidance rather than a proven guarantee against all redundancy. The earlier
resolved-view consistency batch had no returned scores at its last read despite visible observations and active judges;
its isolated rule was disabled, and no acceptance claim is made for that batch. Retained artifacts use
`tmp/card-content-once-074eeb2e-*` and `tmp/judge-consistency-resolved-views-074eeb2e-*`.

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

## Live old/current comparison

September 17, 2026: six cases per arm, alternating old pre-card and current content-once prompts. Both used managed
prompt version 2, Luna-low, identical application tools and production limits (8 steps, 24 calls, 120 seconds).
This exercised live research, capture and composition, including configured web tools; it did not test HTTP authentication
or browser rendering. Each arm selected its own evidence against the same live services, not a frozen database snapshot.
Normal session-scoped result snapshots were persisted; legislative source data was not modified. Tracked source hashes
did not change during execution. All 12 runs terminated normally and all 170 applicable native scores arrived.

| Higher-is-better metric | Old | Current |
| --- | --- | --- |
| Answer-quality index (supported=100, minor=50, material=0) | 66.7 | 58.3 |
| Fully supported answers | 3/6 | 3/6 |
| Answers without material quality issues | 5/6 | 4/6 |
| Answers without established critical defects | 6/6 | 5/6 |
| Research cases with zero failed/pending calls | 4/5 | 4/5 |
| Successful research calls | 22/23 | 26/27 |
| Appropriate visualizations in research cases | 3/5 | 5/5 |
| Prose-only control without research or cards | 1/1 | 1/1 |

| Case | Old quality index | Current quality index | Old successful calls | Current successful calls |
| --- | --- | --- | --- | --- |
| Two bill entries | 100 | 50 | 6/6 | 7/7 |
| Bill status | 100 | 100 | 4/4 | 4/4 |
| Bill history | 50 | 0 | 4/5 | 6/7 |
| Exact introduced wording | 0 | 0 | 7/7 | 8/8 |
| Representative profile | 50 | 100 | 1/1 | 1/1 |
| Prose-only civics control | 100 | 100 | Not applicable | Not applicable |

Both history runs had a failed `get_bill_timeline` call and therefore fail research reliability even though the answer
completed using other data. The current history answer also received a critical wrong-action citation flag. Neither
wording answer delivered the requested introduced-version passage. The quality and critical judges disagreed in their
reasoning about a citation in the old wording answer; the raw judgments remain unchanged. Zero mechanically detected
critical/quality category contradictions does not mean all judge reasoning agrees.

This does not establish current-prompt non-inferiority or a release pass. Do not promote on improved card counts alone.
No failed run was dropped or rerun. The fixed judges were rendered-quality/critical candidates version 3, fixed-policy
visualization version 3, emission version 1 and research-step reliability version 1. The isolated rule
`cmu657n4h02kmad0clmbkbyad` is disabled; production rules and judge versions were read back unchanged. No answer prompt
or evaluator promotion occurred. Per-case comments and trace IDs are retained in
`tmp/live-answer-comparison-074eeb2e-scores.json`, with manifest, raw outputs and source-drift receipt under the same prefix.

Baseline test type errors were repaired without changing Firecrawl runtime behavior. Web type-check and 58 focused
agent/research/composition tests passed (Vitest reported a worker shutdown warning after passing tests). Full repository
verification remained blocked by existing Knip findings. These technical checks do not override the failed live research
acceptance requirement above.

## Task-grounding prompt iterations

September 17, 2026: three candidate revisions and one unchanged confirmation were run on all six live cases above.
Questions, managed prompt version 2, Luna-low, tool limits and all five judge versions stayed fixed. No historical score
was changed, no failed case was dropped, and tracked source hashes did not drift within any run. These adaptive trials
reuse the small diagnostic set; their results are not independent holdout accuracy or statistical non-inferiority.

| Attempt | Quality index / 100 | Fully supported | Critical flags | Critical ungradable | Clean research cases / 5 | Appropriate views / 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Prior current prompt | 58.3 | 3/6 | 1 | 0 | 4 | 5 |
| Task-grounding candidate | 66.7 | 4/6 | 1 | 0 | 4 | 4 |
| Expanded chronology candidate | 50.0 | 2/6 | 1 | 0 | 3 | 3 |
| Concise evidence candidate | 58.3 | 3/6 | 2 | 0 | 4 | 4 |
| Task-grounding unchanged confirmation | 66.7 | 4/6 | 1 | 1 | 3 | 4 |

The task-grounding candidate is adopted in the local composition contract but was not published as a Langfuse prompt
version. It confines navigation requests to useful cards, avoids unsolicited status/absence claims, requires
claim-specific supporting citations, and preserves requested version limits. Its initial and confirmation case scores
were identical: bill entries 100, bill status 100, bill history 0, introduced wording 0, person profile 100, prose control
100. This is an observed 8.3-point improvement over the prior current prompt, not an overall release pass: visualization
appropriateness fell from 5/5 to 4/5, history still has a critical citation defect, and confirmation research reliability
worsened. The confirmation wording answer was empty and terminated with `tool-calls`, not `stop`; its critical judgment
was ungradable, not a pass. Both rejected candidates and all their failures remain preserved.

A separate read-only invocation of the exact timeline request failed without any model: PostgreSQL error 42804,
`COALESCE types text and date cannot be matched`. The query coalesces formatted timestamp text with a date column.
This is a query implementation defect, not a prompt defect; no tool bypass or relaxed failure rule was introduced to
raise scores. The requested introduced text also remained unavailable in the retrieved version catalog. The confirmation
tried the uncollected version and a webpage read, both failed, and did not deliver an answer. This does not establish
whether that historical version exists elsewhere.

All four runs have six recorded outcomes and 85 applicable native scores each (340 total); one outcome ended without
a final answer as described above. Their dedicated rules were disabled and production configurations verified unchanged.
Artifacts use `tmp/live-answer-task-grounding-074eeb2e`, `tmp/live-answer-evidence-chronology-074eeb2e`,
`tmp/live-answer-concise-evidence-074eeb2e`, and `tmp/live-answer-task-grounding-confirmation-074eeb2e` prefixes. Further
acceptance requires repairing the timeline query, resolving or appropriately evaluating version availability, and testing
the frozen retained prompt on additional cases rather than repeatedly tuning against this set.

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