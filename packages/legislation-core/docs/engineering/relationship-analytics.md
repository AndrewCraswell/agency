# Relationship analytics

## Goal

Answer relationship listings, comparisons and rankings through bounded database queries, not model-side pagination
and counting. PostgreSQL remains authoritative. GraphQL and a second graph store are not required.

## Inventory and boundaries

The canonical schema contains jurisdictions and sessions; people, aliases, external identifiers, service terms and
organization memberships; organizations and their hierarchy; bills, sponsors, actions, committee links and related
bills; structured amendments, amendment actions and amendment relations; votes and individual positions; meetings,
participants, agendas, calendars and explicit outcome links; bill documents and supporting publications; legal codes,
editions, provisions and regulatory publications. Search vectors, embeddings and passage copies are derived indexes,
not additional records to count. Ingestion history and checkpoints describe collection, not legislative activity.
Subscriptions, webhook credentials, account records and operational internals are outside public research.

Legal publication metadata and text retain their existing authorization and publication gates. Analytics must not
create an alternate route around those gates. The first public catalog covers canonical civic records; protected
legal research remains on the existing authorized tools until equivalent analytic visibility rules are available.

The September 17, 2026 canonical database inventory used `pg_stat_user_tables` estimates, not an asserted full census:
approximately 1.53 million bills, 1.35 million sponsorships, 1.15 million votes, 48.38 million positions, 38,832 structured
amendments, 12.62 million actions, 4.48 million documents, 288,919 supporting publications, 36,151 meetings, 56,624
memberships and 20,288 people. Calendar, amendment-relation, meeting-outcome and several agenda relationship tables
were empty. The public catalog exposes 30 civic datasets; it does not expose private tables or protected legal stores.

## Tools

- `describe_analytics`: discover public datasets, their fields, supported relationship paths and counting semantics.
- `analyze_legislation`: select relationship rows or aggregate them, filter facts, group, calculate distinct counts
  and conditional rates, filter aggregated results and order a bounded result window.

Inputs are strict typed JSON. A registry owns every table, column and permitted relationship. The compiler accepts
no SQL, arbitrary identifiers, expressions or functions. Values are bound parameters. Joins are bounded in depth and
number; result size, offset, input size and statement execution time are capped. All execution is read-only.

Counts are distinct at the selected identity grain, including composite relationship identities. Multiple one-to-many
joins must never inflate a count. Rates expose their numerator and denominator; zero denominators produce null.
Ranking covers the full filtered database population before applying the output limit. Stable secondary ordering
makes tied results deterministic; the result states that a limit can cut a tie. List windows are not a complete census.

## Meaning and evidence

Primary sponsorship and cosponsorship are separate. Explicit abstentions, absences, present and not-voting remain
separate. Amendment records and amendment-format documents are not interchangeable. A collection timestamp is not
an effective or legislative event date. Unknown person links remain unknown, never a fabricated person or a zero.
Session and jurisdiction are explicit filters; the model resolves ambiguous identity and current-session scope using
the existing discovery tools. Unknown active status must not be inferred from a session label.
Exact person/organization name filters require resolution to a canonical ID; this prevents inverted publisher names
from silently yielding a false zero. Literal substring discovery remains available but does not establish identity.

Every result retains the normalized query, dataset grain, returned window, execution time and a coverage disclaimer.
Rows expose canonical identifiers and source URLs when selected. Aggregate claims describe the stored population,
not universal coverage. Exact counts are not evidence that upstream collection is complete. A query receipt supports
reproduction and drilling into contributing records; it is not an invented publisher citation.

## Telemetry

Telemetry covers compilation, execution and serialization with the normalized query hash, dataset, paths, joins,
window, elapsed time, row count and bytes. Langfuse observations inherit the active chat trace; Sentry spans inherit
the HTTP trace and retain request correlation. Failures include stage, category and PostgreSQL code without raw SQL
or database messages. Inputs use the shared credential sanitizer; full result rows are not copied into diagnostics.

## Acceptance

Freeze 100 natural-language questions spanning the available public data and query operations before the LLM run.
Each case has independently authored SQL and counting-grain expectations. The LLM receives the natural-language
question and production tool schemas/catalog, never the reference SQL, metric expectations or answer. Execute its actual tool calls and
retain plans, outputs, answers, token usage, latency and errors. Compare identities, counts, filters, ranking and rates
against the oracle on the same database snapshot where possible; record drift explicitly otherwise. Do not accept
an empty result as meaningful coverage of a positive case. Unsupported scope must be reported, not guessed.

Use the configured Luna model with low reasoning effort. Do not change production model settings or rejudge existing
benchmarks. Keep this new acceptance run separate from prior experiments. Compiler and integration tests cover
injection, invalid paths, fan-out, nulls, ties, denominator semantics, limits and read-only enforcement. Exercise the
chat workflow in the integrated browser and run focused checks followed by the required repository verification.

From W, run `pnpm tool agent/evaluate-analytics --references` for independent SQL checks, or
`pnpm tool agent/evaluate-analytics` for the full LLM run. `--case analytics-023` selects a focused rerun and
`--output <directory>` selects an ignored artifact directory. Each run writes a manifest, 100 case records when
unfiltered, and a summary. Question/source/tool-schema hashes, exact plans, responses, snapshot IDs and failures
are retained. Reference SQL has a 60-second offline deadline; production analytics remains at the configured
15-second database deadline. Each case uses one repeatable-read, read-only snapshot for reference and tool queries.
Two cases run concurrently, each with at most eight model steps and 12 tool calls. The acceptance response format
adds structured rows and a short receipt ID for comparison; it is not a production prompt-label change.

Alias-only differences remain distinct from strict passes. Equal values with a wrong identity grain fail. Fabricated
citation anchors in the acceptance answer fail because this tool-only harness issues no citation snapshots. Empty
and all-zero cases require plan review, not a claim of positive data coverage. Date-only values stay date-only.
Ranking questions retain zero relationship counts unless explicitly restricted. No new database indexes, data
repairs or external configuration changes are performed by this runner.

`--replay <run-directory>[,<later-run-directory>]` reexecutes exact retained LLM plans and compares their unchanged
answers with independent SQL on the current snapshot. Later directories replace earlier cases explicitly; provenance
is retained as `originalSessionId`. Replay is not new LLM inference and is not a first-pass accuracy measurement.
`case-report.json` contains all selected questions and separate row, grain, scope, identity and citation results.
Retained answers that matched their original independent reference but differ from a current matching tool/reference
pair are flagged as source-data drift and remain strict mismatches.

## September 17 validation

This feature is implemented but **does not yet meet the requested all-100-questions-passing acceptance criterion**.
The five failures remaining after the follow-up work now pass the focused fresh run documented under
[Five-case repair](#five-case-repair). That result does not retroactively change the earlier 100-question runs.

- First full Luna run `4c99edd7-4736-48b1-a555-64d1cbae79dd`: 100 completed, 80 strict matches. This early validator
  had date-only conversion and two zero-count ranking oracle defects, subsequently corrected without changing questions.
- Second full Luna run `4a56c9ad-e02a-4626-bcf9-48d56c41566d`: 100 completed, 93 strict matches with the then-current
  validator. Later manual plan review identified additional coincidental passes and added scope-owner/identity checks.
- Final current-code replay `423beeca-bae8-4148-a8a1-4604c6f1d823`: all 100 latest retained LLM plans executed,
  96 exact current-answer matches, no unresolved execution failures. Cases 065 and 066 have independently confirmed
  source drift: version-document counts changed from 39,523 to 39,526; both current tool queries match current SQL.
  Drift confirmation is `7f41a356-7fbd-4d89-9d8d-bdf3e70f5501`. Do not report these as a 100/100 fresh LLM pass.
- Case 064 remains incorrect: the model excludes zero-count bills despite the acceptance ranking convention. Case
  070 remains incorrect: the model scopes amendments instead of the requested bills; equal present counts do not pass.
  Targeted reruns are retained, including regressions, rather than selecting only successful samples.

Artifacts are under ignored `tmp/analytics-acceptance` at the repository root. The final 100-row report is
[case-report.json](../../../../tmp/analytics-acceptance/423beeca-bae8-4148-a8a1-4604c6f1d823/case-report.json).
Each case retains the question, independent SQL result, snapshot, LLM answer, exact calls and validation flags.
Cases 015, 022, 035, 036, 045, 053, 054, 062, 063, 078 and 099 were reviewed as empty/all-zero cases; their plans
do not establish upstream completeness. The 30-dataset catalog is broader than the 100-case corpus, which focuses
on populated federal data and Alaska meetings; this is not exhaustive acceptance for every relationship combination.

The normal chat workflow was exercised in conversation `4dka2aKK64taAVfQ`: a top-five primary-sponsor ranking used
four research calls, including one aggregate query. Desktop 1280px and mobile 390px rendered all five rows without
page overflow; keyboard activation of research activity exposed the new labels. Fluent content guidance was reviewed.
No production model or hosted prompt label changed. The acceptance harness uses the production Luna model and prompt
plus explicit structured-output/evaluation instructions, so its success rate is not an unmodified-chat accuracy claim.

Langfuse receipt `8d8ab65427c0c308` records the live chat execution (281ms); `aa44551082ec7c3e` records a database
timeout with the failed plan/hash; `467203f76a88266e` records serialized row count and result bytes. Unit/exporter tests
cover correlation isolation, secret redaction and compiler/execution/serialization failure stages. Sentry export was
verified in tests; a hosted analytics Sentry error receipt was not independently checked.

Focused verification passed 48 core tests with coverage, 16 web tests, 45 MCP tests and six read-only PostgreSQL
fixture tests covering fan-out, position/vote distinction, null groups, zero denominator, pagination and deleted meeting
links. `pnpm verify` passed formatting, lint and types before failing on unrelated Knip findings (64 files, root
dependencies/binaries and a legal-route export), so full-repository coverage did not run. No commit, staging, database
index build, data repair or deployment was performed. Cold-cache aggregate timeouts occurred; warm replay is not a
latency guarantee. The recorded query plans are the starting point for any separately approved index rollout.

## Follow-up validation

The resumed work did not achieve 100/100. Results below supersede the earlier status, without replacing historical
failures or weakening their checks.

- Moved population-versus-measure guidance into the tool parameter schema. The unchanged 064/070 targeted run
  `6253ba5b-9f9b-4ed0-99f8-d7d9c4149eb0` matched both questions, but the broader run still showed model regressions.
- Fixed a concrete SQL performance defect: joining independently aggregated groups with `IS NOT DISTINCT FROM`
  could force quadratic nested loops. Equality on structural JSON group keys permits hash joins while preserving
  null groups. The exact previously timed-out plan completed in 1,616ms under the same 15-second deadline.
- Positive single-count `HAVING` requirements now permit predicate pushdown; unrestricted zero-count groups are
  preserved. Seven real-PostgreSQL read-only fixture tests pass, including both branches of that optimization.
- Fresh full Luna run `f8968ebd-ef5e-4b70-b3b5-9e82e8fcb764`: all 100 questions completed, 87 strict matches,
  13 mismatches, no unresolved execution failures, and no source-data-drift flags. This was fresh inference, not
  replay. It used 434 tool calls in total (median 4/question, maximum 8). Successful analytics statements had a
  median of 248ms and p95 of 2,340ms; 11 analytics calls failed before recovery, so these are not cold-cache guarantees.
- One corrective pass over all 13 failures, `7dc454c4-d076-4491-ad08-5c19de6a7b50`, matched 8 and failed 5.
  Remaining cases: 012 returns the canonical person's name instead of the published sponsorship label; 023 uses
  a different metric label; 054 introduces an extra helper aggregate rejected by the strict metric contract;
  066 retains a zero-count null document-classification group; 070 scopes amendments instead of bills.
  These outcomes are not a new 95/100 single-run success rate. Do not resample until a passing set can be claimed.

The fresh run's full question/plan/output report is
[case-report.json](../../../../tmp/analytics-acceptance/f8968ebd-ef5e-4b70-b3b5-9e82e8fcb764/case-report.json).
The corrective report is
[case-report.json](../../../../tmp/analytics-acceptance/7dc454c4-d076-4491-ad08-5c19de6a7b50/case-report.json).
Remaining work needs a more reliable population/measure planning contract and an explicit decision about which
output-format constraints are meaningful acceptance requirements; more wording changes alone have not demonstrated
consistent correctness. No model, reasoning-effort, prompt-label or database-index change was made.

Hosted Sentry is now verified: event `b4e196599cf74c0da7aa838d5b5f6800` in
[LEGISLATION-14](https://legislation.sentry.io/issues/LEGISLATION-14) contains compiler-stage `invalid_request`,
input context, stack and correlation `analytics-b42c0a37-compiler-probe`. It was a deliberate no-SQL acceptance
probe; the issue was resolved afterward with that explanation. Langfuse timing/plan receipts remain available.

Browser checks found a concurrent integration change had moved catalog discovery onto the service while the running
port-3000 application retained an older cached instance. Two shared-runtime attempts therefore failed before SQL.
The current source implements the method; an ignored isolated app snapshot on port 3017 confirmed catalog and
analytics availability. Conversation `M9xzYH8wF9iwja8L` still declined to present the all-zero ranking. Both 1280px
and 390px layouts had no page overflow, but the requested end-to-end answer acceptance did not pass. The isolated
server was stopped; the user's port-3000 server was not restarted or killed.

Current core/web type checks and scoped lint pass. Shared compiler/registry tests pass 34 tests; web analytics,
telemetry and research tests pass 16, with a worker-shutdown timeout reported after the latter pass. The latest
`pnpm verify` log is `tmp/analytics-resume-final-verify-b42c0a37.log`: the earlier Windows formatter locks cleared,
but concurrent composition/result-storage lint failures and a remote `origin/main` fetch block the global gate.
Those unrelated files were not changed. No staging, commit, push or deployment was performed.

## Five-case repair

Fresh Luna run `1249d572-99c7-41bf-a938-6efa1773a657` executed the unchanged questions 012, 023, 054, 066 and 070:
**5 passed, 0 mismatches, 0 tool failures**. Each answer and generated query was checked against independent SQL
within the same read-only repeatable-read snapshot. This is focused acceptance, not a new 100/100 result.

- Catalog field descriptions distinguish a published sponsorship label from `person.name`, and bill session from
  amendment session. The fresh 012 result retained `Rep. Arrington, Jodey C. [R-TX-19]`; 070 filtered the bill session.
- Child-only grouping now requires an actual child identity when every measure also belongs to that child path.
  Missing documents do not create a phantom null-classification group. Real documents with an unknown classification
  remain in a null group, and zero-child parents remain eligible when the parent is the grouping entity.
  The population decision is made once for the complete query and propagated to all metric branches, including
  queries that mix parent and child counts.
- The acceptance validator maps declared metric aliases by counting grain and conditional predicates, never by equal
  numbers alone. Wrong vote categories and position-versus-vote counts remain failures, including when values are zero.
- A declared existence helper is accepted only with its expected counting grain and predicates, exactly `>= 1`, and
  no use as a ranking or rate metric. Requested values remain independently checked. Wrong classifications, thresholds,
  unused helpers, duplicate alias candidates and alias collisions are rejected.

The fresh five answers also matched the original literal field names and values. Case 054 used a valid document
existence helper; its empty result was checked against the exact positive-count predicates and bill-session scope.
An earlier focused run `40ba0c0e-7c6c-4d28-bd2a-fc0cdce9199d` also passed all five without needing a helper exception.
Replaying the previously rejected but semantically valid 023/054 plans
in run `a62730b5-9548-4c38-9489-82d6558cbc8c` separately verified the validator corrections without new inference.
Historical artifacts and question wording were not overwritten. New manifests include the semantic-check source hash,
and case records retain raw exact-row flags separately from accepted aliases and helpers.

Reports: [fresh five cases](../../../../tmp/analytics-acceptance/1249d572-99c7-41bf-a938-6efa1773a657/case-report.json)
and [retained-plan validation](../../../../tmp/analytics-acceptance/a62730b5-9548-4c38-9489-82d6558cbc8c/case-report.json).
Case 054's empty intersection was reviewed against the explicit document classification, structured-amendment
existence and bill-session filters; it remains a local-data result, not a source-completeness claim.

Verification: nine semantic-validator tests and eleven real-PostgreSQL fixture tests pass, including differing source
names, cross-session records, real null classifications and missing children. Core/web types and scoped lint pass.
Normal chat conversation `NIk1x1E13hjJTj6x` returned the exact published name in five research steps; desktop 1280px
and mobile 390px had no page overflow and keyboard-operated research activity. No UI styling or production prompt,
model, reasoning setting, database data or deployment was changed.

The required repository gate log is `tmp/analytics-five-handoff-verify-b42c0a37.log`: format, lint and types passed,
but unrelated Knip findings still block full coverage. No staging, commit or push was performed.