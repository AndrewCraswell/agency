# Canonical change events

Change events provide bounded product and operational history for canonical legislative records. They are not a
provenance ledger and do not retain complete provider payloads.

## Contract

Each event has a deterministic ID, ingestion run ID, canonical record type and ID, one of `create`, `update`, `delete`,
`cancel`, `reschedule`, or `relationship-change`, the names of changed fields, minimal before and after values, and the
observation time. Jurisdiction, organization, person, and source-update time are included when the canonical transaction
already knows them.

Current-record fingerprints use stable key ordering and normalized dates. An unchanged retry does not emit an event.
The event and updated fingerprint are written inside the same canonical database transaction, so a failed transaction
cannot publish a change. Cancellation and deletion require explicit canonical state. Rescheduling requires a changed
start or end time. Relationship changes are emitted only for structured canonical links; the system does not infer
provider intent from text or timestamps.

## Validation

Fresh-schema integration replays the same event snapshot and confirms that it remains silent, then applies a correction,
reschedule, cancellation, and deletion and verifies the exact ordered classifications. A deliberately invalid agenda
replacement proves that the canonical event and its change event roll back together. Deterministic planning tests also
cover relationship-only changes and repeated event identity.

Scheduled events link to later actions or votes through `event_outcome_links`. Every link names exactly one action or
vote, records a nonempty upstream reference, and permits only `explicit` or `deterministic-id` methods. Database checks
reject semantic linkage, and deterministic link IDs make replay silent. When no approved source relationship exists,
the event remains unlinked rather than using similar text or nearby timestamps.

## Query and retention

The `search_changes` MCP operation provides cursor pagination and filters for canonical record, record type,
jurisdiction, organization, or person. Results expose only the bounded changed fields.

Development change events are retained for 90 days. Current fingerprints are retained while the canonical record
exists because they are compact and required for unchanged-import detection. A future production retention decision may
change the event window based on measured product usage and operational recovery needs; retention must not be extended
solely to establish provenance.
