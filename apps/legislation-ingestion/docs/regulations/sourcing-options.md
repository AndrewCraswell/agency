# Regulatory sourcing options and tradeoffs

Recorded September 14, 2026. Sourcing/rights evaluation, not a signed vendor decision. Direct federal local acquisition,
storage and search foundations now exist; the [implementation contract](implementation.md) records their limits.

## Recommended evaluation direction

Evaluate **Vaquill for state statutory and administrative codes, with direct federal acquisition** first. Compare a
state-only quote against its broader federal/state license and an equivalent OpenLaws quote. This narrows purchased
collection to the hardest fragmented sources. It does not establish that state-only licensing is available or cheaper.

Keep existing legislative providers in every option. Codes describe existing law; they do not replace bills, versions,
votes, sponsors or actions. Current status below comes from the workspace assessment in
[synchronization catalog](../engineering/data-sync-catalog.md), not a production audit.

## Source allocation under the state-only option

| Data | Rostra status | Source to use | Vaquill equivalent? |
| --- | --- | --- | --- |
| Federal legislative activity | Existing implementation | Congress.gov + Senate.gov + GovInfo | Not established |
| State legislative activity | Existing work / rollout | Open States | Not established |
| U.S. Code and historical enacted law | Future | GovInfo; validate collection editions | Advertised |
| Federal published rules and regulatory code | Local implementation/pilots; production gates open | GovInfo + FederalRegister.gov; eCFR | Advertised; scope differs |
| Federal dockets/comments and rule planning | Optional future | Regulations.gov; RegInfo | Not established |
| State statutory codes | Future | Vaquill licensed feed | Advertised |
| State administrative codes | Future | Vaquill licensed feed | Advertised; gaps need validation |
| State proposals, adoptions and emergency rules | Future, unresolved | Determine by state/source | Not established |

Use FederalRegister.gov metadata alongside GovInfo publication text and eCFR title/version acquisition, following the
[shared federal collector baseline](federal-collector-baseline.md). GovInfo supports both initial import and ongoing published material. Regulations.gov and RegInfo add
different material; they are not prerequisites for keeping Federal Register documents current. See [sources](sources.md).

## Approaches we could take

| Approach | Main benefit | Main tradeoff | Best reason to choose it |
| --- | --- | --- | --- |
| License states; collect federal directly | Avoid fragmented state collectors | Two acquisition paths | Strong state coverage at a useful scoped price |
| License federal and state corpora | Fewer new collectors; common schema | Larger vendor dependency; possible scope gaps | Incremental license cost beats federal maintenance |
| Collect everything ourselves | Control sources, timing and formats | Highest maintenance and coverage burden | License terms or quality are unacceptable |
| License baseline; collect selected gaps | Broad starting corpus plus targeted freshness | More reconciliation and operational complexity | Vendor code coverage is good but rulemaking is incomplete |

The largest expected saving is avoided future collector work. Current bill, vote, member and committee collection,
text extraction and search remain necessary; no complete existing provider feed is proven replaceable.

Keep Rostra canonical identifiers independent of vendor IDs, retaining the latter as source aliases. Require bulk
manifests, corrections, stable-ID behavior and raw artifacts where permitted. Validate the optional federal license
against publication scope: Vaquill's advertised Federal Register notices are a curated subset.

The fourth approach can extend either licensed option. Define one preferred source per jurisdiction, corpus and period;
retain alternate provenance without duplicating results or silently overwriting a conflicting version. A government
notice and the resulting consolidated code section remain distinct linked records.

Self-collection can reuse [Vaquill's open project](https://github.com/Vaquill-AI/open-us-law), subject to its separate
code/data licenses. Public collectors and downloadable snapshots do not establish reproducibility of the entire paid
service. We would still own missing collectors, publisher changes, source access, parsing, backfill, monitoring and QA.
Treat this as a gradual option, not an instant fallback if a vendor disappears.

## Delivery and costs

Prefer a licensed bulk baseline plus recurring changes in Rostra's storage. This supports our own search, reproducible
citations and serving without a vendor call for every question. A hosted API can make a small lookup pilot cheaper,
but introduces runtime availability and contract restrictions. API access does not imply permission to mirror a corpus.

Compare annual total cost: license + setup/backfill + collector maintenance + import/normalization + storage/indexing +
coverage QA. Request the same scope for state-only and full-corpus quotes, including renewal price, minimum term,
update frequency and export rights. Bundled federal content may cost little extra; using it may still omit material we
need. Do not equate fewer suppliers with no acquisition work, or state-only with guaranteed savings.

Keep Rostra's flat, feature-based customer pricing. Measure acquisition and serving consumption internally; vendor
charges do not automatically become customer usage limits.

## What must be resolved

1. **Coverage:** dated jurisdiction/corpus manifest with omissions, complete text, tables, attachments and source URLs.
   Assess all 50 states and DC; evaluate territories explicitly. A jurisdiction label alone is insufficient.
2. **Freshness:** publisher currency, last successful collection and delivery timestamps separately. Monthly code
   collection does not support timely rulemaking alerts. Obtain proposed/adopted/emergency samples and deadline fields.
3. **History:** distinguish amendment notes, snapshots and true point-in-time text. Confirm correction, deletion and
   effective-date behavior; preserve the exact version used for a customer answer.
4. **Rights:** obtain terms for local indexing, AI answers, displayed text, Word/PDF reports, customer sharing and
   Rostra API/MCP delivery. Confirm attribution and the right to retain and serve acquired records after termination.
5. **Continuity:** full export, stable IDs, removal notices and transition assistance. A local copy provides technical
   resilience only while our license permits its continued use.

Use the same small sample across vendors: a large state, a PDF-heavy state, a disclosed partial state, and a recently
changed provision. Compare against official publications and replay a change feed. Score code coverage and regulatory
developments separately. Do not advertise nationwide regulatory monitoring from a code-only license.

## Decision after evaluation

Choose state-only if its coverage/rights pass and the combined license plus federal operations is favorable. Choose a
broader license if its incremental price saves more work without losing required material. Add direct collectors only
for validated gaps or worthwhile freshness gains. No existing legislative feed is currently proven replaceable.

See [supplier shortlist](supplier-shortlist.md) for alternatives and [implementation](implementation.md) for persistence
and release requirements shared by all approaches.
