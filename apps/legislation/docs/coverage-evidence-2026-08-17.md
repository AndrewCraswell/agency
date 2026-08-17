# Development corpus coverage evidence

The live report generated on 2026-08-17 is retained in the development reports container at
`evidence/expansion/coverage/coverage-expansion-live.json`. It is a point-in-time development artifact and will be
regenerated after the remaining Congress and Open States refreshes.

## Current corpus

- 1,463,377 bills, 12,697,733 actions, 1,387,104 sponsors, 464,253 votes, and 4,239,702 documents.
- 649 jurisdiction/session scopes, including 618 state scopes.
- 110 federal Congress/bill-type cohorts with bill and document counts.
- 87,131 processed documents and 227,557 extracted sections.

The report includes failure categories by source and operation rather than only a cumulative failure number. Historical
failure runs remain visible even after a successful replay, so the category list is evidence to reconcile with terminal
job results, not a count of currently missing records.

## Recovery checkpoint

A second live report generated at 2026-08-17T16:03Z captured the in-progress corrective replay:

- 1,464,960 bills, 12,711,094 actions, 1,386,829 sponsors, 469,560 votes, and 4,243,845 documents.
- 190,653 vote positions across seven sessions and three jurisdictions already replayed with position data.
- 129,616 processed documents and 297,422 extracted sections.
- 125,697 bill embeddings and 124,935 document-section embeddings.
- State document classifications already include 7,675 fiscal notes across three jurisdictions, 3,509 analyses,
  40,552 supplemental documents, and 2,733 unstructured amendment documents.

The four-shard document processor, four-shard embedding processor, Congress incremental synchronization, and corrected
Open States archive replay were still running at this checkpoint. These are progress measurements, not terminal totals.
The corrected Alaska archives completed with zero failed records after blank provider vote IDs were normalized as
missing rather than treated as one shared globally unique identifier.

Current Open States people, committee, and event refreshes remain bounded by the provider credential's daily quota. A
jurisdiction-scoped entity attempt returned HTTP 429 with `exceeded limit of 250/day`; E1.5, E2.4, and E2.9 remain open
until a later daily window completes those programmatic refreshes. Historical bill, vote, and document archives do not
consume that API quota and continue independently.

## State vote coverage

The original retained Open States corpus contained 464,252 state votes across 516 sessions and 52 jurisdictions but no
member positions. That was partly a normalization defect: historical exports often use an empty string for an absent
vote or voter ID. The importer now treats those values as missing, retains source names through stable jurisdiction-bound
identities, and avoids global uniqueness collisions. The corrective replay had retained 190,653 positions by the second
checkpoint. Sessions that genuinely omit position arrays remain explicitly reported with zero position coverage.

## Supporting documents

State bill documents are included per jurisdiction with classification, processing status, and failure counts. The
corrective replay has begun applying the narrower fiscal-note, analysis, amendment, and supplemental classifications;
the recovery checkpoint proves each observed type without implying uniform state availability. E4.7 remains open until
the full replay reaches a terminal result and a final report records the resulting per-jurisdiction coverage.

Current federal supporting-material cohorts include amendment text, hearing transcripts, meeting documents, member
statements, testimony, and witness statements. These counts are expected to grow during the pending full event and
amendment backfills.
