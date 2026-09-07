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
| 2018-07-27 | 210 | 41 | 3,643 | All 210 organization names/parent attachments reviewed; identity audit pending |

These diagnostic successes do not enable the older production import path. Remaining first parser failures include
Calvin Dooley's missing comma (108), a touching Western Hemisphere heading (112), merged Mike Quigley member cells
(113), and `Peter Welch,´of` without spacing (115 October). Earlier inventory failures above describe earlier passes,
not regressions. None of these older editions has been published.

The redundant state suffix in the reviewed 117th edition now has a normalization fix requiring same-edition,
same-state/chamber corroboration and a unique canonical identity. This does not resolve the stale Udall entry or
authorize incomplete publication.

Source endpoints: `https://api.govinfo.gov/collections/CDIR/1970-01-01T00:00:00Z?congress=105&offsetMark=*&pageSize=100`
and `https://api.govinfo.gov/packages/CDIR-1997-06-04/summary`. Credentials are supplied only in request headers.

See [membership semantics and rollout](committee-membership-history.md).
