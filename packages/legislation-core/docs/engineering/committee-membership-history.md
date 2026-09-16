# Canonical membership history

An organization membership may contain both source-effective and observation-derived dates:

| Field | Meaning |
| --- | --- |
| `legislativeSessionId` | Congress or state legislative session that scopes the tenure, when known |
| `effectiveStartDate` | Appointment start date explicitly supplied by the source; never inferred |
| `effectiveEndDate` | Appointment end date explicitly supplied by the source; never inferred |
| `detectedStartDate` | Publication date of the first complete source edition in which the tenure appears |
| `detectedEndDate` | Publication date of the first later complete source edition in which the tenure is absent |
| `lastObservedDate` | Publication date of the latest complete edition in which the tenure appears |
| `endedReason` | Defined reason that explains why the tenure is no longer current |
| `tenureOrdinal` | One-based sequence for leave-and-return tenures with the same source relationship identity |

`endedReason` is a database and API enum:

- `roster_removal_detected`: later complete roster omits the tenure; `detectedEndDate` is required.
- `historical_at_first_observation`: explicitly historical on first encounter, inactive and session-scoped, with null
  detected start/end and last-observed dates. Effective dates remain independently nullable.
- `congress_ended`: the Congress ended without a detected removal; its session supplies the boundary and
  `detectedEndDate` remains null.

Null means no recorded end condition. `isCurrent` uses recorded end state and session boundary, never retrieval time.
Identity is unique by organization, person, legislative session and tenure ordinal. Role is a tenure attribute, not
identity. Consecutive complete observations retain one uninterrupted tenure; absence then reappearance creates another.
Unknown effective dates remain unknown. See [I reconstruction and evidence](../../../../apps/legislation-ingestion/docs/engineering/committee-membership-history.md)
and [W API projection](../../../../apps/legislation-web/docs/engineering/committee-membership-history.md).