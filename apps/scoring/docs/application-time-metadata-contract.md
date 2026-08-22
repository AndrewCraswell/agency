# Application time metadata contract

M2-09 adds an ESP application-side annotation layer for records already
accepted by the journal. It does not change, retry, reclassify, or replace an
STM32 decision. `DecisionRecord.decisionAtUs` and its `scoringBootId` remain
the only authoritative scoring-time coordinates.

## Identity and order

The caller supplies a bounded ESP application boot ID. The model does not
generate an ID, because a generated value could conceal a persistence failure.
Each accepted record receives an immutable application sequence number.

Within one STM32 scoring boot, entries must advance by the tuple
`decisionAtUs`, capture-window first sequence, capture-window last sequence.
A duplicate record ID or regressing tuple is rejected. Distinct journal records
with an equal tuple are retained in journal/application FIFO order and marked
`same-authority-instant`; this covers legitimate simultaneous decisions without
inventing an ordering inside one acquisition instant. Across STM32 boot IDs,
the retained application sequence remains deterministic, but the relation is
marked `indeterminate-across-scoring-boots`: the model never claims that two
independent monotonic clocks establish physical chronology.

## Optional wall-clock anchors

An anchor names a scoring boot, STM32 sample time, wall-clock coordinate,
declared error bound, and either `rtc` or `network-time` source. The source is
provenance only. It does not claim NTP, PTP, RTC, or host-clock accuracy.

For a decision after an applicable non-stale anchor, the model emits a bounded
interval. Its uncertainty is the anchor's declared uncertainty plus elapsed
time multiplied by the caller-supplied maximum drift bound. That drift bound is
mandatory, so the model never assumes an oscillator is exact. An anchor older
than the configured maximum age produces `stale-anchor`; an anchor after the
decision produces `anchor-after-decision`; no anchor produces `offline`.

Network re-synchronization creates a later immutable anchor. The calculated
forward or backward correction is retained on that anchor and only affects
later annotations. Existing timeline entries are not recalculated or rewritten.
Anchors must strictly advance within each scoring boot and IDs cannot repeat.

## Bounds and persistence boundary

The host model retains at most 32 anchors and 32 annotations, matching the
current event-journal scale. Returned anchors, entries, intervals, and
snapshots are frozen. M2-09 does not define a flash layout or alter M2-08's
transaction rules; firmware must persist any metadata it needs using a later
power-fail-safe journal transaction.

Public options and anchors must be exact plain enumerable data objects. Unknown
properties, symbols, inherited values, and accessors are rejected at the host
boundary so a transport extension cannot silently alter time interpretation.
