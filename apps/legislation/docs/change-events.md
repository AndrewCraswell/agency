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

## Query and retention

The `search_changes` MCP operation provides cursor pagination and filters for canonical record, record type,
jurisdiction, organization, or person. Results expose only the bounded changed fields.

Development change events are retained for 90 days. Current fingerprints are retained while the canonical record
exists because they are compact and required for unchanged-import detection. A future production retention decision may
change the event window based on measured product usage and operational recovery needs; retention must not be extended
solely to establish provenance.
