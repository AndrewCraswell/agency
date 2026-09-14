# Legal data supplier shortlist

Public documentation reviewed September 14, 2026. These are vendor claims and evaluation leads, not tested deliveries,
negotiated prices or confirmed Tabra licensing rights. OpenLaws is the closest broad alternative found; the other two
are narrower or earlier evaluation leads. Their corporate maturity and financial durability were not independently audited.

| Supplier | Potential role | Key limitation | Priority |
| --- | --- | --- | --- |
| Vaquill | Broad federal/state law and regulatory corpus | State rulemaking coverage and contract unverified | Existing preferred candidate |
| OpenLaws | Comparable state statute/admin-code supplier | Monthly/quarterly state updates; bulk price | Compare directly |
| RegCorpus | State insurance regulatory supplement | Insurance only; partial jurisdiction/text coverage | If insurance is a target |
| Cleo LegalData | Global regulatory API; selected US sources | Many US sources blocked or planned | Watchlist |

## Vaquill

The [open dataset](https://www.vaquill.ai/open-us-law) permits commercial use with CC BY 4.0 attribution;
[collector code](https://github.com/Vaquill-AI/open-us-law) is Apache-2.0. A paid subscription is not required simply
to build a commercial product from that snapshot. The open snapshot, public collectors and paid feed have different scope.

The source audit at `2f7aeb85a434a54a351ac44e3c188fec318f78ba` found statute entry points for 40 states plus DC/PR
and regulatory collectors for 14 states. This is code presence, not successful coverage validation. Missing statute
entry points: AR, CO, GA, MS, NC, NM, NV, OR, TN, WY. Regulatory collectors: CO, ID, IL, KS, KY, MD, ME, MN, NM, OH,
SC, VA, WA, WI. The paid API advertises all 52 state/territory jurisdictions; obtain a dated coverage export to verify it.

The [commercial page](https://www.vaquill.ai/) advertises database synchronization, source files and custom licensing.
Confirm exact history semantics, supported uses, fees, attribution, export and retention rights. Older notes asserting
no as-of support are superseded by newer marketing for reconstructed historical state text; that claim is untested.
See [federal reuse](federal-collector-baseline.md) for code limitations and [sourcing options](sourcing-options.md) for
commercial evaluation criteria. No paid API or delivery contract was tested in this audit.

## OpenLaws

[OpenLaws](https://openlaws.us/about/) identifies itself as a Public Benefit Corporation incorporated in 2022 supplying
legal data to LegalTech and AI companies. It advertises statutes, regulations, constitutions and court rules across
federal, 50 states, DC and Puerto Rico, with API and bulk delivery. This makes it a direct sourcing candidate for Tabra.

Its [coverage sheet](https://openlaws.notion.site/) is more informative than the nationwide headline: state collections
are monthly or quarterly, Colorado regulations are listed at 78%, Maine and Mississippi have limited coverage, California
Title 24 is excluded and Puerto Rico regulations are out of scope. Tables/images and effective-date fields are marked
experimental. These are examples, not a complete gap inventory. Code collection does not prove proposed-rule monitoring.

[Published pricing](https://openlaws.us/pricing/) lists API access at $2,500/month, enterprise API at $5,000/month, and
bulk delivery at $15,000/month plus implementation. A qualifying startup API program is $6,000 for 12 months; it is not
the bulk plan. Bulk includes S3 exports and local retrieval/embedding uses; enterprise bulk adds white-label options.
Request state-only pricing and the right delivery plan before treating a discounted API as a local ingestion solution.

The [public agreement](https://openlaws.us/terms/) makes the order form determine the license and contains restrictions
on extraction and some AI uses. Reconcile it with current bulk/AI marketing in explicit Tabra terms, including customer
display, exports, API/MCP redistribution and post-termination retention. Marketing alone does not establish those rights.

## RegCorpus

[RegCorpus access](https://regcorpus.com/access) describes a versioned US state insurance-regulation collection with
REST, bulk and MCP access, daily change delivery and an advertised AI-ingestion license. Its page lists 32 of 51
jurisdictions and $12,000–$18,000 annually. Some restricted sources provide facts and links instead of full text.
The public samples and coverage endpoints offer a concrete next evaluation step.

Investigate if insurance becomes a customer segment. It is not a replacement for general state statutes or nationwide,
cross-industry regulatory coverage. Confirm which event types and full-text rights exist in the target states.

## Cleo LegalData

[Cleo's documentation](https://legaldata-public.cleolabs.co/docs) advertises a global legal-data API with full-text
retrieval, changes, webhooks and MCP tooling. Its [coverage inventory](https://legaldata-public.cleolabs.co/coverage)
lists selected US sources as complete, including Virginia law and Texas administrative code, but many others as blocked
or planned. California administrative code is planned; OpenLaws is listed as blocked. Some entries are mirrors or
aggregators, so source inventory size is not a count of directly collected official publishers.

Keep this as an exploratory global/selected-source lead, not a demonstrated 50-state substitute. Establish actual
delivered text, bulk licensing, source rights, operating history and successful updates before spending integration effort.

## Recommended comparison

Compare Vaquill and OpenLaws first using the same coverage manifest, samples, state-only/full-corpus quotes and license
requirements in [sourcing options](sourcing-options.md). Neither reviewed offering yet establishes the timely state
rulemaking feed Tabra would need to match regulatory-monitoring products. Evaluate that gap independently of code search.
