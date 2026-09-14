# Competitor regulatory data sourcing

Parent: [regulatory ingestion proposal](README.md). Public vendor disclosures reviewed September 14, 2026.

## What the evidence establishes

There is direct public evidence that competitors collect from the same government source families proposed for Tabra.
The strongest disclosures found are FiscalNote's description of direct collection and Quorum's named regulatory sources.
This supports the feasibility of a public-source foundation; it does not establish equivalent completeness, historical
depth, processing quality, staff effort or operating cost.

| Product | Public disclosure | What remains unverified |
| --- | --- | --- |
| FiscalNote / PolicyNote | Says its data comes directly from Congress.gov, the Federal Register, state legislative/regulatory sites and other official government sources. Describes recurring automated scans of new and changed website content. | Exact endpoint inventory, bulk versus API versus HTML split, complete jurisdiction/content matrix, supplementary licensed sources and independent freshness measurements |
| Quorum | Names state and federal registers, OIRA, OMB and the Unified Agenda as regulatory tracking sources. | Whether collection uses GovInfo, FederalRegister.gov, RegInfo downloads or particular APIs; direct versus licensed components; detailed completeness |
| LexisNexis State Net | Advertises collection from hundreds of legislative sources and thousands of regulatory agencies, plus expert analysis and non-rulemaking agency documents. | Complete source URLs, acquisition mechanisms, public/licensed mix and inclusion of every advertised content type in a particular API contract |
| FastDemocracy | Says its AI answers use primary materials including bill text, regulations and meeting transcripts, with source links. | Regulatory collection providers and methods; primary-source grounding is not proof of direct acquisition |
| Plural | Advertises legislative/regulatory coverage and source-linked analysis; separately offers open legislative data. | Specific regulatory suppliers, crawlers and code coverage; its open legislative offering does not establish an equivalent open regulatory corpus |
| BillTrack50 | Its Nimonik product page advertises legislative and regulatory tracking. | A specific upstream regulatory provider or acquisition method was not established in this review |

These are vendor statements, not independently audited operational findings. No reviewed disclosure establishes that
all these products buy a common regulatory feed or all use GovInfo as their acquisition service. Do not infer that
BillTrack50 uses LegiScan, or that Plural's regulatory corpus comes from Open States, without separate evidence.

## Sources

- [PolicyNote legislative and regulatory data](https://fiscalnote.com/legislative-data): explicit source and collection
  FAQ. Its scan-loop description should not be converted into a contractual one-hour event-to-record SLA.
- [Quorum regulatory tracking](https://www.quorum.us/solutions/regulatory-tracking/): explicit named regulatory source
  families. OIRA and OMB are institutional sources, not proof of a particular API endpoint.
- [State Net product description](https://www.lexisnexis.com/en-us/products/state-net.page): source breadth, expert
  screening and agency-material claims. Counts are marketing scope statements rather than a downloadable manifest.
- [FastDemocracy FAQ](https://fastdemocracy.com/): primary-source grounding and source-linked answers.
- [Plural product overview](https://pluralpolicy.com/): coverage and source-linked summaries;
  [regulatory lifecycle page](https://pluralpolicy.com/regulatory-lifecycle-management/): separately describes its open
  legislative data offering.
- [Nimonik's BillTrack50 page](https://nimonik.com/software/billtrack50-legislative-tracking/): regulatory tracking scope;
  not evidence of a specific upstream provider.

## Implications for Tabra

The evidence supports investing in collection reliability and normalization rather than assuming competitors have an
exclusive source of federal regulatory text. That is an inference about the published disclosures, not a claim that
they have no proprietary or licensed enrichment.

Federal public sources can underpin Tabra's published-rule and code corpus. Broader parity also requires state register
and agency acquisition, historical continuity, attached full text, corrections, source reconciliation and operational
review. Access to the same website is not equivalent to maintaining the same dataset.

Use comparative samples to test coverage: select official publications and code changes, then check discoverability,
full-text availability, versions, supporting documents and observation times. Record product tier and date, because
coverage can differ by subscription. A source citation proves traceability of that result; it does not reveal the
competitor's ingestion architecture or whether other source documents were missed.
