# Identity audit follow-up

September 8, 2026. This classifies stored identity evidence; it does not authorize name-only merges.

## Post-refresh verification

Coordinator `run_06g853d10it3r9rilcrepa7h01` uses Trigger `20260908.8`. Member child
`run_06g853f3rh563c7j6lfi3ra601` completed with 558 attempts. After that refresh, production retained 10,755
terms, zero untitled terms, zero duplicate Congress person/Congress/chamber groups, zero person/term jurisdiction
mismatches, zero missing links on House vote 119/2/74, and zero unnamed nonperson amendment sponsors.
The bills child was still executing. Full-wave acceptance remains pending; member-child completion is not wave completion.

## Collision classification

The read-only scan grouped names and source aliases within jurisdiction after lowercasing and stripping ASCII
punctuation/spacing. This is a broad candidate detector, **not** a resolver or Unicode identity key.
It returned 17 groups, below the 100-group output bound, so the result was not truncated:

- One federal group is the distinct Payne father/son pair (`P000149`, `P000604`), checked against the official
  House biography in [the repair inventory](identity-link-inventory.md).
- Sixteen groups contain only `person:openstates-voter-name:*` stubs: FL (Edwards-Walpole, Lopez J),
  ID (Van Orden), IL (Du Buclet), MT (Running Wolf Tyson T), NM (Hernandez JF/JN, O'Malley, Romero GA),
  NY (D'Urso), OK (O'Donnell and the apparent motion text “Amd CA1 Adopted”), SD (Smith VJ), TN (Van Huss),
  and TX (JD, JE). These labels do not establish which real person voted. Accent loss, initials and motion-like
  text make normalization-based merging unsafe.

There are **17,893 name-only vote stubs**, none with complete provenance or known activity. `listPeople` excludes
them; canonical projection remains fail-closed. All 1,623 source-complete person rows are Congress records;
18,087 rows have no source provider. Those totals do not represent 19,710 verified officials.

`person_aliases` and `person_external_identifiers` both contain zero rows. Their zero-conflict result is vacuous.
Source-backed identifiers currently live in `people.source_id` and `upstream_ids`. Exact provider-ID/Bioguide
checks and this normalized-name classification complete the bounded inventory, not statewide identity resolution.
Retain source names and acquire stable IDs from the approved self-hosted OpenStates pipeline before reconciliation.
No additional provider, identity merge or state-data rewrite was performed.

## Prevention and release ordering

`GET /ready` advertises `ingestionContract.membershipEndReasons` from the enum used by canonical projection.
`pnpm --filter legislation trigger:deploy` first checks the deployed API at `LEGISLATION_PUBLIC_API_BASE_URL`.
It refuses an old/missing contract, unavailable API, HTTP errors, redirects or network failures, with a 15-second
deadline. Deploy the API first, verify readiness and affected authenticated routes, then deploy ingestion.
Do not bypass the gate with raw `trigger deploy`. This protects membership end reasons, not every schema change;
extend contract coverage when another persisted enum or shape is introduced.

The gate blocks deployment, not an already-running worker or an unsafe later API rollback. Rollbacks must retain
support for values already written. No importer deployment or database write is needed to introduce this check.
Replay regression coverage checks stable member-term keys and provider-scoped replacement without duplicate terms.

## Roadmap reconciliation

Reuse `person_aliases`, `person_external_identifiers`, `person_details`, `person_jurisdictions` and `legislative_terms`.
Do not create parallel alias/identifier tables from the old plan. Office identities, versioned district geometries,
and entity mentions remain separate future capabilities. The roadmap distinguishes implemented schemas and clients
from missing production population, unverified archival behavior and unimplemented office/geography work.

Remaining gates: terminal full-wave verification; approved OpenStates stable-ID acquisition and state reconciliation;
source-backed alias/identifier population. These are explicit gaps, not reasons to merge ambiguous records today.
