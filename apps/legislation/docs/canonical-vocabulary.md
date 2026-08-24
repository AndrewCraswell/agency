# Canonical legislative vocabulary

## Concepts

- A jurisdiction is a country, state, district, or territory with a legislative authority.
- A legislative session is a named convening within exactly one jurisdiction.
- A chamber is `lower`, `upper`, `unicameral`, or `legislature`; unknown provider values remain `null` and are
  diagnosed.
- Bill classifications retain normalized provider categories such as `bill`, `resolution`, `joint-resolution`,
  `concurrent-resolution`, `constitutional-amendment`, `memorial`, and `nomination`. Unmapped values become `other`
  only when the raw value is retained in diagnostics.
- Actions have stable upstream order plus zero or more normalized classifications: `introduction`, `referral`,
  `committee`, `amendment`, `reading-1`, `reading-2`, `reading-3`, `passage`, `failure`, `executive-signature`,
  `executive-veto`, and `other`.
- Vote options normalize to `yes`, `no`, `absent`, `abstain`, `not-voting`, `present`, `proxy`, `paired`, or `other`
  while preserving raw values in diagnostics.
- Documents are `version`, `amendment`, `fiscal-note`, `analysis`, or `supplemental`. A logical version may retain
  multiple official format records.
- Relations are `companion`, `replacement`, `replaced-by`, `prior-session`, `related`, or `other`.

## Missing values

`null` means an optional scalar is not supplied or cannot be mapped safely. An empty array means a source supplied no
members of that collection. `not-applicable` is represented only by a documented canonical enum value when the concept
truly does not apply; it is never substituted for unknown data. Required minimum bill fields cause record rejection
when absent.

## Dates and times

Complete `YYYY-MM-DD` dates are stored as dates. Complete timestamps are normalized to UTC before storage. Year-only or
year-month fuzzy dates are retained in source diagnostics and do not become fabricated first-of-period dates. Open
States action and vote times without offsets are treated as local to the jurisdiction only after a jurisdiction timezone
is configured; otherwise the exact date is stored and the local-time string remains diagnostic metadata.

## Provider mapping

Open States normalized classifications are accepted when they match the vocabulary and otherwise diagnosed. GovInfo and
Congress.gov bill types map to canonical bill or resolution classifications, while their lower-case type codes remain
part of federal canonical IDs. Provider-specific status strings map to the nearest lifecycle status only when the source
semantics are documented. Unknown values remain absent instead of leaking provider enums into query results.
