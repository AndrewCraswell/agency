# Bill progress from recorded actions

The bill-progress card uses the selected bill's `progressActions` projection, independently of child pagination. The query includes each
action's classification, description, chamber, recorded date/time and source URL. It arrives in chronological order;
the presentation preserves that order rather than sorting source ordinals again.

## Latest action and chronology

Bill detail chooses the latest **dated** action independently of child pagination. The recorded action timestamp takes
precedence over its date; date-only actions sort at midnight UTC. Undated actions do not displace dated actions.
If every action is undated, the latest-action summary is absent. Introduction stays a separate bill fact.

Equal timestamps/dates use the publisher's sequence, then a stable ID: GovInfo/Congress feeds retain newest-first
ordinals, while OpenStates ordinals run oldest-first. This tie-break does not invent a time within a date-only day.
The action description, ID and provenance remain unchanged. No document publication, ingestion timestamp, or status
text supplies an action date. Canonical HTTP bill detail uses the same chronology and date precision.

## Progress stages

Recorded classifications take precedence. The shared core `domain/bill-action` classifier is used by federal
ingestion and milestone projection. Explicit federal action descriptions establish introduction, referral,
committee reporting, bill passage, chamber concurrence, executive receipt, signature, veto and enactment.
The acting chamber is distinct from a chamber mentioned in an amendment. Procedural rule passage and motions
do not establish passage of the bill. State actions retain their source classifications without federal inference.
Normalization occurs before milestone filtering; unclassified passage and enactment records are not discarded.

Dates and source URLs come from the action, not a bill-level summary. Missing dates remain absent. A bounded,
truncated action history, or one containing undated actions, can establish recorded stages but does not establish a
current stage. Actions and the
selected record must belong to the same canonical bill.

A terminal bill status or recorded terminal action prevents earlier stages from being marked current, even when
milestone details are incomplete. Status alone never supplies missing dates or marks unrecorded intermediate stages
complete. Each connector is binary: one full segment between adjacent recorded/current milestones, or an inactive
segment if either endpoint is unknown. No partial fill or inferred intermediate progress is displayed.

`compositionRecords.test.ts` covers classified and description-only actions, unknown descriptions,
classification precedence, missing dates, truncation and bill ownership. These fixtures validate projection behavior,
not source completeness or the accuracy of an upstream action description.

`query-service.integration.test.ts` covers the HR 8245 chronology regression against PostgreSQL, source-order
ties, child pagination, timestamp precedence, absent dates, provenance, cards, progress and canonical HTTP projection.
Explicit OpenStates fixtures cover state House-origin, Senate-origin and unicameral bills, including same-day
introduction/referral and governor receipt/signature, an older action with a higher source ordinal, derived status,
and Governor (not President) progress. These synthetic fixtures verify state/federal projection contracts, not the
completeness of any state's upstream records.

## Amendment distinction

Amendment cards do not use bill latest-action selection. For complete structured amendment histories, the card takes
the greatest recorded action date regardless of source order; distinct descriptions tied on that date are not
arbitrarily resolved. Truncated or entirely undated histories omit the latest-action fact. Document-backed state
amendments have no action history: their document date stays in the existing submitted-date metadata and is not
promoted to a latest legislative action. `resultStore.test.ts` and the state database fixtures guard these distinctions.
