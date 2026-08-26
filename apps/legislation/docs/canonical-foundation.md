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

Reviewed snapshots live under `apps/legislation/data/canonical-foundation`. Import one explicitly with
`pnpm --filter legislation foundation:import -- data/canonical-foundation/<snapshot.json> [checkpoint-stream]`; the path
is package-relative because pnpm runs the script from `apps/legislation`. The command hashes the exact file, uses one
database connection, and relies on the importer's per-record durable checkpoint. A jurisdiction-scoped snapshot must use
its own checkpoint stream and does not make the global audit complete.

The Alaska snapshot is sourced from the current official Alaska State Legislature site and archive. The publisher labels
the persisted numbered records as `Legislature`, and the corrected adapter records the normalized lowercase classification
`legislature`. Legislatures 30 through 33 are in the archive and the official home page identifies the 34th as current.
The jurisdiction timezone remains explicitly unknown rather than being inferred. Production import
`a89bc8c83d9c57893c731e090f9599cf094e9cb73e88fce5f0b7df44aadd357c` processed all 6 of 6 snapshot records; its
idempotent rerun skipped all 6. This scoped source observation is sufficient for the Alaska detail fixtures, but it does
not establish nationwide foundation completeness: the audit remains incomplete for 52 jurisdictions and 648 sessions,
and the command reports `processed_partial` until the global audit is complete.

## Route gate

`provenance_complete` is guarded by a database constraint, but that flag alone is never the route gate. The audit also
requires each jurisdiction's known active state and each session's known classification and active state. A complete
authoritative snapshot can satisfy the gate for its explicit route scope, as the Alaska snapshot did for NX-02A; it does
not imply that the nationwide audit is complete or that an unrelated route scope may register.
