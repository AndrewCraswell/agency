# Annual Title 5 quoted-revision scope

Reviewed September 15, 2026. This is a normalization correction for one immutable publisher artifact, not a general
rule for deciding when regulations take effect. ING-03 in the [production tasks](ingestion-production-tasks.md) owns
the source reconciliation; annual title publication remains subject to the complete-volume and source-date gates.

## Source evidence

The [official 2025 Title 5 volume 2 XML](https://www.govinfo.gov/bulkdata/CFR/2025/title-5/CFR-2025-title5-vol2.xml)
has 5,982,142 bytes and SHA-256 `f698bb1a9b200dd7a35846e93f119b96c02e66785226e73d3644a8fab61b88c7`.
Its January 1, 2025 edition includes quoted revisions effective January 17, 2025. The revision note after current
731.106 names only Subpart A, but its `REVTXT` also contains current Subpart B and nearly the remaining volume.
The note after current 731.206 names only Subpart B, but its `REVTXT` also contains Subparts C–F and later parts.

The [official printed Part 731 PDF](https://www.govinfo.gov/content/pkg/CFR-2025-title5-vol2/pdf/CFR-2025-title5-vol2-part731.pdf)
provides independent boundaries. Printed page 29 lists the six current subparts and their 22 sections. Page 39 switches
from the smaller-type quoted Subpart A revision into current Subpart B; page 43 similarly resumes current Subpart C
after the quoted Subpart B revision. Page 45 starts separate Part 732 after Part 731 ends. These three boundaries
were visually inspected, not inferred from the PDF filename, whose page range includes adjacent provisions.
Retained PDF and page renders: `artifacts/regulatory-backfills/annual-title5-source-review/`.

## Exact correction

Define the following original XML paths:

```text
S  = /CFRDOC[1]/TITLE[1]/CHAPTER[1]/SUBCHAP[1]
P  = S/PART[7]
A  = P/SUBPART[1]/SECTION[6]/EFFDNOTP[1]/REVTXT[1]
B  = A/SUBPART[2]
R  = B/SECTION[6]/EFFDNOTP[1]/REVTXT[1]
```

| Original node | Logical parent | Meaning |
| --- | --- | --- |
| B | P | Current Subpart B belongs to Part 731 |
| R/SUBPART[2..5] | P | Current Subparts C–F belong to Part 731 |
| R/PART[1..40] | S | Later parts belong to the same subchapter |

The last part is the publisher's `PART 990 [RESERVED]`, retained as a structural record without fabricated sections.
The first subpart in each revision remains quoted. Revisions to 731.302, 731.402, 752.404 and 752.604 also remain
quoted in their owning provisions. Authority-only revisions remain evidence blocks. Thus all 16 future SECTION
elements remain evidence rather than additional current identities.

The streaming parser keeps original source locators, keys, attributes, artifact hashes and raw bytes. A separate
logical parent chain controls record classification and parent membership. Emitted current child records are
detached from quoted blocks, avoiding duplicated text. Every one of the 45 reviewed parent overrides must occur.
The source ID, native volume ID and exact artifact hash must all match; any changed bytes retain the usual warning
and publication review gate. Final raw-byte hash verification prevents callers from activating the rule by lying
about the artifact hash. The existing parser-code hash binds the transformation to its normalized generation.

## Regression and release evidence

The losslessly compressed full official XML fixture exercises the real boundaries through Python parsing and strict
TypeScript shard validation. Tests reconcile every original section-number occurrence against current records plus
retained quotes, check the six subparts and 22 current Part 731 sections, validate later-part parents and reserved
Part 990, and reject duplicate identities. Changed source bytes must still trigger scope review; false hashes fail.
Existing annual quote, eCFR and Federal Register tests remain applicable.

The real three-volume replay completed without warnings. Volume 2 reconciles 1,711 original SECTION elements into
1,695 current section records and 16 retained quoted sections. Within the originally flagged 1,647-section scope,
1,631 are current and 16 are quoted. The full-volume regression also preserves all section-number occurrences in
contents and body blocks. The focused parser and PostgreSQL lifecycle run passed 73 tests.

| Volume | Published records | Current section records |
| --- | ---: | ---: |
| 1 | 2,219 | 1,781 |
| 2 | 2,101 | 1,695 |
| 3 | 2,483 | 1,877 |
| Total | 6,803 | 5,353 |

The existing local annual pilot on port 55440 published all three volumes atomically as annual edition
`b5b59bdf919c9224dc2168b122b3e762528e4f64368ea7e3f4141cbffcab2f00`, revision January 1, 2025.
Read-only comparison against validated normalized shards checked every staged payload/hash, canonical text/block,
identity and parent membership: 6,803 records, zero mismatches. Raw artifact bytes were checked again.
Parser implementation SHA-256: `0e8e82bcd5342a1add202276615cf115193bb92e3e40064145d58ec7e4706eda`.
Evidence under `artifacts/regulatory-backfills/`: `annual-title5-reviewed-normalized/`,
`annual-title5-reviewed-import.json`, `annual-title5-reviewed-publication-accepted.json` and
`annual-title5-reviewed-canonical-audit.json`. Test log: `%TEMP%/rostra-annual-reviewed-tests.log`.

This establishes local canonical publication, not indexing, embeddings or delivery to production. Existing eCFR
editions and embeddings were not rebuilt because the shared parser implementation hash changed. Earlier normalized
generations remain evidence under their own parser hash; previously passed eCFR equivalence cannot automatically be
claimed for this new implementation hash.
