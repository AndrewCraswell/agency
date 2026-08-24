# Executable requirements-to-evidence ledger guard

**Contract:** M0-12
**Status:** planning baseline only

The narrative [requirements-to-evidence ledger](requirements-to-evidence-ledger.md) is the human-readable source index. Its executable companion, [`../src/requirements-to-evidence-ledger.ts`](../src/requirements-to-evidence-ledger.ts), freezes the stable requirement-family IDs and evidence responsibilities used to keep that index honest.

Every row names a unit, simulator, native C, WebAssembly, HIL, and physical-evidence owner. The mapping is deliberately explicit rather than inferred from source-file, scenario, test, coverage, or implementation counts. A row stays `blocked` while it has any declared gate. This baseline denies release and does not claim target firmware, a C17 core, WebAssembly parity, hardware approval, fabrication readiness, or physical qualification.

The guard binds five authoritative sources: the FIE traceability matrix, device-delivery plan, C17 migration plan, bench-prototype plan, and encrypted-IR contract. Every extracted `GEN`, `FOIL`, `EPEE`, `SABRE`, `OUT`, `CLOCK`, `PWR`, `INT`, `M`, `BT`, `CW`, `BP`, and `RC` identifier routes exactly once within its source to a stable requirement family. There are no reviewed exclusions in this baseline.

Focused tests read those documents directly and compare both the exact extracted identifier set and a frozen SHA-256 requirement projection. For the FIE matrix, the projection includes every requirement row in full. For status-bearing backlogs, it includes ID, deliverable, dependencies, and acceptance while intentionally excluding mutable status and latest-state columns. Status updates therefore do not invalidate the requirement identity, but a new, removed, duplicated, or edited requirement does.

The guard rejects missing or reordered stable IDs, missing or stale source identities, duplicate or unmapped authoritative IDs, duplicate requirement IDs or gates, empty owners, missing planned work units, evidence approval states, aliases, accessors, and any structure that differs from the reviewed baseline. Future work may update evidence only through a reviewed change that updates the authoritative requirement source, the narrative ledger, this canonical data, its test, and the appropriate backlog item together.

The C17 and WebAssembly columns are commitments to the approved one-core migration: the STM32 target, native test host, and browser WebAssembly module must ultimately execute the same C17 scoring core. They are not evidence that this migration is already complete. TypeScript remains orchestration and presentation only after the migration cutover; it has no scoring fallback.
