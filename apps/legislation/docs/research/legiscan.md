# LegiScan provider evaluation

Alternative provider, not selected or implemented. The current source choices belong to the
[coverage policy](../engineering/coverage-policy.md). This note retains the useful conclusions of the August 18, 2026
catalog review. Recheck commercial scope and the current manual before implementation; Tabra should not maintain a copy
of an unselected vendor's entire wire schema and reference database.

## Collection choices

| Mode | Useful scope | Evaluation boundary |
| --- | --- | --- |
| Pull | Discover sessions, bills, people, votes and document metadata; fetch individual text/amendment/supplement bodies | Polling and quota costs depend on scope and refresh strategy |
| Bulk | Per-session snapshots containing bill, roll-call and person JSON; CSV alternatives | Weekly snapshots in the reviewed contract; document binaries require separate acquisition |
| Push | Replication feed to Tabra's endpoint, including dependent objects | Paid cadence, acknowledgement, replay and missing-child handling need a subscription contract |

Push is a replication feed, not a set of independently subscribable product events. The reviewed manual describes
15-minute to four-hour delivery intervals. Those are delivery intervals after provider detection, not guaranteed time
from a legislature publishing a change to Tabra receiving it. Source publication, provider detection, transport,
ingestion and customer notification must be measured separately.

Keep original payloads and provider IDs for diagnostics, then normalize into Tabra's own entities and change events.
The official client's relational schema illustrates client storage; it is not a replacement for Tabra's canonical model.

## Coverage and overlap

The reviewed API contains bills, actions, sponsors, people, committee references, subjects, relationships, text versions,
amendments, supplements, roll calls, individual positions and bill-linked calendar information. This overlaps the existing
legislative pipelines. It does not by itself establish complete committee membership history, regulatory/current-code
coverage, transcripts or every field required by Tabra's civic APIs.

Evaluate replacement against the [synchronization catalog](../engineering/data-sync-catalog.md): required fields,
historical sessions, original documents, canonical identity continuity, corrections, complete replay, source provenance
and per-jurisdiction freshness. Sample actual delivery before assuming an advertised domain satisfies a route contract.

## Integration details worth retaining

- Validate incoming data. Some documented numeric identifiers appear as JSON strings in examples.
- Treat `0000-00-00` as unknown. Empty strings and arrays have source-specific meanings; do not fabricate missing facts.
- Preserve meaningful action/history ordering. Hashes detect changes; they are not stable business identifiers.
- Bulk metadata is not the same as acquired document text. Track text/amendment/supplement acquisition separately.
- Push payload roots include bill, text, amendment, supplement, roll call, person and session. Acknowledgements can
  request missing dependencies; confirm retry, timeout, ordering and replay guarantees before designing recovery.
- The reviewed manual and client disagree in places: committee `name` versus `committee_name`, optional session/person
  fields, additional MIME values and undocumented Push reasons. Validate against samples and current documentation;
  do not silently promote client-only values into a contractual promise.
- Commercial evaluation must cover storage, indexing, derived answers, excerpts/exports, attribution and customer/API
  redistribution rights. The availability of a payload does not grant every product use.

## Official references

Reviewed baseline: API manual v1.91, revision March 17, 2025, and client 1.4.1. Links may now serve newer versions.

- [API manual](https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf): operations, payload fields, enums and Push protocol.
- [Service overview](https://legiscan.com/legiscan): delivery modes and commercial offerings.
- [National datasets](https://legiscan.com/datasets): available session archives.
- [Client documentation](https://api.legiscan.com/docs/): transport and reference storage behavior.
- [Client download](https://api.legiscan.com/dl/legiscan-current.tar.gz): inspect and pin the selected release before reuse.
- [Pricing research](pricing.md): dated app/API pricing evidence; app tracking plans and data licenses are different products.

The expanded field catalog is in the September 14 consolidation recovery copy outside the documentation tree. Restore
only the requirements needed if LegiScan becomes an actual implementation candidate; do not maintain parallel vendor manuals.
