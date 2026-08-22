# LegiScan reference values

These are the enumerations published in API Manual v1.91. Persist numeric IDs and raw labels because display text and
upstream coverage can change independently.

## Bill types

| ID | Code | Description |
| --- | --- | --- |
| 1 | `B` | Bill |
| 2 | `R` | Resolution |
| 3 | `CR` | Concurrent Resolution |
| 4 | `JR` | Joint Resolution |
| 5 | `JRCA` | Joint Resolution Constitutional Amendment |
| 6 | `EO` | Executive Order |
| 7 | `CA` | Constitutional Amendment |
| 8 | `M` | Memorial |
| 9 | `CL` | Claim |
| 10 | `C` | Commendation |
| 11 | `CSR` | Committee Study Request |
| 12 | `JM` | Joint Memorial |
| 13 | `P` | Proclamation |
| 14 | `SR` | Study Request |
| 15 | `A` | Address |
| 16 | `CM` | Concurrent Memorial |
| 17 | `I` | Initiative |
| 18 | `PET` | Petition |
| 19 | `SB` | Study Bill |
| 20 | `IP` | Initiative Petition |
| 21 | `RB` | Repeal Bill |
| 22 | `RM` | Remonstration |
| 23 | `CB` | Committee Bill |

## Event types

| ID | Description |
| --- | --- |
| 1 | Hearing |
| 2 | Executive Session |
| 3 | Markup Session |

## MIME types

| ID | Description | Extension |
| --- | --- | --- |
| 1 | HTML (`text/html` in client) | `.html` |
| 2 | PDF (`application/pdf`) | `.pdf` |
| 3 | WordPerfect (`application/wordperfect`) | `.wpd` |
| 4 | MS Word (`application/msword`) | `.doc` |
| 5 | Rich Text Format (`application/rtf`) | `.rtf` |
| 6 | MS Word 2007 (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) | `.docx` |

The official client additionally seeds IDs 7 Excel `.xls`, 8 Excel `.xlsx`, 9 CSV, 10 JSON, and 11 ZIP. These are not
published in the manual's wire enum and may be client/storage compatibility values.

## Political parties

| ID | API abbreviation | Description |
| --- | --- | --- |
| 1 | `D` | Democrat |
| 2 | `R` | Republican |
| 3 | `I` | Independent |
| 4 | `G` | Green Party |
| 5 | `L` | Libertarian |
| 6 | `N` | Nonpartisan |

Party values are not exhaustive of every possible political affiliation. Preserve unknown IDs/labels.

## Roles

| ID | Abbreviation | Description |
| --- | --- | --- |
| 1 | `Rep` | Representative / lower chamber |
| 2 | `Sen` | Senator / upper chamber |
| 3 | `Jnt` in client | Joint conference |

## SAST relationship types

| ID | Description |
| --- | --- |
| 1 | Same As |
| 2 | Similar To |
| 3 | Replaced By |
| 4 | Replaces |
| 5 | Cross-filed |
| 6 | Enabling For |
| 7 | Enabled By |
| 8 | Related |
| 9 | Carry Over |

## Sponsor types

| ID | Description |
| --- | --- |
| 0 | Sponsor, generic/unspecified |
| 1 | Primary Sponsor |
| 2 | Co-Sponsor |
| 3 | Joint Sponsor |

## GAITS stance

| ID | Request value | Description |
| --- | --- | --- |
| 0 | `watch` | Watch |
| 1 | `support` | Support |
| 2 | `oppose` | Oppose |

## Status and progress

| ID | Description | Use |
| --- | --- | --- |
| 0 | N/A / Prefiled | Overall status or progress; prefiled/pre-introduction. |
| 1 | Introduced | Overall status or progress. |
| 2 | Engrossed | Overall status or progress. |
| 3 | Enrolled | Overall status or progress. |
| 4 | Passed | Overall status or progress. |
| 5 | Vetoed | Overall status or progress. |
| 6 | Failed | Overall status or progress; limited support by state. |
| 7 | Override | Progress array only. |
| 8 | Chaptered | Progress array only. |
| 9 | Refer | Progress array only. |
| 10 | Report Pass | Progress array only. |
| 11 | Report DNP | Progress array only. |
| 12 | Draft | Progress array only. |

## Supplement types

| ID | Description |
| --- | --- |
| 1 | Fiscal Note |
| 2 | Analysis |
| 3 | Fiscal Note/Analysis |
| 4 | Vote Image |
| 5 | Local Mandate |
| 6 | Corrections Impact |
| 7 | Miscellaneous (`Misc` in client) |
| 8 | Veto Letter |

## Text types

| ID | Description |
| --- | --- |
| 1 | Introduced |
| 2 | Committee Substitute |
| 3 | Amended |
| 4 | Engrossed |
| 5 | Enrolled |
| 6 | Chaptered |
| 7 | Fiscal Note |
| 8 | Analysis |
| 9 | Draft |
| 10 | Conference Substitute |
| 11 | Prefiled |
| 12 | Veto Message |
| 13 | Veto Response |
| 14 | Substitute |

The official client marks types 7, 8, 12, and 13 as supplement-like and gives text versions an internal sort order. Those
client metadata fields are not present on the wire.

## Vote types

| ID | API detail label | Description |
| --- | --- | --- |
| 1 | `Yea` | Yea |
| 2 | `Nay` | Nay |
| 3 | `NV` | Not Voting / Abstain |
| 4 | `Absent` | Absent / Excused |

## Push reasons

The full enumeration and semantics are in [Bill Push reasons](push.md#bill-push-reasons).
