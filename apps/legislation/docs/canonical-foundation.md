# Canonical jurisdiction and session foundation

## Scope

The jurisdiction and session routes require source-backed fields that the current Open States bill archives, Congress
bill API, and GovInfo BILLSTATUS feeds do not provide at the record level. Those feeds identify the jurisdiction and
session, but do not authoritatively state a jurisdiction timezone or active flag, a session classification, or a
source reference for either canonical record.

The application therefore stores these fields as unknown rather than deriving them from a postal abbreviation, current
date, session name, or bill URL. Existing session `is_active` defaults are cleared by the additive migration because
they were not source observations.

## Source handoff

An authoritative adapter must submit complete records to `importCanonicalFoundationRecords`. Every jurisdiction record
requires `id`, `timezone` (which may explicitly be `null`), `isActive`, and a source reference. Every session record
requires `id`, `classification`, `isActive`, and a source reference. A source reference contains its provider, HTTPS
URL, retrieval time, optional source-update time, and official-source flag. Providers cannot be blank.

The importer updates existing canonical records only. It refuses to create a record from a provider identity, validates
the source payload at the boundary, and advances the `canonical-foundation/jurisdictions-sessions` checkpoint only
after each durable update. A final audit records whether every persisted jurisdiction and session is route-complete.

## Route gate

`provenance_complete` is guarded by a database constraint, but that flag alone is never the route gate. The audit also
requires each jurisdiction's known active state and each session's known classification and active state. Until an
authoritative snapshot completes that audit, the corresponding HTTP routes remain unregistered.
