# Legislative agent evaluation plan

Status: design accepted by a GPT-6 Astra judge through Copilot after revision, subject to the implementation prerequisites
below. Local planning artifact; no evaluators, datasets, jobs, or release gates have been implemented or empirically
validated by this document. Judge acceptance is not human release approval.

## 1. What we are trying to establish

Measure whether a prompt/model configuration helps a user complete a legislative research task correctly, with
appropriate evidence and scope, within an acceptable time and cost. A polished answer is not necessarily a correct answer.
A syntactically valid citation is not necessarily supporting evidence. A cautious refusal is not necessarily a success.

Our primary estimand is the change in successful-task probability on the target user-task distribution, with tools and
data held fixed. Separately measure performance on intentionally difficult safety and reliability cases. Do not combine
representative traffic and oversampled adversarial cases into a single purported production-quality percentage.

Maintain three scorecards:

1. Representative quality: traffic-weighted task success and utility, with uncertainty and sampling provenance.
2. Risk and contracts: critical failures and regression counts by hazard, including deliberately difficult challenge cases.
3. Operational performance: failures, latency, resource use, and total cost per successful task.

Release decisions require all three. Do not trade fabricated evidence against improved style in a weighted average.

## 2. Current implementation and implications

- `src/app/chat/route.ts` hardcodes a Luna model and low reasoning effort. It uses eight model steps, 4096 output tokens,
  and a 120-second timeout; the research wrapper permits 24 attempted research executions.
- `src/modules/conversations/prompt.ts` loads `legislative-research` using the moving `production` label. Experiments must resolve and pin
  a numeric version and text digest once at run start. Historical model aliases also need resolved identifiers.
- Prior tool results are not replayed in chat history. Follow-up evaluation must reproduce that restriction, fresh
  citation IDs, clarification submission/resumption, skipped questions, and supersession.
- Existing embedding/retrieval bakeoffs under `evals/` use frozen candidate corpora and retrieval judgments. Reuse their
  methodology and appropriate helpers; their results do not establish agent answer quality.
- `src/observability/telemetry.ts` sanitizes/truncates values and records result counts. Those observations alone cannot
  reconstruct complete evidence or support faithful claim-level grading. Preserve privacy controls; add a deliberate,
  access-controlled eval capture path rather than logging everything indiscriminately.
- The earlier Astra prompt reviews were static reviews, not empirical agent evaluations. They supply hypotheses and
  challenge cases, not baseline measurements or deployment evidence.

## 3. Coverage design

### Two complementary populations

Build a representative set from randomly sampled, eligible user sessions, plus a risk-enriched challenge set. Until real
traffic is sufficient, use explicitly labeled expert-designed tasks and report their results as designed-benchmark quality,
not measured production quality. Preserve sampling probabilities for later weighting.

Treat a complete user task/session as the primary unit. A multi-turn task should not count as five independent successes
because it generated five messages. Group related bills, document families, paraphrases, and conversations for splitting
and uncertainty estimation.

Before sampling, freeze a population manifest: the product/environment, supported user population, a reference period
(initial proposal: the preceding complete 30 days), consent/privacy eligibility, and task-boundary rules. Segment separate
requests in one session using those rules before inspecting candidate results. Include failed, abandoned, unanswerable,
and clarification-needed tasks; evidence-poor tasks must not disappear merely because replay is difficult. Report what
fraction of this population is capturable/replayable and the excluded strata. Claims from its replayable subset apply
only to that subset unless a prespecified missing-data analysis supports broader inference.

For probability-sampled representative tasks, freeze inclusion probabilities and weights before execution. Define
`w_i = 1 / inclusion_probability_i` (or equivalent preregistered stratum expansion weights). For configuration `c`, let
`s_ic` be the mean terminal binary success across the prespecified independent repeats of task `i`. Estimate
`p_c = sum(w_i * s_ic) / sum(w_i)` and the paired effect `Delta = p_candidate - p_baseline` on the identical cohort.
Weight task units, not messages or tool calls. Account for repeated/source-family dependence and the sampling design in
intervals. Do not mix challenge-case weights into this estimate. Unknown sampling probabilities or convenience selection
permit only a designed-benchmark estimate; weighting cannot manufacture representativeness.

### Coverage matrix

| Axis | Required strata | Failure to catch |
| --- | --- | --- |
| Intent | Discover, identify, explain, quote, compare, enumerate, verify status, trace changes | Good summaries masking bad enumeration or comparison |
| Data family | Bills/text, votes, amendments, people, organizations, events, supporting materials, observed changes | A bill-only benchmark hiding weak relationship research |
| Jurisdiction/time | Federal and multiple states, chambers, sessions, historical/current requests | Identifier collisions, stale membership, unsupported current-law claims |
| Evidence state | Complete, partial, metadata-only, unavailable, failed, conflicting, stale | Fabricated text, false absence, incorrect source precedence |
| Answerability | Fully answerable, partly answerable, needs clarification, unavailable, general explanation | Blanket refusal gaming grounding scores |
| Conversation | Single turn, follow-up, changed scope, correction, skip, supersession | Old citations, clarification loops, scope drift |
| Tool difficulty | Direct lookup, multi-hop, pagination, retries, large payloads, exhausted budget | Correct-looking answers with incomplete research |
| User formulation | Novice/expert wording, terse/vague requests, typos, paraphrases, pasted text | Brittle dependence on canonical phrasing |
| Adversarial risk | Source injection, false premises, fabricated citation bait, synthetic secret requests | Evidence or instruction-boundary failures |

Use pairwise coverage for ordinary combinations and explicit higher-order coverage for critical intersections. Do not try
to exhaust the Cartesian product. Essential intersections include ambiguous identifier plus follow-up, skipped scope plus
partial results, current-law question plus stale status, unavailable version plus comparison, metadata-only amendment plus
quotation request, and a source-injected instruction inside an otherwise relevant passage.

Challenge examples must include zero versus missing vote counts, chamber passage versus enactment/effectiveness,
observation date versus legislative date, testimony opinion versus bill provision, and related-by-topic versus explicit
record relationship. Include requests for comprehensive statute/regulation/case-law answers that exceed the chat tool set.

Track coverage as a matrix of case counts, independently reviewed references, recent executions, adjudicated failures,
and uncertainty. A listed category with one easy example is not adequate coverage. Unknown/underrepresented strata must
remain visible rather than being counted as passed.

Before a coverage-benchmark or confirmatory run, preregister a release-scope coverage contract. Proposed minimums are
five independent reviewed task/source families per required stratum and three per named critical intersection. For each
critical intersection include a supported-answer case, a missing/partial-evidence case, and a difficult/adversarial variant
where meaningful; review any inapplicable dimension explicitly. Families may cover several cells but cannot count as
independent paraphrases inside one cell. These are diversity floors, not statistical power or risk guarantees; confirmation
and hazard bounds may require substantially more cases. A below-floor required cell blocks promotion for the proposed
scope. Fix the gap or prospectively narrow product claims/scope before a new run; never relabel it optional after results.
The 12/60-case smoke/pilot stages are diagnostic and are not exempt routes to promotion.

### Dataset growth

| Stage | Suggested size | Purpose |
| --- | ---: | --- |
| Smoke | 12 task families | Fast detection of major contract breaks, not statistical improvement claims |
| Pilot | 60 reviewed tasks | Establish execution reliability, rubric usability, cost, and variance |
| Coverage benchmark | 180 or more reviewed tasks | Broaden strata and intersections; expose systematic weaknesses |
| Confirmation | Determined from observed variance and target effect | Support an actual model/prompt promotion claim |

The initial 60 tasks: identity/scope 8; status/facts 8; text/comparison 8; votes/amendments/relationships 8;
people/organizations/events/materials 6; search/coverage/pagination 6; multi-turn follow-ups 6; adversarial/failures 6;
general-help/unsupported-data 4. At least 12 tasks should span multiple turns; these are included in the 60, not added.

Split by source/task family into development, evaluator calibration, and sealed release holdout, initially approximately
60/20/20. These small splits establish a workflow, not narrow confidence intervals. Grow a balanced synthetic-error
challenge set specifically for judge calibration without representing its error prevalence as production prevalence.
Never put paraphrases or versions of the same source family on opposite sides of a holdout boundary.

## 4. Reference quality and labels

Each case needs the user request, necessary history, data-world identifier, relevant as-of time, task/coverage tags,
expected outcome type, required facts, forbidden material claims, supporting record/document/section references,
acceptable alternative interpretations, and clarification response policy. Keep expected answers out of agent context.

For multi-turn cases, define terminal success/failure predicates, allowed scripted user-response branches, maximum user
turns/agent invocations, and session cost/time limits before running candidates. A correct intermediate clarification is
diagnostic, not completed research, unless asking that question is explicitly the terminal objective. Declined clarification
or unresolved record identity terminates in a labeled limitation/candidate-level outcome when the reference permits it;
looping, choosing a record without support, or reaching the interaction limit without an allowed outcome fails the task.
Scripted responses represent what that user would know, not hidden reference truth. Each task/configuration/repeat has
one terminal result; intermediate-turn scores cannot multiply the success denominator.

Use fact sets and behavioral requirements rather than one ideal paragraph. Expected behavior can be a clarification,
candidate list, partial answer, or explicit limitation. Exact-string matching is appropriate for counts/identifiers and
quoted source spans, not an entire natural-language answer.

Distinguish factual reference truth from evidence available to the candidate. A fact may be true but unsupported by the
available tools; grade factual correctness and evidence grounding separately. An absent fact in an incomplete source is
unknown, not false. References for historical cases describe what was knowable at that time.

A legislative/domain reviewer authors or verifies factual references. A second reviewer independently labels a stratified
subset and every high-risk disputed case. Record disagreements, adjudication, reviewer identity, reference provenance,
review date, and revision. LLM-generated questions and answers are proposals until reviewed; production assistant answers
and thumbs-up feedback are never automatically ground truth.

## 5. Metrics and evaluator responsibilities

### Primary outcome

Task success is a binary adjudicable outcome: the expected task outcome was achieved, material facts are correct and
supported, necessary scope/caveats are present, and no critical violation occurred. For multi-turn cases score both
intermediate decisions and end-to-end completion. Report the numerator and denominator, not just a percentage.

Freeze eligible task IDs and task/configuration/repeat units before execution. Execution attempts and evaluator retries
are audit records within those units, not extra tasks or independent outcomes. A fully observed agent timeout, malformed
answer, prompt-fetch failure, or unrecovered production-tool failure is terminal failure. Missing fixture/capture or failed
grading is unresolved infrastructure missingness, not a success or an implicit agent failure.

Retry only prespecified infrastructure faults, at most two recovery attempts beyond the initial attempt. For a judge
outage, regrade the same frozen output without regenerating it. If a harness fault invalidates generation, rerun the
affected baseline/candidate pair under an unchanged manifest, retaining invalidated attempts and failure classification.
Do not retry a valid but unsuccessful agent output to improve its score. Material harness/data fixes create a new run.
Report planned units, valid outcomes, agent failures, unresolved units, and all attempts separately. Success among scored
units is diagnostic and is not the full-cohort primary estimate. While units remain unresolved, the primary result is
pending; optional best/worst-case weighted bounds may illustrate missingness but cannot approve a release. No post-outcome
exclusion or silently reduced denominator is allowed.

Use a provisional semantic rubric of 0-4 for correctness, grounding, completeness, and usefulness: 0 wrong/unusable,
1 major errors, 2 material omissions or partial correctness, 3 correct with minor issues, 4 correct and appropriately
complete. Case-specific anchors determine what constitutes a material omission. Provisional success requires applicable
correctness/grounding/completeness dimensions at least 3 and no critical failure; calibrate against human task judgments.
Define applicability from the case, not the candidate's response. Keep not-applicable and ungradable scores distinct;
neither becomes a zero or a pass, and incomplete grading cannot approve a release.

### Metric catalogue

| Measure | Method and denominator | Interpretation |
| --- | --- | --- |
| Task success | Prespecified weighted terminal success on the frozen eligible cohort | Includes agent failures; pending with unresolved units |
| Factual correctness | Reference-backed atomic facts plus semantic adjudication | Dates, identities, status, counts, versions, procedural claims |
| Grounding precision | Supported assessed material claims / assessed material claims | Supported by evidence available in that execution |
| Required-fact recall | Correctly covered required facts / applicable required facts | Prevents short answers and abstention from gaming precision |
| Citation validity | Valid current-turn snapshot anchors / emitted anchors | Deterministic structure, not proof of entailment |
| Citation support/coverage | Claim-source entailment and supported cited claims / citation-eligible claims | Semantic source matching and missing citations |
| Quote fidelity | Exact approved-normalization span match plus attribution/context review | Detect fabricated passages, wrong version, misleading ellipses |
| Legislative reasoning | Anchored judge rubric, human audit | Proposal, passage, enactment, effectiveness, applicability, interpretation |
| Clarification | Unnecessary-question rate, missed-needed-question rate, repeated-question rate | Condition on labeled answerability; separate preference and record choice |
| Abstention | Appropriate limitation rate and unnecessary abstention rate | Evaluate against case evidence, not tone or confidence |
| Tool use | Schema validity, cursor/identity provenance, violations, useful calls | Accept multiple valid plans; do not demand baseline's exact sequence |
| Retrieval | Recall/nDCG where judged candidate universe exists; required-evidence discovery | Diagnostic layer, not equivalent to answer success |
| Coverage honesty | Supported exhaustiveness/absence claims and preserved warnings | Partial lists and failed searches must not become universal claims |
| Reliability | Completion, timeout, rate-limit, invalid-output, prompt-fetch failure rates | Operational and model failures visible separately |
| Efficiency | TTFT, end-to-end p50/p95, calls, clarification turns, tokens, cost/success | Count wasted runs and retries; separate evaluation costs |

Do not call the number of retrieved items divided by a reported total 'recall' unless the denominator is a reviewed
relevant-result universe. Citation validity without citations is not 100% grounding; mark it not applicable and apply
required-fact/citation-coverage/answerability measures. Claim extraction itself needs human auditing and versioning.
Report macro task averages and relevant slice metrics alongside claim-level averages to prevent long answers dominating.

Critical failures include fabricated material citations/quotes, wrong-record answers, unsupported enactment/applicability,
successful source injection, secret disclosure, and materially false exhaustive claims. Preserve severity and occurrence
counts; these are not merely a low style score. Use only synthetic secrets in adversarial cases.

Deterministic code evaluates schemas, anchors, exact quotes, allowed tool calls, cursor lineage, and control-flow events.
LLM evaluators assess entailment, relevance, interpretation, completeness, and usefulness. Humans adjudicate high-risk
and ambiguous findings. Never claim that a mechanical check proves semantic correctness.

## 6. Critic, judge, and evaluator validation

Freeze each candidate output before evaluation. Run two separate workflows:

- Astra critic: diagnose concrete failures, with offending span, evidence references, severity, likely cause, and proposed
  minimal remedy. Use failures plus sampled successes; its purpose is improvement, not a leaderboard score.
- Independent Astra judge: grade the frozen answer and visible trajectory against reference facts and stable product
  requirements, initially without critic notes or candidate model/prompt identities. Return applicability, dimension
  scores, critical flags, evidence-backed rationale, and ungradable reasons in validated structured output.

Critic suggestions may produce a new prompt candidate, not a silent repair of the answer being scored. Pairwise judges
compare candidate/baseline A/B with randomized order and ties allowed. Swap order for a balanced subset to measure order
bias. Assess absolute quality too: winning against a bad answer does not mean being correct.

Protect judges from instructions embedded in answers/evidence. Do not send hidden chain-of-thought, ask for it, or reward
reasoning verbosity. Provide the full relevant evidence and explicit completeness flags; missing/truncated evaluation
context makes a score ungradable, not a factual failure. Keep references private from the generation harness.

Calibrate on independently human-labeled outputs, including correct, subtly wrong, incomplete, overconfident, needlessly
abstaining, and malicious examples. Measure task-success confusion matrix, critical-error sensitivity and false-positive
rate, per-dimension ordinal agreement, and pairwise agreement. Report reviewer disagreement and confidence intervals.
Judge self-reported confidence is not a calibrated probability. Do not rely solely on a correlation coefficient.

Provisional calibration targets: 85% task-success agreement and 95% sensitivity on reviewed critical-error examples,
with acceptable false alarms and reported sample counts. These are design targets, not achieved claims. A tiny set cannot
establish them reliably. Test the evaluator with controlled mutations: flip a vote count, change bill identity/version,
remove a caveat, insert a fabricated citation, or preserve meaning while changing prose. A useful evaluator should reject
the factual mutation and remain stable under harmless formatting/paraphrase changes.

Two Astra passes may share biases, particularly when judging Astra candidates. Use human blind review and, if authorized,
a different-family audit judge for disagreements and selected finalists. Recalibrate when evaluator model, rubric,
evidence mapping, or scope changes. Preserve previous scores and add new evaluator-version scores rather than overwriting.

For confirmatory promotion comparisons, require blinded human-confirmed terminal outcomes for every prespecified repeat
in the selected baseline/candidate comparison. Reviewers see the task, references, answer, and needed visible trajectory,
but not configuration identity, critic suggestions, judge scores, or leaderboard position before labeling. Judge-only
outcomes remain screening/monitoring measures, not the confirmatory primary endpoint. A second reviewer independently
checks all proposed critical findings and a preregistered random 25% of the other outcomes, balanced across configurations
and slices. Resolve disagreements through adjudication; unresolved outcome labels keep the comparison pending.

Report human/LLM disagreement by candidate and slice to detect style-dependent judge bias. Estimate power using
human-confirmed pilot outcomes, and perform a preregistered sensitivity analysis for residual human-label error using
double-reviewed disagreement rates and plausible critical false negatives. If plausible misclassification changes the
promotion decision, expand blind review or report inconclusive. Sampling intervals are conditional on the reference/rubric;
they do not certify perfect human truth. Calibration accuracy targets alone do not bound candidate-dependent scoring bias.
Price this human review before confirmation; lack of review capacity is not permission to switch the primary endpoint
back to unvalidated judge scores. A future lower-cost audit-adjusted endpoint requires a separately reviewed measurement
study with validated sampling, error correction, and uncertainty propagation before use for promotion.

Use OpenRouter through the Legislation workspace for candidate application inference and automated critic/judge
evaluations, including Astra. Configure a server-side OpenRouter LLM connection
in Langfuse for supported hosted evaluators. For full-agent experiments or custom critic/judge orchestration, call
OpenRouter from the evaluation runner and record runs and scores in Langfuse. Verify the connection and model support
before enabling jobs; keep credentials server-side, pin evaluator configurations, and account for evaluation spend
separately from candidate inference.

## 7. Separate controlled experiments from live behavior

| Mode | What stays fixed | What it establishes |
| --- | --- | --- |
| Fixed-evidence synthesis | User request, available passages, evidence IDs/context | Prompt/model answer quality, not autonomous retrieval |
| Frozen-world agent | Read-only data/index snapshot, tools, limits, scripted user response policy | Planning, evidence discovery, clarification, full answer |
| Live canary | Application configuration; record exact observed data and timestamps | Current integration/availability; cannot isolate historical data drift |
| Production monitoring | Sampling policy, evaluator definitions | Emerging failure rates and traffic changes, not causal model effects |

Execute the same core agent implementation as chat, with injectable prompt, model, tools, and capture adapters. Do not
build a simpler evaluation-only agent. Isolate clarification/result stores per case, and simulate realistic follow-up
answers with reviewed response policies that never reveal hidden reference facts. Unexpected clarification is scored as
behavior, not answered with oracle knowledge. Keep renderer/browser checks separate for clickable citations and controls.

For frozen-world tests, prefer a fixture-backed query service or isolated read-only database/index snapshot. If using tool
recordings, match tool name and normalized arguments; never feed sequential baseline responses to unrelated calls.
Support alternative valid plans and pagination. Missing fixtures are explicit harness-coverage gaps, not empty results,
model failures, or permission to query live data. A harness covering only baseline tool plans cannot fairly rank models.

Retain the search universe needed for the case, documents/versions, relationships, filters, ordering, index/embedding
configuration, and warnings. A handful of final snippets cannot reproduce discovery. Regenerate run-local citation IDs
and validate claims against those IDs instead of hardcoding golden UUIDs.

## 8. Reproducibility manifest

Every run records dataset version/timestamp plus item/schema hashes; corpus/index and tool-schema hashes; prompt name,
numeric version, resolved text/config digest; requested/resolved model and provider; reasoning/sampling/output settings;
fallback policy; source revision and dirty-patch/build digest; runtime budgets; harness/evaluator versions; concurrency,
cache conditions, case-family/repeat IDs; execution time; actual inputs, outputs, visible tool events, status, and cost.

Pin the label once before execution. Do not read 'production' or 'latest' separately for each case. If a model/provider or
old evidence is unavailable, mark historical reproduction unavailable instead of silently substituting. The same effort
name across models is not equivalent compute; report both quality within the product envelope and observed cost.

Use stable brand-neutral dataset names in the legislation Langfuse project: `legislative-research/development`,
`legislative-research/holdout`, and `legislative-research/regressions`. Use tags/manifests for smoke and risk membership,
with shared case IDs to avoid duplicate counting. Version references and dataset schemas as well as dataset items.

## 9. Experimental design and statistical decisions

Start with repeated baseline runs using prompt version 1 and the current model configuration. Estimate failure rate,
variance, disagreement between configurations, latency, and cost before selecting a broad experiment budget.

| Cell | Prompt | Model | Question |
| --- | --- | --- | --- |
| A | Baseline | Current | Control |
| B | Candidate | Current | Prompt effect |
| C | Baseline | Candidate | Model effect |
| D | Candidate | Candidate | Combined effect and interaction |

Hold data, schemas, runtime, evaluator version, routing, and output budgets fixed. Randomize/interleave execution order
to reduce service-load/cache bias. Record and separate prompt-fetch latency, generation TTFT, and tool time. Do not
attribute a routing, data, or code change to a prompt change.

Use one repeat for screening and at least three for finalists, increasing based on measured stochastic variance. Do not
report best-of-three unless best-of-three is the actual product policy and its full cost is counted. Repeated runs do not
replace diverse cases. At 60 tasks, four cells, and three repeats there are 720 task executions, potentially many model
calls each, before critic/judge costs. Begin with smoke and a priced pilot.

Predeclare the primary metric, meaningful gain, noninferiority margin, candidate comparisons, analysis, and stopping rule.
Use paired task deltas, win/tie/loss, confidence intervals, and critical-regression counts. Bootstrap at the independent
task/source-family level while keeping repeats together; use an appropriate paired binary analysis for task success.
Report per-stratum effect sizes and denominators. Many simultaneous slice/model comparisons require multiplicity control
or clearly exploratory labeling and a fresh confirmatory holdout. Do not repeatedly peek and stop at a favorable score.

For a single preregistered finalist comparison, let `[L, U]` be the two-sided 95% confidence interval for the weighted
paired success difference, using a design-aware clustered analysis that retains repeats together. If confirming several
contrasts, preregister a simultaneous-interval or family-wise correction over that set and apply the same correction to
the gates. Default confirmation submits one selected candidate to a fresh cohort once; development results select it.

Quality gate: require both point estimate `Delta >= g` and `L > 0`, initially proposing `g = 0.05`. This supports evidence
of improvement with an estimated practical gain; it does not establish that the true gain is at least `g`. That stronger
claim requires `L >= g`. Cost-switch gate: require `L > -m`, initially proposing `m = 0.02`, plus upper confidence bound
on the candidate/baseline total cost-per-success ratio below `1 - b`, where `b` is a minimum meaningful saving fixed with
the product owner before testing. Include failed inference, retries, and tool costs in that cost measure; evaluator/human
review costs are reported separately. Undefined costs or no baseline successes make the cost-switch gate ungradable.
Absolute hazard, coverage, and operational gates apply to both paths. No optional stopping or after-the-fact path choice.

Plan sample size using pilot discordance and the minimum effect worth shipping. For illustration only, with independent
pairs, approximately 20% discordance, a 5-percentage-point effect, 80% power, and two-sided 5% significance, a rough paired
binary approximation needs about 630 pairs. Clustering, multiplicity, or smaller effects can require substantially more.
The 60-case pilot cannot credibly establish small gains or a tight 2-point noninferiority margin. Use a proper power
calculation/simulation after pilot estimates, not this approximation as a release rule. In particular, the 630-pair
illustration concerns rejecting zero effect, not the joint practical-gain rule above. Simulate the actual chosen release
inequalities, weighting, family clustering, repeat variance, human-label sensitivity, and multiplicity. Design alternatives
must reflect that a point-estimate threshold at the true effect does not itself have 80% probability of passing.

Zero observed severe errors does not mean zero risk: with zero errors in n independent representative trials, the rough
95% upper bound is 3/n. At n=60 that is about 5%; challenge-set results also do not estimate production prevalence.

Agent timeouts, invalid outputs, and unrecovered tool failures remain in end-to-end failure denominators. Separately
report quality among completed tasks. Harness errors and judge outages are ungradable/infrastructure failures, not passes
or evidence of model superiority. Apply the bounded recovery and frozen-cohort accounting in section 5; do not silently
replace failed agent attempts or remove unresolved units to obtain a favorable comparison.

## 10. Fast iteration without benchmark overfitting

1. Inspect development failures; critic identifies a specific mechanism and proposed prompt change.
2. State a falsifiable hypothesis, affected coverage slices, and expected tradeoff. Example: explicit skipped-question
   handling reduces repeat clarification without increasing guessed bill selection.
3. Make one coherent prompt change; store it as a new immutable Langfuse version, not a production-label move.
4. Run deterministic contracts and the relevant development slice, then the cross-domain smoke set to catch spillover.
5. Run the full development set and repeated finalist comparison only when the cheaper checks support the hypothesis.
6. Submit the selected candidate to a sealed confirmatory set, review critical regressions, then run a small live canary.
7. Human approval promotes the prompt/model configuration; retain the prior version for rollback.

Keep a hypothesis ledger of tested changes, expected effects, actual slice deltas, uncertainty, regressions, and decision.
Test ablations occasionally to identify instructions that add tokens without demonstrated benefit. Do not optimize directly
against judge wording or add benchmark-specific answers to the system prompt. Once holdout examples inform tuning, move
them into development and replenish a genuinely sealed set. Reserve periodic fresh time-based cohorts for generalization.

Treat any holdout disclosure, including aggregate scores or pass/fail decisions, as access that can influence future
selection. Maintain an access ledger of candidate, cohort, recipient, disclosed results, and subsequent decisions. The
default is one confirmatory submission to fresh independent task/source families after development selection; any further
adaptive candidate uses a new confirmation cohort. Used cohorts can join the cumulative regression set, but are no longer
fresh confirmation evidence. Reusing a holdout for inference requires a prospectively justified sequential/reusable-holdout
policy controlling the entire access history, not just the latest experiment. Hiding answers alone does not prevent leakage.

## 11. Continuous collection and honest backtesting

Collect random ordinary traffic plus separate enriched samples of errors, corrections, negative feedback, novel tasks,
and high-risk behavior. Record sampling probability and session family. A suggested starting policy is deterministic
checks on all eligible captured turns, judge scoring on 10% of normal traffic plus flagged cases, and human review of all
critical candidates plus random passes. Rates and spend caps require approval and pilot calibration.

Collection workflow: captured -> redacted -> deduplicated -> reference-reviewed -> approved -> assigned to an appropriate
split. Track source observation, evidence capture completeness, exclusion reason, owner, and reference revision. Retain
representative successes as well as failures; otherwise apparent benchmark quality becomes progressively incomparable.

Backtesting means three different things; label them separately:

- Historical rescoring: run a new evaluator over old outputs. Measures evaluator drift, not new model/prompt quality.
- Frozen-world re-execution: run new and baseline configurations on historical inputs/evidence. Measures regressions.
- Current-data re-execution: answer old questions using today's records. Measures current usefulness, not historical truth.

Every approved replayable regression case stays eligible for cumulative release testing. During iteration run targeted
slices and smoke; before promotion run all eligible collected regression cases in budgeted resumable shards. Publish
counts by executed, passed, failed, ungradable, and excluded. Do not quietly retire hard cases or compare averages over
different populations. Pair baseline/candidate on newly added cases; maintain a fixed-cohort trend beside the growing set.

No preserved historical evidence means no defensible historical replay. Mark the case unavailable for that mode; retain it
for current-data testing or human review. When a factual reference changes, version it and regrade both baseline and
candidate. Cache deterministic grading by complete content/version digest, but never use cached generations to fake
independent repeated trials. Removed/expired model endpoints make runs non-reproducible, not equivalent to a successor.

## 12. Langfuse, capture, and privacy

Use Langfuse for versioned prompts, dataset membership, experiment comparisons, observation scores, and human queues.
Emit a logical root observation per agent turn and session-level linkage for task aggregation, with prompt/model versions,
final output, termination, and the relevant evaluation bundle. Link generation/tool observations and dataset-run items.
Keep online evaluator rules away from evaluator-generated observations to prevent recursive scoring.

Langfuse observation evaluators do not automatically read sibling/child observations. Supply an explicit complete redacted
evaluation bundle on the root, or use an external runner that hydrates approved artifacts and submits scores. Merely
providing a trace ID is not sufficient. Use observation-level rules, not deprecated trace-level evaluation.

Do not disable existing sanitization globally. Store replay artifacts in access-controlled storage with digests and safe
Langfuse references; retain completeness flags and protect quotes needed for audit. Secrets, authorization headers, sensitive
URLs, and unnecessary private user data must not enter fixtures or evaluator input. Public legislative identities may be
necessary evidence; private user identities generally are not. Define redaction, access, consent/opt-out, retention,
deletion propagation, and external evaluator data-use policy before production capture. Suggested initial raw sample
retention is 30 days, with longer retention only for approved minimized regression artifacts under a reviewed policy.

## 13. Promotion and monitoring

Proposed release policy, to calibrate after measuring baseline:

- Required coverage floors and all critical deterministic contracts pass. All primary outcomes are human-confirmed and
  observed. Critical regressions are reviewed, and absolute hazard criteria below pass independently of baseline behavior.
- Apply exactly the quality-improvement or cost-switch inequalities preregistered in section 9; report inconclusive when
  evidence is insufficient, regardless of the judge's preferred candidate. No unreviewed change of endpoint or margin.
- No unacceptable regression on predeclared high-risk slices. Define per-slice margins and latency/cost SLOs from product
  needs and baseline before comparison; insufficient required-slice evidence is pending, not proof of non-regression.
- Human release review checks references, measurement sensitivity, and risk before a bounded live canary. No automatic
  production-label promotion follows a judge verdict.

### Absolute risk and live canary

Before confirmation, a domain/risk owner approves a hazard register with severity, release-scope applicability, detection
method, absolute acceptance criterion, exposure/review floor, residual-risk disposition, and rollback action. Existing
critical failures in the baseline remain blockers if reproduced by the candidate: document the issue, fix/restrict the
affected behavior and reevaluate. Unchanged dangerous behavior is not acceptable merely because it is not a new regression.
For designated zero-tolerance observed hazards, any confirmed candidate occurrence blocks promotion. The absence of an
occurrence in a challenge suite establishes only passage of those cases, not a zero production risk claim.

Where a production prevalence ceiling is required, preregister its value and a one-sided upper confidence bound for
hazard rate under the representative sampling/cluster design, then require the bound below that ceiling. Account for
unreviewed detection error through blind audit; unknown detection sensitivity cannot establish a low risk rate. Hazard
ceilings and any simultaneous-confidence adjustment must be approved before testing. Challenge counts cannot substitute
for representative exposure. If required precision is infeasible, do not claim the guarantee or promote that scope without
meeting the gate; redesign safeguards/scope and the confirmation plan prospectively.

The canary manifest fixes its traffic fraction, minimum duration and independent task exposure, required risk-slice
counts, random human-review quota, capture/scoring completeness floor, operational SLOs, and scheduled decision points.
Set the values from risk and pilot capacity with owners before enabling traffic. It also fixes immediate rollback for a
confirmed zero-tolerance hazard and the response to SLO breaches; ordinary statistical alarms use a prespecified sequential
rule or fixed exposure decisions. Expand only after all exposure, review, absolute-risk, and operational gates pass.
Insufficient exposure, lost capture, incomplete required grading, or uncertain risk yields pending: hold expansion or pause
the canary rather than declaring success. Recheck within the bounded canary budget or stop; do not run until a favorable
result appears. These prelaunch values are prerequisites, not unknown defaults an implementer may select after results.

Dashboard: task success with intervals; risk counts/severity; coverage matrix; correctness/grounding/completeness;
clarification and abstention errors; operational failures; p50/p95 latency; inference/tool/evaluation cost separately;
cost per successful task; largest per-case improvements/regressions with evidence. Always show model/prompt/data/evaluator
versions, cohort/mode, sample size, and missingness. Alert on critical events quickly; ordinary score drift needs minimum
sample size, stable cohort/sampling context, and a predeclared repeated-monitoring policy to avoid noisy daily alarms.

## 14. Implementation milestones

| Order | Deliverable | Done when |
| --- | --- | --- |
| 1 | Shared injectable agent runner and immutable manifests | Same behavior as chat; exact prompt/model/data identity recorded |
| 2 | Privacy-safe capture and frozen query worlds | Alternative valid tool paths and multi-turn clarification replay correctly |
| 3 | 12-case smoke, then 60-case pilot | Reviewed references, coverage tags, grouped splits, no answer leakage |
| 4 | Deterministic checks and separate calibrated Astra critic/judge | Structured results, mutation tests, human calibration and Legislation OpenRouter connection verified |
| 5 | Repeated baseline and power/cost analysis | Counts, variance, failures, timing, and costs measured without cherry-picking |
| 6 | First prompt/model factorial comparison | Matched report, uncertainty, risk review, explicit promote/reject/inconclusive decision |
| 7 | Continuous sampling and cumulative backtests | New reviewed cases replay; drift and coverage gaps visible; budgets enforced |

Assign an engineering owner for execution/data integrity, a domain/risk owner for references and hazard acceptance, and a release reviewer. Start
with the first three milestones before scheduling expensive model comparisons. Obtain explicit spend and privacy decisions
and verify the Legislation OpenRouter evaluator connection before unattended jobs. Before confirmation, approve the population/coverage manifest, human-review
capacity, hypothesis and exact statistical gates, absolute hazard criteria, fresh holdout allocation, and canary manifest.
Unresolved prerequisites block the corresponding stage; they do not prevent building the diagnostic harness and pilot.

Keep paid evaluations separate from ordinary Vitest, editor saves, and default verification. Use explicit commands and
approved CI triggers with bounded concurrency, spend estimates/caps, cancellation, and resumable outputs. Fast deterministic
checks can run in CI without inference. A cancelled or incomplete experiment cannot approve a release. This prose plan
does not require executable tests or a repository-wide verification run.

## 15. Judge review record

Two separate GPT-6 Astra Copilot subagent reviews assessed the full document using the same acceptance rubric: population
and coverage, ground truth and measurement, denominators, statistical inference, replay/privacy, release gates, and staged
feasibility. No empirical agent experiments were used for these reviews.

Round 1 verdict: REVISE. Round 2 verdict after the substantive amendments: ACCEPT, with all seven blockers closed and no
new blockers. The judge explicitly limited acceptance to readiness to guide implementation subject to prerequisites.

| Finding | Incorporated correction | Round 2 result |
| --- | --- | --- |
| AS-01: population and coverage ambiguity | Frozen sampling frame, weighted task estimator, independent-family coverage floors and scope gates | Closed |
| AS-02: judge error can imitate small gains | Blinded human-confirmed primary outcomes, independent review and label-error sensitivity | Closed |
| AS-03: retries and missingness distort denominators | Frozen outcome units, bounded infrastructure recovery, pending full-cohort result | Closed |
| AS-04: multi-turn completion ambiguity | Terminal predicates, scripted branches, session limits, one outcome per repeat | Closed |
| AS-05: ambiguous promotion and power targets | Exact improvement/noninferiority inequalities and power for the actual decision rule | Closed |
| AS-06: score-only holdout reuse | Access ledger and fresh confirmation cohorts for adaptive submissions | Closed |
| AS-07: relative gains can preserve absolute hazards | Independent hazard acceptance, baseline-failure disposition, bounded canary gates | Closed |

Outstanding stage prerequisites remain: named owners; reviewed references and sampling/coverage manifests; human-review
capacity and budget; a preregistered statistical protocol; absolute hazard criteria and SLOs; fresh holdout allocation;
canary exposure/review/rollback values; privacy approval; and a verified Legislation OpenRouter connection for unattended judges.
These require owner decisions and pilot evidence where specified, not further prose scoring until a preferred verdict.

## References

- [Langfuse evaluation overview](https://langfuse.com/docs/evaluation/overview)
- [Datasets and versioning](https://langfuse.com/docs/evaluation/experiments/datasets)
- [LLM judges and observation context](https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge)
