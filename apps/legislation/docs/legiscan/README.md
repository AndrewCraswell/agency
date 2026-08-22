# LegiScan data catalog

This catalog inventories the LegiScan API at field level for capability and data-model gap analysis. It covers the Pull,
Bulk, and Push interfaces; every documented Pull operation; every documented Push payload type and trigger reason; all
wire payload fields; enumerated values; and the official reference client's relational storage model.

## Source baseline

The catalog was verified on 2026-08-18 against these official sources:

- [LegiScan API User Manual v1.91, revision 2025-03-17](https://api.legiscan.com/dl/LegiScan_API_User_Manual.pdf)
- [LegiScan API service overview](https://legiscan.com/legiscan)
- [LegiScan national datasets](https://legiscan.com/datasets)
- [LegiScan API client 1.4.1 download](https://api.legiscan.com/dl/legiscan-current.tar.gz)
- [LegiScan API client source documentation](https://api.legiscan.com/docs/)

The API manual is the primary wire-contract source. The downloadable client is secondary evidence for Push transport,
acknowledgement behavior, archive layout, and the reference SQL model. Where official sources disagree, the discrepancy
is recorded rather than silently normalized.

## Catalog navigation

- [Operations and delivery modes](operations.md) lists every API operation, parameters, response roots, cadence, and Bulk
  archive coverage.
- [Wire schema](wire-schema.md) defines every field and nested object returned by the API.
- [Push model and webhooks](push.md) defines the endpoint protocol, all seven payload types, all 25 documented bill-change
  triggers, acknowledgements, missing-child requests, and implementation requirements.
- [Reference values](reference-values.md) lists every published enum and identifies additional undocumented values present
  in the official client.
- [Reference SQL schema](reference-sql-schema.md) inventories every table and column in LegiScan's PostgreSQL reference
  schema and separates API data from client-maintained storage fields.

## Coverage at a glance

| Domain | Pull | Bulk JSON | Push | Primary identifiers |
| --- | --- | --- | --- | --- |
| Sessions | `getSessionList` | Indirectly through bill payloads | `session` | `session_id`, `state_id` |
| Bills and status | `getMasterList`, `getMasterListRaw`, `getBill` | Yes | `bill` | `bill_id`, `change_hash` |
| Actions and progress | Inside `getBill` | Yes | Inside `bill` | `bill_id`, ordered array position |
| Committees and referrals | Inside `getBill` | Yes | Inside `bill` | `committee_id`, `body_id` |
| Sponsors and legislators | `getPerson`, `getSessionPeople`, `getSponsoredList` | Yes | `person` | `people_id`, `person_hash` |
| Subjects and related bills | Inside `getBill` | Yes | Inside `bill` | `subject_id`, `sast_bill_id` |
| Bill-text metadata | Inside `getBill` | Yes | Inside `bill` | `doc_id`, `text_hash` |
| Bill-text binary | `getBillText` | No | `text` on request/availability | `doc_id` |
| Amendment metadata | Inside `getBill` | Yes | Inside `bill` | `amendment_id`, `amendment_hash` |
| Amendment binary | `getAmendment` | No | `amendment` on request/availability | `amendment_id` |
| Supplement metadata | Inside `getBill` | Yes | Inside `bill` | `supplement_id`, `supplement_hash` |
| Supplement binary | `getSupplement` | No | `supplement` on request/availability | `supplement_id` |
| Roll-call summary | Inside `getBill` | Yes | Inside `bill` | `roll_call_id` |
| Individual votes | `getRollCall` | Yes | `roll_call` | `roll_call_id`, `people_id` |
| Hearings and calendar | Inside `getBill` | Yes | Inside `bill` | Bill plus event content |
| Search results | `getSearch`, `getSearchRaw` | No | No | `bill_id`, `change_hash` |
| GAITS tracking state | `getMonitorList`, `getMonitorListRaw`, `setMonitor` | No | No | `bill_id`, `stance` |
| Dataset metadata/archive | `getDatasetList`, `getDataset`, `getDatasetRaw` | The archive itself | No | `session_id`, `dataset_hash` |

## Contract interpretation rules

- Types describe JSON values, not database storage types. The examples sometimes serialize IDs as strings even when the
  data dictionary declares an integer. Consumers should validate numeric content while tolerating either JSON number or
  numeric string until confirmed against a live subscription.
- Dates are normally `YYYY-MM-DD`; unavailable dates can be `0000-00-00` in examples. Treat that sentinel as unknown,
  not as a valid date.
- Empty third-party identifiers and optional strings are commonly represented as `""`, not `null`.
- Arrays may be empty. Ordering is meaningful for history, progress, referrals, sponsors, and search results.
- `change_hash`, `person_hash`, document hashes, and `dataset_hash` are change-detection/version signals, not durable
  business identifiers.
- Fields labeled **example-only** occur in official response examples or the client but are absent from the v1.91 data
  dictionary. Fields labeled **deprecated** should be retained only for ingestion compatibility.

## Known official-source discrepancies

| Area | Difference | Integration treatment |
| --- | --- | --- |
| Committee objects | Examples use `name`; the dictionary uses `committee_name`. | Accept both and map to one canonical name. |
| Bill session object | Example includes `state_id` and `session_tag`; the bill dictionary omits both. | Treat as optional example-only fields. |
| Session list | Example includes `dataset_hash` and `session_tag`; the session dictionary omits them. | Treat as optional but persist when present. |
| Person/sponsor | Examples and client include `nickname`; the person dictionary omits it. | Treat as optional example-only field. |
| Session people | Nested session example uses `name` in addition to `session_name` semantics. | Accept `name` as an operation-specific normalized display name. |
| MIME values | Manual publishes IDs 1-6; client seeds IDs 7-11. | Published values are contractual; client additions are compatibility-only. |
| Push reasons | Manual publishes 1-25; client seeds 26, 27, and 99. | Do not build business logic on undocumented reasons without LegiScan confirmation. |
