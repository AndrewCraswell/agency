# Canonical embedding evaluation candidates

Recorded September 16, 2026. This is a pre-freeze candidate inventory for EVAL-02, not a completed evaluation or a
representative release corpus. [Candidate identities and hashes](embedding-corpus-candidates.json) bind 44 complete
canonical versions to 237 common passages: 137 development and 100 held-out candidates. Both pinned tokenizers qualify
every version; the largest common input is 1,122 tokens. No provider calls, canonical writes or index/vector writes occurred.

| Cohort | Development versions | Held-out candidate versions |
| --- | --- | --- |
| Current prose | 5, Title 29 | 5, Title 8 |
| Current tables | 5, Title 29 | 3, Title 8; 2, Title 20 |
| Historical versions | 4, Title 5 annual/current pairs | 4, Title 6 annual 2023/2024 pairs |
| Proposed rules | 2 substantive proposals and 2 meeting-notice distractors | 2 |
| Final rules | 2 substantive final rules and 2 correction/deviation distractors | 2 |
| Notices | 2 | 2 |

Selection used source metadata, size and shape before retrieval scores. The initial current/code candidates were bounded to
1,000–12,000 source characters; publication candidates to 1,000–64,000. Expansion preserved the qualified 26-version
inventory and added 14 complete current versions from source-length quantiles through 32,000 characters. Title 8 had
only three table versions within that range, so two Title 20 tables complete the held-out table quota. Held-out source
bodies were processed automatically, not read for query writing or tuning. Publications came from singleton groups without
family metadata warnings. Each complete selected version was exported through the canonical code/publication CLI,
binding published membership or observation, version/content identity and active rights. No candidate failed preparation.
Existing packets were reused only when selection identity and the complete evidence hash matched.

An independent local audit checked packet evidence hashes, source/context identity, passage-manifest hashes, full-body
reconstruction hashes, exact input hashes, both qualification results and token limits. The committed JSON contains
metadata only. Full inputs remain in ignored `artifacts/regulatory-backfills/evaluation-candidates/<version-id>.json`.
Publisher artifact replay remains a separate gate; a canonical snapshot is not proof of replaying original source bytes.

## Rejected initial selection and replacements

The first deterministic selection exposed two problems before freeze:

- Four historical pairs had different canonical hashes but identical normalized words. Changes to stored structure alone
  are insufficient for questions about changed rules. Replaced all four pairs using different normalized wording hashes;
  development history moved from Title 2 to Title 5 because the bounded Title 2 pool lacked two qualifying pairs.
- The four shortest notices shared substantial boilerplate across the proposed splits. Their cross-split five-word-shingle
  Jaccard scores were 0.635–0.667. Replaced both held-out notice candidates with the next bounded candidates below the
  0.5 cross-split screening threshold.

The replacement inventory has no identical cross-split input hashes and no cross-split pairs above that screening
threshold. Four similar pairs remain within their assigned split, including historical versions intentionally kept
together. This automatic screen uses NFKC normalization, lowercase Unicode words and five-word shingles. It is not
semantic near-duplicate review, and does not establish that different document IDs belong to unrelated rulemaking
families. Source text was processed automatically; held-out bodies and retrieval results were not inspected for tuning.

The initial selection/audit and replacement selection/export receipts are retained locally under
`artifacts/regulatory-backfills/evaluation-candidate-*`. The selection hash in the committed inventory binds the exact
substantive selection file bytes. Formatting the committed report does not change that source-file hash.

## Required before freeze or live scoring

Development source review found that the two shortest records classified as proposals were notices of meetings about
proposals; the two shortest final-rule records were a correction and a temporary bridge deviation. Keep those as
distractors, but do not count them as substantive rule-analysis coverage. Added the Texas nonattainment permitting and
single-hull vessel proposals, and the South Texas onion assessment and Willamette bridge final rules. The Texas proposal
is 80,192 characters, exceeding the initial selection's 64,000-character preference; its complete 44-passage preparation
passed both tokenizers without truncation. All four additions have warning-free singleton publication groups and no
source-family overlap with selected held-out records. The 44-version duplicate screen returns 40 groups and no cross-split
group. Receipts are under `evaluation-candidate-substantive-*` and `evaluation-duplicates-substantive-*` locally.

The reusable screen runs with `pnpm tool regulations/screen-evaluation-duplicates --input <json> --output <new-json>`.
Input is an array of `{versionId, body, split}` for whole canonical versions, with `split` equal to `development` or
`held-out`. It accepts at most 128 versions, 200,000 characters per version and 2,000,000 characters overall; the CLI also
limits input-file bytes to 16 MiB. Exceeding a bound fails explicitly and must not be worked around by dropping source text.
The screen records raw/normalized body hashes, direct matching pairs and transitive connected groups. Group IDs depend
on sorted version membership. Normalized equality also covers short inputs with fewer than five words; unrelated short
inputs do not become duplicates merely because both lack shingles. Output contains no source text.

A cross-split group writes the diagnostic report and exits 1; a report without such groups exits 0. Existing outputs are
not overwritten. Exit 0 establishes only that this lexical screen found no split conflict, not semantic independence,
source authenticity or human review. The retained initial inventory exits 1 with one cross-split group; replacements
exit 0 with 22 groups and no cross-split groups. The expanded 40-version inventory also exits 0, with 36 groups and
zero cross-split groups. Input/report files are retained locally as
`artifacts/regulatory-backfills/evaluation-duplicates-{initial,replacement,expanded}-{input,report}.json`.

1. Review family and semantic near-duplicate assignments, including any shared notice templates and code/publication links.
2. Review subject coverage and challenging distractors. The expansion adds prose and tables at different lengths, but
   237 passages spanning these selected title families do not alone establish representative production performance.
3. Confirm historical differences are useful legal changes, not only non-substantive wording changes. Record exact source
   evidence for expected answers without using held-out results to tune implementation.
4. Author the protocol's 60 queries and known-answer evidence, including dates, exceptions, numbers and no-answer cases.
   Allocate 30 queries per split and validate all family/version/near-duplicate assignments against the final manifest.
5. Freeze the final corpus and assignments, run lexical and bounded provider retrieval, then produce model/rank-blinded
   relevance packets for human adjudication. Automated suggestions cannot satisfy the human-review gate.

EVAL-02/03 remain open. No model was selected and bulk embedding generation remains disabled.

## Development query draft

[Thirty development questions](embedding-development-queries.json) cover all development allocation slots: five current
prose, five table/exception/number, five historical, four proposal, four final rule, four notice and three no-answer.
Each binds canonical versions, passage/input hashes, packet hashes, source locators and verified quotes to an automated
answer proposal. Historical comparisons cite both versions and distinguish exact wording changes from inferred legal
effects. Publication questions use substantive proposals/final rules, deadlines, rates and effective-versus-applicability
dates. The three no-answer proposals concern later attendance, an unspecified future rate increase and later final
approval; their evidence explains the source boundary, not proof of exhaustive absence. They require full-pool review.

The development-only smoke draft has 137 records and 30 queries. Schema, unique IDs and answer membership pass. Both
tokenizers qualify every query: OpenAI maximum 38 tokens, 733 total; Voyage maximum 43, 788 total. Manifest hash:
`125978817e1422976e4e92fd2fe6c56a7ec70a010ae4fe4f92b3bf2387f41333`. Local artifacts:
`evaluation-development-smoke-input.json` and `evaluation-development-query-qualification.json` under
`artifacts/regulatory-backfills/`. No provider retrieval ran. No held-out source bodies or results were inspected while
writing these questions. All thirty held-out questions and human review remain; the corpus is not frozen.
