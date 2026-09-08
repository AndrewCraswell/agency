# Historical committee reconciliation

## Scope and decision

The approved reconstruction remains GovInfo-only for federal committee assignments. Existing Congress.gov identities
and terms identify people; they do not supply new committee assignments. Source-detected dates remain distinct from
legal appointment dates. Open States ingestion, webhooks and new data providers are outside this work.

The user requested independent LLM judgment and implementation on 2026-09-08. LLM review is an offline engineering
review step, not an ingestion dependency and not evidence by itself. Production behavior must be deterministic.

## Acceptance rules

| Evidence class | Behavior | Tradeoff |
| --- | --- | --- |
| Exact scoped identity or explicit initial/name form | Match only a unique person with an applicable Congress/chamber term | Prefer an unresolved entry over a competing identity |
| Reviewed printed name or state error | Correct only the exact reviewed edition/context/cell, with unique corroborating parent and canonical identity | Parent evidence identifies the printed assignee; a second subcommittee assignment table is not required |
| Nickname, changed surname or unsupported initial | Use only an individually reviewed, source-bound resolution with stable canonical identity and explicit evidence | No global nickname dictionary, fuzzy surname matching or LLM confidence threshold |
| Explicit assigned member on sabbatical | Retain the member role and preserve the leave note in the public membership label | Participation leave is not a recorded departure; no effective dates are invented |
| Person ineligible for the printed Congress | Do not invent a term, substitute another person or silently discard the row | Keep the edition unpublished; partial-roster publication would need a separate completeness contract |

Reviewed corrections preserve assignment count, organization, chamber, role and tenure semantics. They may not add
an absent assignment. Exact typo repairs require the expected context and unique corroboration; broader reviewed
identity resolutions must bind the reviewed source roster and expected canonical candidate. Changed source evidence,
missing prerequisites or competing candidates fail closed. Decisions remain reviewable in code and this inventory.

An adjacent GovInfo edition may establish an explicit name-to-Bioguide identity equivalence when the target edition
lacks an individual biography. This does not transfer any committee assignment across editions: the target roster
must itself contain the row, and the canonical person must have an applicable term in that target Congress. Preserve
the corroborating granule ID in the reviewed decision. Missing biography links alone are not evidence of a missing person.

## Independent LLM review and adjudication

The subsequent [person-by-person research audit](committee-identity-research-audit.md) separates fresh biography
corroboration from independent event/date verification and records the ingestion performance findings.
The [ingestion performance policy](committee-ingestion-performance.md) describes batching, preparation concurrency,
transaction deadlines and safe timeout recovery.

- The safety reviewer accepted Warner/Abercombie identity-only repairs: the target roster is positive assignment
  evidence; matching to a uniquely corroborated parent does not create an assignment. Generic fuzzy matching was rejected.
- The historical parser reviewer independently confirmed the Abercombie parent evidence and the substantive Davis
  footnote. It proposed a status-qualified role; root rejected role/status conflation in favor of a separate parsed note
  carried by the existing public label, leaving the role as `member`.
- A separate identity reviewer examines unresolved name mappings and alternative candidates before implementation.
- Reviewed nickname decisions may be an explicit engineering inference from the printed name, state, district,
  unique canonical identity and applicable term; they are not falsely described as an explicit source alias.
  For example, the Cathy McMorris biography lacks a Bioguide ID. Its reviewed resolution to Cathy McMorris Rodgers
  is bound to the exact roster, name, district and canonical identity. Source or catalog drift requires another review.
- The 105th Linda Smith correction requires the positive assignment table and separately printed Robert/Adam Smith
  companion entries in the two reviewed panels. The honorific alone is not an identity rule.
- All reviewers distinguish complete source accounting from complete canonical publication. Root keeps the contradictory
  117th Udall edition unpublished rather than introducing a partial-publication schema merely to clear a progress gate.

## Implementation and release gates

1. Preserve exact evidence and add regression tests for each correction, including missing/conflicting prerequisites.
2. Audit every affected edition completely: hierarchy, source count, identity count, duplicate identifiers and roles.
3. Require zero unexplained entries and reconcile duplicate printed assignments explicitly before publication.
4. Run focused tests and repository verification; report unrelated failures rather than bypassing hooks.
5. Commit/push reviewed changes to main and deploy Trigger before dispatching a new historical import.
6. Import one validated Congress at a time, never overlapping other import or index-maintenance work.
7. Verify database counts, Congress-end closure, detected dates, current-Congress fingerprints and unchanged reruns.
   Authenticated API verification is a separate gate and must not be claimed without working credentials.

The 15-minute Codex follow-up remains stopped. This plan does not restart it.

## Tradeoffs retained deliberately

The manifests freeze the entire parsed roster, expected cell contexts and canonical candidate fields. This is stricter
than freezing only the misspelled name: an upstream edit or a parser change can require re-review even when the identity
looks unchanged. That operational cost is acceptable for this finite historical backfill and prevents silent expansion
of exceptions. Future editions do not inherit the exceptions.

The existing catalog projection does not carry term state. The validator checks Congress, chamber, edition year and
district, freezes the canonical identity, and checks printed state and parent evidence separately. It must not claim
that a state field was validated on the term itself.

Contradictory 107th Spence and 117th Udall entries are not repaired by name matching. A source-semantic explanation is
required before publishing those editions; missing or stale terms are not permission to create a fictional tenure.

### Retained historical entries: subsequent source review

The 106th full-directory notes explicitly identify George E. Brown Jr.'s death on July 15, 1999 and say earlier
information was retained. The `CDIR-1999-06-15` PDF therefore reports an event after its own package issue date.
The February 2000 edition repeats that compilation context. Using June 15 as a detected departure would be wrong.

Both reviewed 107th full-directory notes explicitly identify Floyd Spence's death on August 16, 2001 and explain
that information is retained for historical purposes. This establishes historical rather than current information,
but not an exact committee departure date or an observed start. No general roster-bracket legend was established.
The evidence is in the advertised full PDFs for `CDIR-1999-06-15` and `CDIR-2000-02-01` (PDF page 3), and
`CDIR-2001-12-07` and `CDIR-2002-10-01` (PDF page 1).

These are a separate unresolved observation contract, not remaining nickname errors. A future implementation must
represent an assignment first encountered as already historical, allow genuinely unknown observed dates, and prevent
retrospective notes from being backdated to the package issue date. Do not synthesize a zero-duration tenure or
silently remove the historical assignment merely to pass the current active-roster importer.

### Fresh source review after the 105th/109th imports

The [June 1999 House committee granule](https://www.govinfo.gov/content/pkg/CDIR-1999-06-15/html/CDIR-1999-06-15-HOUSECOMMITTEES.htm)
explicitly dates its assignments to July 19, 1999 (printed page 387), later than the package date. The Brown cells
are bracketed. On printed page 391, Julian C. Dixon's marker is explained as ranking Democratic member on leave
of absence. Treat this like the approved Davis participation note, not a deletion or a disposable numeric suffix.
These observations do not authorize a global bracket-removal or numeric-marker rule.

The [October 2002 House committee granule](https://www.govinfo.gov/content/pkg/CDIR-2002-10-01/html/CDIR-2002-10-01-HOUSECOMMITTEES.htm)
retains bracketed Spence entries, including Military Procurement alongside Curt Weldon as chairman. It is not a
single contemporaneous active roster. The [117th Senate committee granule](https://www.govinfo.gov/content/pkg/CDIR-2022-10-26/html/CDIR-2022-10-26-SENATECOMMITTEES.htm)
still prints Tom Udall in Appropriations. A matching surname, adjacent successor, or another New Mexico senator
does not authorize replacing that printed person.

Remaining work is separated into two decisions:

1. Identity-only corrections can follow the existing exact-edition manifest contract after individual corroboration.
   Previously reviewed names in another Congress are research leads, not automatically approved overrides.
2. Already-historical assignments need an explicit representation with unknown dates allowed. Proposed behavior:
   retain the source assignment, mark it historical at first observation, do not invent a detected start or a
   Congress-end departure, and distinguish an explicit roster-as-of date from the package issue date. This is not
   implemented or approved by this audit. The 117th contradiction separately requires either source-backed correction
   or an explicitly approved incomplete-roster policy; do not silently omit Udall.

Until those contracts are settled and all identities reconcile, the 106th, 107th and 117th remain unpublished.
