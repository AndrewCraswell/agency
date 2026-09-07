# GovInfo committee edition inventory

Read-only discovery on 2026-09-06 used the CDIR collection endpoint with a modification window beginning
1970-01-01 and a Congress filter. All collection pages were exhausted. Discovery itself wrote no historical memberships;
subsequent validated production imports are recorded in [rollout evidence](committee-membership-history.md).

| Congress | Available package issue dates | Whole-package text |
| --- | --- | --- |
| 105 | 1997-06-04 | Not advertised |
| 106 | 1999-06-15, 2000-02-01, 2000-10-01 | Not advertised |
| 107 | 2001-12-07, 2002-10-01 | Not advertised |
| 108 | 2003-07-11, 2003-11-01, 2004-01-01, 2004-08-01 | Not advertised |
| 109 | 2005-07-11, 2006-09-01 | Not advertised |
| 110 | 2007-08-09, 2008-08-01 | Not advertised |
| 111 | 2009-12-01 | Not advertised |
| 112 | 2011-12-01 | Not advertised |
| 113 | 2014-02-18 | Not advertised |
| 114 | 2016-02-12 | Not advertised |
| 115 | 2018-07-27, 2018-10-01 | Not advertised |
| 116 | 2020-07-22 | Not advertised |
| 117 | 2022-10-26 | Not advertised |
| 118 | 2024-04-25 | Available; coordinate-ordered PDF parser validated structurally |
| 119 | 2026-02-20 | Available; 221 organizations, 3,875 source entries |

There are 23 historical editions, plus the current edition. Multiple editions permit observed transitions only between
those retained snapshots. Single-edition Congresses support a snapshot, not a complete join/departure sequence.

## Historical format gates

The package summaries for Congresses 105–117 do not advertise whole-package text. Constructed `.txt` URLs can return
HTML fallback pages with HTTP 200. These responses must not be mistaken for valid directories.

The 105th Congress provides committee granules, including `CDIR-1997-06-04-SENATECOMMITTEES` and
`CDIR-1997-06-04-HOUSECOMMITTEES`. Their summary advertises a `txtLink` ending in `/htm`: it is preformatted source
text wrapped in HTML, not XML. The Senate example uses full state names for parent committee rosters and abbreviated
names such as `Mr. Santorum` for subcommittees. The modern state/district-annotation parser cannot parse this safely.

The 118th whole-directory text exists but fails the original heading parser. None of the 23 historical editions passed
the original whole-package ingestion path. This was a format-support gap, not evidence that GovInfo lacks historical data.

The new coordinate-ordered PDF path recovers 42 parent committees, 180 subcommittees, and 3,670 source entries for the
118th. Printed-name normalization handles detached accents, quoted nicknames, and suffix punctuation. Five corrections
are restricted to `CDIR-2024-04-25` and require a corroborating roster entry with the corrected full name and identical
state/district in that same edition:

| Printed error | Corroborating name | District |
| --- | --- | --- |
| Paul P. Sarbanes | John P. Sarbanes | MD-03 |
| Debbie Pingell | Debbie Dingell | MI-06 |
| Vicente Gonzales | Vicente Gonzalez | TX-34 |
| Garret Graves T4 | Garret Graves | LA-06 |
| Lori Chaves-DeRemer | Lori Chavez-DeRemer | OR-05 |

These are not global person aliases or fuzzy surname matching. Without same-edition corroboration, the original name
must pass strict canonical matching or abort the edition.

The 105th's same-edition assignment table positively identifies Smith of Michigan on the Agriculture subcommittees,
while Smith of Oregon is listed on the parent Agriculture committee only. The assignment resolver requires an exact
parent/subcommittee match and state-qualified surname; parent membership alone is insufficient evidence.

Before publishing historical data:

1. Discover and validate committee granules and their advertised text renditions for every edition.
2. Add format-specific parsing with parent-roster-scoped resolution of abbreviated subcommittee names; reject ambiguity.
3. Reconcile source member counts and canonical Congress-scoped identities, including select/special committee coverage.
4. Prevent historical organization metadata from replacing current organization state during backfill.
5. Import complete editions chronologically, verify Congress-end closure, and smoke-test historical API resources.

## Canonical identity prerequisite

Before the identity backfill, production term coverage was incomplete for historical Congresses: 43 distinct people for the 105th, 391 for the
117th, 470 for the 118th, and 555 for the 119th. These are database coverage counts, not expected chamber sizes.
The existing Congress.gov person/term range importer must fill missing identities before complete historical committee
snapshots can pass strict Congress-scoped matching. Congress.gov remains an identity source, not a new committee source.
Do not match historical abbreviated names to current members merely because a surname agrees.

The bounded 105–119 identity backfill on 2026-09-06 completed successfully, processing 1,623 people and 20,064 term
records (`3c3acf04-2e45-4369-b5f7-3a411aef03e0`). Empty Congress responses abort before replacement; term inserts use
1,000-row batches.

Final reconciliation uncovered a pre-existing collection-normalization bug: lifetime career terms were labeled with
the requested Congress even when their years did not overlap it. The importer now discards only strictly disjoint
year intervals, preserving ambiguous boundary years. A scoped cleanup removed 1,158 impossible term rows after
archiving them to `D:/agency/tmp/committee-term-out-of-window-20260906.json`; 18,906 term rows remain. For example,
Robert Menendez's 1993–2006 House career no longer competes with his son's valid 118th House term.

Historical committee publication is a separate acceptance gate from identity backfill completion.

Final 118th reconciliation passed with 222 organizations, 3,670 source memberships, and zero unmatched people.
The 116th and 117th PDF paths pass hierarchy checks. Same-edition individual member summaries expose Congress,
chamber, state, Bioguide ID, and exact printed-name aliases. The bounded alias fallback resolves Patrick J. Toomey,
Roger W. Marshall, and C. Scott Franklin without fuzzy matching or another source. Final 116th reconciliation passes
with 215 organizations, 3,678 entries, and zero unmatched people. The 117th retains two unresolved entries: Tom Udall
in Appropriations and a state suffix printed inside Jamaal Bowman's name. Congresses 105–115
remain gated on older layout support; all 20 advertised-HTML editions failed strict parsing during the bounded inventory.

A second read-only pass checked all 20 older editions' advertised PDFs with the assignment resolver enabled:

- 105: unresolved printed `Aschcroft` abbreviation.
- 106: `(No Vice Chairman)` annotation.
- 107: standalone punctuation in a roster.
- 108: wrapped Speaker's Designee / Vice Chairman annotation.
- 109: `of the District of Columbia` variant.
- 110–111: Retirement and Aging heading joined to the preceding roster.
- 112–113: Primary Health and Aging heading joined to the preceding roster.
- 114: a member roster remained in staff scope.
- 115 July edition: provisional 210 organizations / 41 parents / 3,643 entries; hierarchy and identity audit still required.
- 115 October edition: detached acute accent following Peter J. Visclosky's name.

No older PDF edition was published from this diagnostic. Font-data warnings also require review before accepting the
older PDF extraction path. A parser returning records is not, by itself, evidence of complete or correctly nested rosters.

The subsequent conservative formatting pass accepts the explicit No Vice Chairman note, isolated punctuation,
wrapped vice-chair annotations, and `of the District of Columbia`. Remaining older PDF blockers include
`Bob Graham. of Florida.` (106), `Masschusetts` (107), No Subcommittees (108), a party-organization boundary (109),
the heading/staff issues above (110–114), and a standalone accent (115 October). Those editions remain unpublished.

A direct 117th source review confirms Tom Udall is actually printed in the Senate committee granule, PDF page 4
(printed page 352), under Appropriations. This is not a parser mix-up and cannot be safely assigned to a 117th term
or silently replaced with another senator. The Bowman issue is redundant `, NY` text on House granule PDF page 43,
Science, Space, and Technology / Energy; it is separately resolvable without guessing. Publishing the 117th while
omitting the stale Udall entry would require an explicit incomplete-roster/quarantine policy; current import remains
fail-closed rather than silently omitting it.

### Follow-up parser verification (2026-09-07)

Conservative formatting fixes now handle explicit no-subcommittee notes, isolated accent glyphs, the National
Republican Senatorial Committee boundary, touching HELP headings, and the multiline Benghazi select-committee title.
Bounded advertised-PDF diagnostics produced:

| Edition | Organizations | Parents | Source memberships | Acceptance |
| --- | --- | --- | --- | --- |
| 2005-07-11 | 209 | 41 | 3,781 | Structure and identity audit pending |
| 2007-08-09 | 217 | 42 | 3,743 | Structure and identity audit pending |
| 2016-02-12 | 210 | 42 | 3,545 | Structure and identity audit pending |
| 2018-07-27 | 210 | 41 | 3,643 | Full structure and identity reconciliation passed; October edition still blocks Congress import |

These diagnostic successes do not enable the older production import path. Remaining first parser failures include
Calvin Dooley's missing comma (108), a touching Western Hemisphere heading (112), merged Mike Quigley member cells
(113), and `Peter Welch,´of` without spacing (115 October). Earlier inventory failures above describe earlier passes,
not regressions. None of these older editions has been published.

The redundant state suffix in the reviewed 117th edition now has a normalization fix requiring same-edition,
same-state/chamber corroboration and a unique canonical identity. This does not resolve the stale Udall entry or
authorize incomplete publication.

Final July 2018 reconciliation used 192 exact same-package aliases and yielded 3,643 distinct memberships with zero
unmatched people. GovInfo's known name fields accept strings or arrays of strings; non-string array elements still
fail validation. The printed `Benajmin L. Cardin` and `Thom Tills` corrections are limited to this edition and require
correctly spelled names elsewhere in the same edition, same state/chamber, and a unique canonical identity.
No 115th memberships were written; the October edition remains unvalidated.

### Complete-edition prevalidation (2026-09-07)

Historical Congresses now use their advertised coordinate-ordered PDFs. Before publishing any pending edition,
the importer parses and reconciles every pending edition for that Congress. Source or identity failures therefore
write no roster snapshots; database failures remain resumable through atomic per-edition checkpoints.

The corrected 114th edition passes full structure and identity review: 210 organizations, 42 parents, and 3,546
distinct memberships, with zero unmatched people. Review recovered LoBiondo's CIA subcommittee chair entry and
corrected truncated Transportation and Small Business headings. Production import is still a separate gate.

The bounded biography scan permits 600 summaries and uses explicit state/chamber identity constraints. Missing
BioGuide IDs provide no aliases; they do not bypass final unmatched-member rejection. Current unresolved gates:
105 full-edition verification after the source-backed Nickles repair; 106 Indian Affairs staff boundary;
107 complete-source verification interrupted by GovInfo timeouts; 109 52 unmatched assignments;
113 nine Horsford/Nadler assignments; 117 stale Udall source entry.

The 105th `Aschcroft` spelling is resolved only through the exact parent/subcommittee assignment and a unique
matching parent member. The 106th `Mississppi` and 107th `Masschusetts` spellings require the same exact printed
person with the correct state elsewhere in that granule. These bounded repairs do not authorize importing incomplete editions.
The 105th `Nickels` repair likewise requires the same-edition positive Nickles Investigations assignment and a unique
parent member, restricted to Governmental Affairs / Permanent Subcommittee on Investigations.
The next 105th correction handles printed `Thumond` only in Judiciary / Antitrust, Business Rights and Competition,
where the same directory explicitly assigns Thurmond and has a unique Strom Thurmond parent member. Absence of
that assignment, a different committee/subcommittee, or multiple parent candidates still fails closed.

The 112th now fully reconciles: 218 organizations and 3,580 distinct memberships, zero unmatched or duplicates.
Canonical terms whose explicit start year is later than the edition year cannot identify an edition member.
This separates the two Donald M. Payne identities for the 2011 edition, while preserving same-year and unknown-start
ambiguity. No exact committee appointment or departure date is inferred.

The 112th production import and unchanged rerun are verified; see the membership-history release record.
The resumed 108th audit reached August 2004: 206 organizations and 3,856 source entries, of which 3,817 map uniquely
and 39 remain unresolved across 13 printed names. These are Lindsey O. Graham (7), John W. Warner (1), Bill Frist (6),
Steven King (3), Ed Schrock (4), Marty Meehan (3), Gresham Barrett (1), Thomas Cole (3), Timothy J. Ryan (3),
Eni Faleomaveaga (1), Chris Smith (1), Mike Bilirakis (2), and Richard M. Burr (4). No mapped duplicates were found.
The September 7 retry completed the other three editions (2003-07-11, 2003-11-01 and 2004-01-01).
All four have the identical counts and unresolved-name profile above, with no mapped duplicates. Source transport
is no longer the blocker. These completed canonical diagnostics do not establish full structural acceptance or
resolve the 39 identity gaps; no partial roster was imported.

The reconnected 113th source check confirms the nine unresolved entries are not missing metadata downloads:
GovInfo's Bioguide-backed biographies identify Steven Horsford (`H001066`) and Jerrold Nadler (`N000002`), but
all eight Horsford roster entries print `Steven A. Horsford`, and one Nadler subcommittee prints `Jerry Nadler`.
Five other Nadler rosters print Jerrold. Assignment tables supply surnames, not explicit equivalence between these
full names. No additional alias or surname-based identity inference has been introduced; the edition remains unpublished.

Reconnected 106th/107th source checks exposed two parser boundaries, now covered by regression tests:
the 106th Senate select rosters touch explicit `Staff Director/Chief Counsel` labels without a blank line;
the 107th state-spelling matcher crossed a multi-space column gap and included a neighboring Arizona cell in
Capuano's name. The parser now separates the explicit staff boundary and confines spelling corroboration to one
printed name. Unexplained roster text and uncorroborated misspellings still fail. Full-edition acceptance remains separate.
Further source review corrected the exact unbracketed Senate reauthorization note being read as a heading and
recognized year-bearing Special Committee headings. A detached period in a PDF cell now retains its column slot,
so Norton's wrapped District of Columbia state does not attach to the neighboring Davis entry; Watson is preserved too.
Both 107th editions now parse completely: 205 organizations / 3,732 printed entries (December 2001), and
205 / 3,721 (October 2002). These are parser counts, not yet full structural and canonical-identity acceptance.
The combined boundary regressions and assignment tests pass 46 tests; service and web type checks pass.
Targeted live rereads of all three 106th Senate select sections confirm five separate committees with source counts:
Indian Affairs 14, Ethics 6, Intelligence 19, Aging 20, and Year 2000 Technology Problem 9. Staff entries and the
reauthorization annotation no longer enter the rosters. This verifies these sections only, not the whole Congress.
The final isolated legislation coverage run passed 2,092 tests across 244 files plus four receiver tests; 60
database-dependent tests remain skipped. Root verification is blocked by unrelated scoring coverage thresholds.
The subsequent 107th identity audit remains blocked: December 2001 maps 3,675 entries uniquely with 57 unresolved;
October 2002 maps 3,656 uniquely with 65 unresolved. Neither has mapped duplicates. No 107th rows were imported.
These counts supersede the earlier network-only blocker; source-name reconciliation and structural acceptance remain open.

The 105th source review reached a missing honorific: `Dr. Frist` in Children and Families was concatenated to the
preceding `Mr. Gregg` row. `Dr.` is now recognized consistently alongside the existing honorifics, including standalone
chair blocks. Resolution still requires a unique matching parent member; missing and ambiguous parents are rejected.
This parser correction does not establish full 105th structural or identity acceptance.
The 48 focused parser/assignment tests, scoped lint/format, and both type checks pass. The next live 105th failure
is an Indian Affairs staff label, `Majority Staff Director.—Gary Bohnee.`, touching the roster; the existing explicit
staff boundary recognizes only the Director/Chief Counsel variant. No import or identity inference was performed.
Root verification passed its check stage but remains blocked by the unrelated scoring coverage thresholds.

The 105th touching `Majority Staff Director.—Gary Bohnee.` boundary is now handled alongside the 106th
Director/Chief Counsel form. Regression coverage preserves the last member and following committee while
rejecting an unexplained replacement line. All 43 historical parser tests, scoped lint/format, and service/web
type checks pass. Full 105th source and canonical reconciliation remain pending; this change authorizes no import.

The subsequent live check reaches a 105th numbered vacancy cell (`1 vacancy`) attached to `Mr. Campbell`.
All three 106th full-edition checks reach the same Budget annotation wrap: Saxby Chambliss's `(Speaker's`
continues as `Designee).` in the same column. These are formatting blockers, not missing people.
The bounded parser repair ignores only exact numbered vacancy cells and joins the designation only with its
matching preceding fragment. A Speaker's designation alone is not a chair role; explicit vice-chair text remains
a vice-chair role. Unknown continuations still fail closed. Neither Congress is accepted for import yet.
This batch passes 53 focused parser/assignment tests, scoped lint/format, and service/web type checks.
Root verification passes the check stage, then stops at the unrelated scoring coverage thresholds.
The live 105th retry passes the vacancy boundary and reaches ambiguous `Mr. Ney` matching four parent candidates;
the next investigation is surname-boundary matching, not an alias. All three 106th retries pass the designation
and reach an unhandled `*` role annotation in Commerce. No database writes or deployment were performed.

The Ney blocker is a suffix-boundary defect: `Ney` also matched surnames such as `McKinney`.
Abbreviated roster and positive-assignment candidate matching now require a whole normalized name boundary,
preserving compound surnames and rejecting absent or genuinely ambiguous people. This adds no aliases.
The 106th Commerce marker is substantive: all three editions say Thomas M. Davis III was assigned to Commerce
and placed on sabbatical leave for the 106th Congress. It must not be stripped as a generic footnote.
How to represent that leave remains a product/schema decision; the 106th remains unpublished pending resolution.
Live 105th parsing now passes Ney and stops at two `Ms. Maloney` candidates in Domestic and International
Monetary Policy. Positive source disambiguation remains required; no memberships were guessed or imported.
The surname-boundary batch passes 58 focused tests and the root check stage (format, lint, types and unused-code
checks). Root coverage remains blocked by unrelated scoring thresholds. The Commerce leave note is confirmed in
each edition's advertised `HOUSECOMMITTEES` PDF; it covers the Congress without specifying exact calendar dates.

The 105th assignment table explicitly lists `Maloney, C. of New York` under Banking and Financial Services /
Domestic and International Monetary Policy. `Maloney, J. of Connecticut` instead lists Housing and Community
Opportunity. The lookup rejected the comma-initial identity before checking the assignment. The bounded repair
recognizes that printed format while requiring surname, given-name initial, state and positive assignment to agree
with the parent roster. It does not infer identity from the `Ms.` honorific or add an alias.
The repair passes 59 focused tests, scoped lint/format and service/web types. The live full-edition retry passes
Maloney and reaches a numeric `1` role marker in Commerce. That marker needs source-footnote review before any
normalization; no complete 105th acceptance, deployment or import is claimed.

The next read-only 107th alias audit checked Schrock, Lamar Smith and Issa in both editions. Schrock's individual
summary (`S001151`) and biography supply Edward, not the roster's Ed. Lamar Smith's summary (`S000583`) and
biography do not supply the roster's middle initial S. Neither edition advertises an Issa individual granule;
the California delegation summary supplies no Bioguide member metadata. These are source-evidence gaps, not
exact aliases accidentally omitted by the loader. No inferred aliases or partial imports were added.
The 105th Commerce `1` marker refers to Pallone's election on February 13, 1997 after an earlier sabbatical;
unlike the 106th Davis note, it describes ended leave. It must not be discarded through generic digit stripping.
The Pallone correction now requires the complete, exact same-granule election-after-leave paragraph, the House
Commerce parent, and the exact Pallone/New Jersey/marker-1 cell. It emits an ordinary snapshot member without
adding actual tenure dates. Missing or changed evidence, other members, markers and committees still reject.
All 60 focused parser/assignment tests, scoped lint/format and service/web types pass. Live 105th parsing passes
Commerce and next encounters `Employer-Employee Relations` touching the preceding Roemer roster entry in Education
and the Workforce. No complete 105th acceptance or import is claimed; 106th active-leave handling remains unchanged.
The next source check confirms two touching headings in Education and the Workforce: Employer-Employee Relations
after Roemer, and Oversight and Investigations after Tierney. Exact standalone-line boundaries now preserve those
preceding members and keep both subcommittees under their parent. A live full-edition retry passes these boundaries
and reaches an unparsed `Bernard Sanders` entry in Government Reform and Oversight; no identity or state is inferred.
The heading batch passes 61 focused parser/assignment tests, scoped lint/format and service/web types.
Both 105th renditions omit Sanders's state in Government Reform and Oversight, while the same granule's Banking
roster explicitly prints `Bernard Sanders, of Vermont.`. The repair is limited to that exact parent/person cell and
requires unique, non-conflicting same-granule state evidence. It is not a general full-name lookup or nickname alias.
The live retry passes this entry and reaches `Mr. T. Davis, Chairman` in the District of Columbia subcommittee;
that initial-qualified abbreviation remains unresolved. No import or 106th leave-policy change was made.
The Sanders batch passes 62 focused parser/assignment tests, scoped lint/format and service/web types.
Repository verification passes the check stage but remains blocked by the unrelated scoring coverage thresholds.
The 105th Government Reform parent explicitly lists Thomas M. Davis III (Virginia) and Danny K. Davis (Illinois).
Subcommittees distinguish them as `T. Davis` and `D. Davis`. The parser now requires the printed single initial,
whole surname and a unique parent-roster match; assignment fallback cannot override those constraints.
All 63 focused parser/assignment tests, scoped lint/format and service/web types pass. The live retry passes Davis
and next stops where `Mr. Hastings`, a vacancy and `Asia and the Pacific` are joined in International Relations.
That layout boundary remains unresolved; no complete 105th acceptance or import is claimed.
The complete International Relations section review found three touching standalone headings: Asia and the Pacific,
International Operations and Human Rights, and International Economic Policy and Trade. Their explicit boundaries
now preserve adjacent members; bare `vacancy` cells retain empty column positions rather than joining a member name.
Unknown vacancy annotations still reject. All five subcommittee boundaries are covered by the regression fixture.
The batch passes 64 focused parser/assignment tests, scoped lint/format and service/web types. A live full-edition
retry passes International Relations and stops at the printed `Ms. Lofgen` in Judiciary / Immigration and Claims.
That name discrepancy requires positive source evidence; no inferred alias or historical import was added.
The same edition explicitly lists `Zoe Lofgren, of California.` in Judiciary and assigns `Lofgren` to Immigration
and Claims in its assignment table. The bounded `Lofgen` correction requires that exact unique parent identity and
positive assignment clause. Its bare-surname House assignment exception does not apply to other names or contexts.
All 65 focused parser/assignment tests, scoped lint/format and service/web types pass. The live full-edition retry
passes this entry and next stops at `Mr. McIntyre` in National Security / Military Procurement. That discrepancy
remains unmodified; no full 105th acceptance, deployment or import is claimed.
National Security prints `Mike McIntrye, of North Carolina.`, while the same House granule's Agriculture roster
prints `Mike McIntyre, of North Carolina.` and its assignment table confirms Military Procurement. The exact
National Security parent-cell repair requires unique, non-conflicting same-granule full-name/state corroboration;
it does not use general transposition matching. Original source text and neighboring members are preserved.
All 66 focused parser/assignment tests, scoped lint/format and service/web types pass. The live retry passes Military
Procurement and stops at `Mr. Abercombie` in National Security / Special Oversight Panel on the Merchant Marine.
That further discrepancy remains unchanged; no full 105th acceptance or import is claimed.

The next reviewed batch restores 108/112 OGM/FFM headings and removes 112/113 footnote/vacancy annotations.
All affected per-roster membership hashes and counts remain identical. Independent source-entry reconciliation
accepts 111 at 218 organizations / 3,896 entries and both 110 editions at 217 / 3,743. Each 110 edition contains
one identical Daniel Lipinski entry in House Small Business, producing 3,742 distinct memberships. Both 110
editions also pass canonical identity reconciliation with zero unmatched people.

Source-scoped name variants may omit intervening initials while retaining explicit first/surname and unique
state/chamber identity. Louis/Luis Fortuño corrections are limited to the two reviewed 110th editions and require
same-edition corroboration. They are not generic nickname substitutions.

October 2018 now passes full structural review at 210 organizations / 3,643 entries. Its separately positioned
acute-accent glyph is ignored for PDF column spacing; all base letters remain. The package legitimately advertises
October 29 granule IDs despite its October 1 package ID. Biography lookup accepts these advertised IDs while
retaining exact requested-package URL and returned identity checks. Final October canonical re-audit passes:
3,643 distinct memberships, zero unmatched and no duplicates. The Cardin/Tillis corrections are enabled only for
the two reviewed 115th package IDs, with correct same-edition, state/chamber corroboration required.

Source endpoints: `https://api.govinfo.gov/collections/CDIR/1970-01-01T00:00:00Z?congress=105&offsetMark=*&pageSize=100`
and `https://api.govinfo.gov/packages/CDIR-1997-06-04/summary`. Credentials are supplied only in request headers.

See [membership semantics and rollout](committee-membership-history.md).
