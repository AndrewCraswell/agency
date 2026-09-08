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
missing prerequisites or competing candidates fail closed. Decisions remain reviewable in mapping data and this inventory.

## Reviewed mapping data

The committed JSON datasets in [review-data](../src/ingestion/govinfo/review-data/README.md) contain reviewed names,
canonical identities, exact committee contexts, edition fingerprints and research notes. The reviewed-identity matcher
contains no person-specific mappings. Its shared loader validates the data shape and rejects duplicate editions or
conflicting source contexts before the existing roster/canonical-person checks run.

The September 8 extraction preserved all mapping values across 11 identity editions and five historical-assignment
editions, verified by an exact structured-data comparison. Brown/Spence retain their separate historical-observation
semantics. No database rows, assignments, dates or publication gates change. New database ingestion uses the same
bundled datasets once canonical people and terms exist. Data changes still require review and deployment; remote
GovInfo content cannot supply or alter these trusted overrides.

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

The user reactivated the 15-minute Codex follow-up on September 8. It checks for active work before continuing
this backlog, does not overlap imports, and stays quiet when there is no meaningful change.

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
   implemented by this audit. The user subsequently approved this representation and explicit quarantine of the
   disputed 117th assignment, with the roster marked incomplete; do not silently omit Udall.

Until those contracts are settled and all identities reconcile, the 106th, 107th and 117th remain unpublished.

### Approved quarantine implementation, September 8

The normalizer now separates the exact October 2022 Senate Appropriations Tom Udall/NM cell into a reviewed
`source_term_contradiction` quarantine. It neither creates an identity nor substitutes another senator. Changed
edition, Congress, context, state, role, notes or duplicate cells do not inherit this exception. Unexpected unmatched
cells still fail validation. The affected normalized organization is explicitly incomplete.

Manual reality check: the [official House biography for U000039](https://history.house.gov/People/Detail/20879?ret=True)
states Udall's Senate service ended January 3, 2021, whereas the October 2022 GovInfo roster above prints him in
Appropriations. This corroborates quarantine, not a replacement assignment.

Publication remains deliberately gated: historical imports preserve organization rows shared with the current
Congress, so an organization-only incomplete flag cannot describe historical completeness safely. Next implement
session-scoped completeness and quarantined-cell persistence, expose it in the API, and test transactional checkpoint
and rerun behavior before deploying/importing 117. Brown/Spence historical-observation handling and the remaining
106/107 identity reviews follow; their approval no longer needs to be requested.

Coverage persistence uses the existing per-Congress atomic roster checkpoint, rather than a global organization
flag or a second independently committed record. New observations retain a validated coverage assessment and
quarantined-cell details. An observation without an assessment remains unknown, not implicitly complete. Unchanged
reruns preserve the saved assessment. The API still needs to expose Congress-scoped coverage before the publication
guard can be removed; checkpoint persistence alone does not make quarantined imports safe to publish.

Organization membership responses now carry affected historical Congress/source-edition coverage warnings in
`meta.warnings`, including empty pages. Warnings describe source coverage rather than the filtered page. Current-only
requests do not inherit an old Congress's incomplete status. Other committees/chambers are not marked incomplete,
and absent checkpoint evidence is not converted into a claim of completeness. Person membership reads now expose the
same historical warning using the reviewed canonical person ID, including when the person's filtered page is empty.
The disputed cell retains `person:congress:u000039`, independently confirmed as `Udall, Tom` in the production catalog;
this identifies the quarantined claim, not an accepted 117th membership. Other people and current-only reads do not
inherit that warning. Deployment verification remains before the quarantined-publication guard can be removed.

### Coverage API release, September 8

Committed source `3a0c95b` was deployed from a clean git archive to production `legislation-web` as
`c5c397c8-4c45-4ff7-9561-9d66da55305d`; Railway reported terminal `SUCCESS`. The prior deployment was
`beb4920f-470a-423d-8fef-0e5a87062fa4` (now `REMOVED`; do not assume it is immediately redeployable).
The live origin is `https://legislation-web-production-b024.up.railway.app`.

Fresh probes: `/health` 200, `/ready` 200 with an unsaturated database pool; the Appropriations organization-members
and Udall person-memberships routes both returned canonical 401 errors without a token. These are health/auth-boundary
checks, not authenticated membership acceptance. The provisioned `LEGISLATION_SMOKE_TOKEN` was unavailable in the local
environment. Do not weaken authentication or manufacture production checkpoint evidence to pass the smoke test.

The import guard remains active, and no 117th roster was published. Next complete authenticated response verification
when the approved credential is available; meanwhile continue the independently actionable 106th/107th historical
observation and identity work. Trigger was not redeployed by this API-only release.

### Historical first-observation contract

`historical_at_first_observation` is the explicit end-reason value for a source assignment first encountered as already
historical. It requires a Congress/session, an inactive membership, and null detected start, detected end and last-observed
dates. Effective dates remain independently nullable: this value does not invent them. Repeated archived observations
reuse the historical tenure; a later positive active assignment creates a new tenure instead of reactivating it. A
previously observed active tenure cannot be relabeled as historical at first observation.

The application schema, original migration baseline, API projection and reconciliation now support this contract.
Exact-source Brown/Spence normalization is implemented and read-only validated against all five reviewed editions.
Production schema application is complete; the remaining identity reconciliation and deployment are still pending.
No historical import is enabled by this change. An already-applied baseline is not rerun automatically: the narrow
production DDL below was applied separately, preserving valid indexes and unrelated data.

### Brown/Spence source-cell validation, September 8, 2026

The three 106th editions (June 15, 1999; February 1 and October 1, 2000) each retain four Brown cells: Agriculture,
its Department Operations and Risk Management subcommittees, and Science. The two 107th editions (December 7, 2001
and October 1, 2002) each retain four Spence cells: Armed Services, Military Procurement, the Department of Energy
Reorganization panel, and Veterans’ Affairs. The last already matched by name and therefore would have been missed
by reviewing only unmatched identities. No other parsed Spence assignment occurs in either 107th edition.

The [October 2000 compilation notes](https://www.govinfo.gov/content/pkg/CDIR-2000-10-01/pdf/CDIR-2000-10-01.pdf)
also record Brown's death on July 15, 1999. Together with the previously reviewed compilation notes and bracketed
committee cells, this supports historical retention, not active membership at publication. The independently reviewed
House biographies identify [Brown, B000918](https://history.house.gov/People/Listing/B/BROWN%2C-George-Edward%2C-Jr--%28B000918%29/)
and [Spence, S000718](https://history.house.gov/People/Listing/S/SPENCE%2C-Floyd-Davidson-%28S000718%29/).
Their death dates are corroboration, not inferred committee start/end dates.

`committee-historical-assignments.ts` freezes each full parsed roster fingerprint and exact canonical identity,
Congress/chamber/district and committee contexts. A changed fingerprint or missing/conflicting identity fails closed.
Only these reviewed manifests permit canonical service ending before the edition year; ordinary identity reviews
still require service covering the edition year. Brackets alone never activate this policy.

The fresh read-only normalization against production canonical people/terms produced four inactive historical
memberships per edition (20 appearances total), all with null detected start/end/last-observed dates. Focused
normalization and identity tests passed (89 tests). This does not close the other 106th/107th identities or establish
production import acceptance. Roster-change detection includes historical-first-observation status, so a transition
to or from positive assignment evidence is not mistaken for a metadata-only update. Local Congress-end closure
does not change the source fingerprint. Before importing, finish identity validation, then deploy and exercise replay.

### Production historical-membership schema, September 8, 2026

Read-only preflight found no active PostgreSQL queries or index builds; the latest four committee backfill runs were
completed. Production had only the two earlier end-reason values and no historical-observation constraint.

Applied the missing `historical_at_first_observation` enum value, added the baseline
`organization_memberships_historical_observation_check` as `NOT VALID`, then explicitly validated it. Each operation
used its own transaction with a two-second lock timeout and twenty-second statement timeout. PostgreSQL now reports
`convalidated=true`; the expression requires a session, inactive status, and null detected start/end/last-observed
dates for historical first observations.

Before and after: 43,948 membership rows, identical full-row ordered checksum `a29a0fc9c33851c8edf4256c3e75af32`
(`md5(string_agg(md5(row_to_json(m)::text), '' order by id))`). No rows were rewritten, no indexes were rebuilt,
and no import was launched. The one-use local application script was removed after successful verification.

### Reviewed Cochran name/state contradiction, September 8, 2026

The three 106th editions each print `Kent Cochran, of North Dakota` in Marketing Inspection and Product Promotion
and Production and Price Competitiveness, both under Agriculture, Nutrition and Forestry. This is present in the
[original 1999 Directory, printed page 345](https://www.govinfo.gov/content/pkg/CDIR-1999-06-15/pdf/CDIR-1999-06-15.pdf),
not a parser-created name. Kent Conrad is separately listed in Marketing; substituting him based on first name/state
would therefore be incorrect.

Independent assignment evidence: the [February 8, 1999 Congressional Record, Daily Digest D114](https://www.govinfo.gov/content/pkg/CREC-1999-02-08/pdf/CREC-1999-02-08.pdf)
reports the January 26 subcommittee assignments, listing Cochran in both children and Conrad separately in Marketing.
The [October 2000 Directory, printed page 452](https://www.govinfo.gov/content/pkg/CDIR-2000-10-01/pdf/CDIR-2000-10-01.pdf)
also lists both assignments under COCHRAN. The parent roster identifies Thad Cochran of Mississippi.
The [official House biography C000567](https://history.house.gov/People/Listing/C/COCHRAN,-William-Thad-(C000567)/)
confirms William Thad Cochran's Mississippi Senate service during the 106th Congress. Production canonical identity
is `person:congress:c000567`, `Cochran, Thad`, with two consistent 106th upper-chamber terms and no district.

The edition-fingerprinted manifest resolves exactly these two original cells per edition (six appearances), without
rewriting source names/states or adding a global alias. Name/state corrections require all reviewed child contexts
to share the exact single corroborating parent; missing, changed or conflicting evidence fails closed. Fresh parsed
rosters and the production identity catalog validated all six mappings. Other unresolved identities still block
publication, and this change launches no import.

### Reviewed McIntyre/Dreier spellings, September 8, 2026

All three 106th editions print `Mike McIntrye` in Military Procurement and Military Readiness, while their Armed
Services parent correctly prints `Mike McIntyre`, North Carolina. The [Directory's House committee granule](https://www.govinfo.gov/content/pkg/CDIR-1999-06-15/html/CDIR-1999-06-15-HOUSECOMMITTEES.htm)
also prints `David Drier`, California, as Rules chair and as a member of Legislative and Budget Process and Rules
and Organization of the House. The correction preserves those roles; it does not promote him to subcommittee chair.

Independent checks: [McIntyre's official biography, M000485](https://history.house.gov/People/Detail/17932),
the contemporary [Military Readiness hearing](https://commdocs.house.gov/committees/security/has081030.000/has081030_0.HTM),
and [Military Procurement hearing, HASC 106-50](https://commdocs.house.gov/committees/security/has076200.000/has076200_0.HTM)
identify Mike McIntyre of North Carolina. [Dreier's official biography, D000492](https://history.house.gov/People/Listing/D/DREIER,-David-Timothy-(D000492)/)
confirms his 106th Rules chairmanship. These are manual validation references, not new ingestion providers.

Production canonical people and 106th terms match `person:congress:m000485` (NC district 7) and
`person:congress:d000492` (CA district 28). The fingerprinted manifests add exactly five reviewed cells per edition,
15 appearances total, and retain exact parent checks. Fresh read-only validation passed all three editions, including
the prior Cochran decisions. The 107 focused normalization, identity and synchronization tests passed. Other unresolved
names still prevent publication; no data import was launched.

### Reviewed Jackson Lee spelling, September 8, 2026

All three 106th editions print `Shelia Jackson Lee`, Texas, in Judiciary, Crime, and Immigration and Claims.
The [original House committee granule](https://www.govinfo.gov/content/pkg/CDIR-1999-06-15/html/CDIR-1999-06-15-HOUSECOMMITTEES.htm)
contains the same typo. [Official biography J000032](https://history.house.gov/People/Listing/J/JACKSON-LEE,-Sheila-(J000032)/)
identifies Sheila Jackson Lee and confirms Judiciary service during the 106th Congress. Independent contemporary
rosters and attendance identify her in both children: [Immigration and Claims, June 10, 1999](https://commdocs.house.gov/committees/judiciary/hju62494.000/hju62494_0.HTM),
and [Crime, July 13, 2000](https://commdocs.house.gov/committees/judiciary/hju66179.000/hju66179_0.HTM).
These are manual validation references, not additional ingestion providers.

Production identity `person:congress:j000032`, `Jackson Lee, Sheila`, has consistent 106th lower-chamber terms for
Texas district 18. The edition-fingerprinted decision covers exactly three cells per edition, nine appearances;
it neither rewrites source spelling nor creates a general typo alias. All existing fingerprint, parent, state,
identity and term guards remain in force. Other unresolved names still block publication; no import was launched.
Fresh source parsing against the production catalog validated all nine mappings; the focused identity,
historical-observation, normalization and synchronization suite passed 108 tests.

### Reviewed Brownback full name, September 8, 2026

Each of the three 106th editions prints `Samuel Dale Brownback`, Kansas, in Commerce, Science, and Transportation
and five children: Aviation; Communications; Consumer Affairs, Foreign Commerce and Tourism; Manufacturing and
Competitiveness; Surface Transportation and Merchant Marine. Other sections print `Sam Brownback`. This is a
full-name variation, not evidence of a different person or an incorrect assignment.

[Bioguide B000953](https://bioguideretro.congress.gov/Home/MemberDetails?memIndex=B000953) identifies Sam Dale
Brownback's Kansas Senate service, 1996–2011; the [FEC candidate record](https://www.fec.gov/data/candidate/S6KS00122/)
uses Samuel Dale Brownback. Contemporary [Manufacturing hearing rosters](https://www.govinfo.gov/content/pkg/CHRG-106shrg74874/html/CHRG-106shrg74874.htm)
and [Aviation hearing rosters](https://www.govinfo.gov/content/pkg/CHRG-106shrg86337/html/CHRG-106shrg86337.htm)
independently print Sam Brownback of Kansas in Commerce and those children. The target Directory itself supplies all
six reviewed assignments; no assignment is imported from another Congress. These references are manual evidence only.

The canonical catalog has `person:congress:b000953`, `Brownback, Sam`, with consistent 106th Senate terms and no
district. The full-roster-fingerprinted manifest covers exactly six cells per edition, 18 appearances, retaining
state, chamber, parent and canonical-term guards. No general Sam/Samuel expansion is introduced. Other unresolved
identities still prevent publication; no import is launched by this correction.
Fresh source parsing against the production catalog validated all 18 appearances. The focused identity,
historical-observation, normalization and synchronization suite passed 109 tests.

### Reviewed Bennett chair identity, September 8, 2026

All three 106th Directory editions print `Bob Bennett`, Utah, as chair of the Special Committee on the Year 2000
Technology Problem. Other Senate committee cells print `Robert F. Bennett`. The Senate's contemporary
[February 23, 2000 opening statement](https://www.jec.senate.gov/archive/Documents/Hearings/bennet22300.htm)
explicitly identifies Senator Robert F. Bennett as chair of this exact committee. This verifies both the actual
person and assignment, rather than assuming a general Bob/Robert nickname rule.

Production identity `person:congress:b000382`, `Bennett, Robert F.`, has consistent 106th Senate terms and no district.
The fingerprinted decision resolves only the single printed cell per edition (three appearances), preserving its
chair role. It does not infer service dates from the hearing date or establish continuous service between editions.
The Directory remains the ingestion source; the Senate statement is manual validation evidence. Other unresolved
identities still block publication, and no import was launched.
Fresh parsing against the production catalog validated all three appearances; the focused identity,
historical-observation, normalization and synchronization suite passed 110 tests.

### Reviewed Fowler middle initial, September 8, 2026

All three 106th editions print `Tillie K. Fowler`, Florida, in Armed Services, Military Installations and Facilities,
Military Readiness, Transportation and Infrastructure, Ground Transportation, and Oversight, Investigations and
Emergency Management. The last assignment is explicitly chair; the remaining cells carry no leadership role.

[Official biography F000328](https://history.house.gov/People/Listing/F/FOWLER,-Tillie-Kidd-(F000328)/) identifies
Tillie Kidd Fowler, her 103rd–106th House service, both parent committees, and her 106th oversight chairmanship.
A contemporary [March 1, 2000 Military Readiness hearing roster](https://commdocs.house.gov/committees/security/has061030.000/has061030_0.HTM)
also prints Tillie K. Fowler of Florida. The target Directory supplies all six assignments; the biography and
hearing are manual validation references, not new ingestion providers or sources of invented dates.

The production catalog identifies `person:congress:f000328`, `Fowler, Tillie`, with consistent 106th House terms
for district 4. The edition-fingerprinted manifest resolves six original cells per edition (18 appearances),
preserving roles and requiring the exact parents, state, chamber and canonical term. It does not add a global
middle-initial matching rule. Other unresolved identities continue to block publication; no import was launched.
Fresh source parsing and the production catalog validated all 18 appearances; 111 focused identity,
historical-observation, normalization and synchronization tests passed.

### Reviewed McHugh middle initial, September 8, 2026

All three 106th editions print `John H. McHugh`, New York, in Armed Services, Military Installations and
Facilities, Military Research and Development, and Special Oversight Panel on Morale, Welfare and Recreation.
The panel entry is chair. Other committees correctly use John McHugh or John M. McHugh.

The [official biography M000472](https://history.house.gov/People/Listing/M/MCHUGH,-John-Michael-(M000472)/)
identifies John Michael McHugh. Contemporary [Research and Development hearing rosters](https://commdocs.house.gov/committees/security/has070010.000/has070010_0.HTM)
and [Military Installations hearing proceedings](https://commdocs.house.gov/committees/security/has182040.000/has182040_0.HTM)
corroborate his service. The [March 10, 1999 panel hearing](https://commdocs.house.gov/committees/security/has069120.000/has069120_0.HTM)
explicitly identifies John M. McHugh of New York as chairman. These are manual validation references, not new
ingestion providers or evidence of precise tenure boundaries.

Production identity `person:congress:m000472`, `McHugh, John M.`, has consistent 106th House terms for district 24.
The fingerprinted manifest resolves only these four cells per edition, preserving the original roles and exact
parent, state, chamber and term checks. Fresh source parsing against the production catalog validated all 12
appearances. All 112 focused identity, historical-observation, normalization and synchronization tests passed.
Other unresolved identities still block publication; this correction does not launch an import.

### Reviewed Frist nickname, September 8, 2026

All three 106th editions print Bill Frist of Tennessee in 14 committee/subcommittee cells. The exact contexts are
Budget; Commerce, Science, and Transportation and its Aviation, Communications, Manufacturing and Competitiveness,
Science, Technology and Space, and Surface Transportation and Merchant Marine children; Foreign Relations and its
African Affairs, International Economic Policy, Export and Trade Promotion, and International Operations children;
Health, Education, Labor and Pensions and its Children and Families and Public Health children.

The [same-edition Tennessee biography](https://www.govinfo.gov/content/pkg/CDIR-1999-06-15/html/CDIR-1999-06-15-TN-S-2.htm)
identifies William H. Frist and lists the four parent committees. [Bioguide F000439](https://bioguideretro.congress.gov/Home/MemberDetails?memIndex=F000439)
confirms his Tennessee Senate service. Contemporary [Science, Technology and Space hearing](https://www.govinfo.gov/content/pkg/CHRG-106shrg74817/html/CHRG-106shrg74817.htm),
[African Affairs hearing](https://www.govinfo.gov/content/pkg/CHRG-106shrg68756/html/CHRG-106shrg68756.htm), and
[106th HELP activity report, Public Health section](https://www.govinfo.gov/content/pkg/CRPT-107srpt11/pdf/CRPT-107srpt11.pdf)
independently confirm the three printed chair roles. These are manual evidence, not additional ingestion providers.
The biography also mentions Small Business, but this review adds no assignment absent from the committee roster.

The canonical catalog has `person:congress:f000439`, `Frist, William H.`, with consistent 106th Senate terms and no
district. The decision is restricted to the three fingerprinted editions and their exact 14 contexts, not a general
Bill/William alias. Roles and observed-date semantics remain unchanged. The focused suite passed 113 tests.
Fresh parsing against the production catalog validated all 42 appearances across the three editions.
Other unresolved identities continue to block publication; no import was launched.
