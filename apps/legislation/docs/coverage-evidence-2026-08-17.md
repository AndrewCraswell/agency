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

## State vote coverage

The retained Open States corpus contains 464,252 state votes across 516 sessions and 52 jurisdictions. The historical
archives did not supply usable member identities or vote source links for these normalized records, so the report shows
zero member positions and zero source-linked state votes. This is an explicit coverage limitation, not an inference that
no members participated. Current structured Open States responses can add positions and links where supplied.

## Supporting documents

State bill documents are included per jurisdiction with classification, processing status, and failure counts. The
historical archive was imported before the narrower fiscal-note, analysis, amendment, and supplemental classifications
were replayed, so most state supporting documents remain in the generic `document` cohort. E4.7 remains open until an
offline replay applies the current classifier and the refreshed report proves per-type state coverage.

Current federal supporting-material cohorts include amendment text, hearing transcripts, meeting documents, member
statements, testimony, and witness statements. These counts are expected to grow during the pending full event and
amendment backfills.
