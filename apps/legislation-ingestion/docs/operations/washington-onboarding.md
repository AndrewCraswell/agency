# Washington Open States source profile

This page records Washington-specific source and normalization constraints. It is not a deployment journal or readiness
claim. Linear owns active work; inspect the target environment and retained evidence before changing schedules or
advertised coverage. The shared [jurisdiction onboarding](openstates-jurisdiction-onboarding.md) and
[rollout requirements](openstates-rollout-checklist.md) remain authoritative.

## Approved scope

Washington uses the shared retained-source, batch ownership, promotion, document, OCR, embedding, and search pipelines.
No Washington-specific provider, database, embedding model, scheduler, receipt format, or identity model is approved.

The reviewed legislative session uses:

- scraper session `2025-2026`;
- publisher biennium `2025-26`; and
- separate House and Senate bill inventories.

Keep scraper and publisher session identifiers distinct. New sessions require source review and explicit profile
changes; a matching string pattern is not authorization.

## Source authorities

- [Washington legislative web services](https://wslwebservices.leg.wa.gov/) publish bills, sponsors, committees,
  meetings, amendments, roll calls, and document links.
- The official committee inventory supplies biennium-scoped numeric committee identifiers.
- Official journals and member-history publications may support reviewed historical-role corrections.
- Retained Open States archives support historical replay but do not supersede newer official publisher evidence.

Open States hosted API access is not a fallback for an unavailable publisher or scraper. Credential, maintenance, and
transport failures remain explicit failed or deferred work.

## Bill extraction

Bill discovery must validate biennium, chamber, bill number, and legislation type before creating canonical printed
identifiers. Appointments, initiatives, and unsupported types remain outside the bill lane.

Each extraction work item contains 1–10 unique bills from one chamber. The adapter must resolve each bill's chamber from
its validated identity rather than mutable loop state, verify every selected row occurs exactly once, and reject
whole-session or offset-based execution.

Actions preserve source precision. Date-only facts stay date-only. Publisher time zones may differ between bill and
event sources, so timestamp normalization requires field-specific evidence.

## Votes

Explicit publisher vote IDs remain authoritative. When an archive omits an ID, derive the stable source identity from
date, chamber or organization, roll-call identifier, motion, and sorted source URLs. Never use array position,
outcome, or tally counts as identity inputs.

Preserve named voter observations as source claims until independently resolved. Names alone never create or merge
canonical people. Conflicting observations remain quarantined or unresolved; tally changes do not rename a vote.

## People and committees

Washington has two House members and one senator per district. Capacity validation detects missing or excess current
occupants but does not infer House position numbers or resolve historical overlaps.

Historical roles require source-backed dates and exact-file-hash-bound review. Ambiguous, overlapping, reversed, or
partial-precision histories remain quarantined. Do not add person-name exceptions to the normalizer.

Committee and event references resolve through official numeric identifiers within the biennium. Multiple identifiers
may map to one canonical organization only when every identifier resolves uniquely to that same organization. Missing,
empty, conflicting, or ambiguous host groups keep relationship completeness false. A meeting observation alone does not
establish organization classification, active state, roster completeness, or membership history.

## Meetings and calendars

Event discovery uses explicit inclusive date windows. The source's default future window is not historical coverage.
Cancelled meetings, changed times, and verified-empty windows require retained evidence.

The shared planner hashes the cycle, scope, source identity, and each bounded window. A new cycle gets a new identity so
previously empty dates can be revisited. The coordinator commits canonical rows and the exact work receipt together;
verified-empty windows never delete canonical events.

Use concurrency one for initial hosted acceptance. Do not enable a recurring schedule until source maintenance,
publisher limits, continuation, interruption recovery, and downstream event reads have passed.

## Documents and content

Document discovery follows official publisher listings and retains advertised and absent directories explicitly.
Missing directories, redirects, transport errors, and unsupported training documents are not successful empty content.

Before removing an alias or unsupported document, prove that the candidate is bounded to the retained publisher
inventory and that canonical content and dependent records are preserved. Pending documents must not receive fabricated
OCR outcomes. Bill/detail, text, OCR, passage, embedding, and search readiness are separate gates.

## Acceptance

Washington acceptance requires all shared rollout checks plus:

1. replayable current and historical people/committee inventories;
2. stable bill and vote identities across reordered source arrays;
3. bounded single-chamber bill extraction;
4. explicit calendar-window planning with durable empty receipts;
5. committee-reference resolution through official identifiers;
6. document inventory and alias reconciliation without inferred removal;
7. canonical replay in a disposable database;
8. authenticated W and M reads for bills, votes, events, people, committees, documents, and search; and
9. hosted extraction, recovery, continuation, and schedule inspection at the approved concurrency.

Passing tests, a successful isolated canary, or a completed parent-record import does not establish statewide,
historical, content, search, or recurring coverage.
