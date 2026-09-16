# Membership API projection

Membership resources expose `legislativeSessionId`, `effectiveStartDate`, `effectiveEndDate`, `detectedStartDate`,
`detectedEndDate`, `lastObservedDate`, `endedReason` and `isCurrent`. Federal clients may derive Congress from the session
identifier; federal collection filters may also accept `congress` as a convenience filter.

Date filters use effective dates when present, otherwise detected dates. Responses never collapse them into ambiguous
`startDate` or `endDate` fields. Organization and person reads disclose applicable historical warnings even on empty
filtered pages; current-only reads do not inherit an old Congress warning. An absent assessment means unknown.

Canonical fields/enums/identity belong to [C](../../../../packages/legislation-core/docs/engineering/committee-membership-history.md).
Reconstruction, replay, quarantine and retained Congress acceptance belong to
[I](../../../legislation-ingestion/docs/engineering/committee-membership-history.md).
The [civic HTTP contract](api/civic-graph-and-events.md) owns route behavior; source acceptance is not API acceptance.