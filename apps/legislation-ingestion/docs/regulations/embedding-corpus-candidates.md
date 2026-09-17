# Canonical embedding evaluation candidates

Recorded September 16, 2026. This is a pre-freeze candidate inventory for EVAL-02, not a completed evaluation or a
representative release corpus. [Candidate identities and hashes](embedding-corpus-candidates.json) bind 26 complete
canonical versions to 55 common passages: 17 development and 38 held-out candidates. Both pinned tokenizers qualify
every version; the largest common input is 777 tokens. No provider calls, canonical writes or index/vector writes occurred.

| Cohort | Development versions | Held-out candidate versions |
| --- | --- | --- |
| Current prose | 2, Title 29 | 2, Title 8 |
| Current tables | 1, Title 29 | 1, Title 8 |
| Historical versions | 4, Title 5 annual/current pairs | 4, Title 6 annual 2023/2024 pairs |
| Proposed rules | 2 | 2 |
| Final rules | 2 | 2 |
| Notices | 2 | 2 |

Selection used source metadata, size and shape before retrieval scores. Current/code candidates were bounded to
1,000–12,000 source characters; publication candidates to 1,000–64,000. Publications came from singleton groups without
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
replacement selection file bytes. Formatting the committed report does not change that source-file hash.

## Required before freeze or live scoring

1. Review family and semantic near-duplicate assignments, including any shared notice templates and code/publication links.
2. Expand subject coverage and challenging distractors. The shortest-record selection is biased toward short text;
   55 passages and one current table per split do not yet justify a production model decision.
3. Confirm historical differences are useful legal changes, not only non-substantive wording changes. Record exact source
   evidence for expected answers without using held-out results to tune implementation.
4. Author the protocol's 60 queries and known-answer evidence, including dates, exceptions, numbers and no-answer cases.
   Allocate 30 queries per split and validate all family/version/near-duplicate assignments against the final manifest.
5. Freeze the final corpus and assignments, run lexical and bounded provider retrieval, then produce model/rank-blinded
   relevance packets for human adjudication. Automated suggestions cannot satisfy the human-review gate.

EVAL-02/03 remain open. No model was selected and bulk embedding generation remains disabled.
