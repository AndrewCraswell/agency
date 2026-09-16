# Regulatory source catalog

Parent: [regulatory ingestion proposal](README.md). Public documentation reviewed September 14, 2026.
Provider facts below are documentation-derived, not live throughput or completeness measurements.

The [shared federal collector baseline](federal-collector-baseline.md) records the updated implementation choice:
GovInfo publication text plus FederalRegister.gov metadata, and eCFR title/version acquisition.

## Federal source roles and overlap

| Source | Primary content | Overlap | Acquisition recommendation |
| --- | --- | --- | --- |
| GovInfo | Published Federal Register, annual CFR, current eCFR bulk XML | FederalRegister.gov and eCFR publish related renditions and metadata | Initial bulk acquisition and official publication retention; discover ongoing additions/corrections |
| FederalRegister.gov | Individual published rules, proposed rules, notices and structured discovery | Federal Register material acquired through GovInfo | Selected metadata/discovery adapter paired with GovInfo text; preserve shared publication identity |
| eCFR | Consolidated regulatory text and point-in-time facilities | Current eCFR bulk files and historical CFR editions on GovInfo, with different temporal granularity | Selected current title/version acquisition path; validate historical range per title |
| Regulations.gov | Dockets, documents, supporting materials, comments and attachments | Some published rule documents also appear in the Federal Register | Later enrichment; independently account for attachments and public availability |
| RegInfo | Unified Agenda plans, regulatory review and other information collections | RINs and references link to published regulatory actions | Agenda XML import first; do not assume it exports every review record |

FederalRegister.gov explicitly distinguishes its informational XML rendition from the official Federal Register edition
on GovInfo. Store rendition and official-source provenance separately. Similarly, preserve eCFR currency and legal-status
information rather than equating a retrieved XML snapshot with a certified historical legal edition.

References: [GovInfo developer hub](https://www.govinfo.gov/developers),
[Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1),
[eCFR API](https://www.ecfr.gov/developers/documentation/api/v1),
[Regulations.gov API](https://open.gsa.gov/api/regulationsgov/),
[RegInfo overview](https://www.gsa.gov/policy-regulations/policy/federal-regulation-policy/regulatory-information-reginfogov).

## GovInfo: initial corpus and ongoing acquisition

The developer hub lists these bulk XML ranges:

| Collection | Documented bulk availability | Important boundary |
| --- | --- | --- |
| Federal Register | 2000 to present | This is the bulk XML range, not a claim that older publications are unavailable in other formats |
| Annual CFR | 1996 to present | Edition history is not every intervening daily version; titles have edition-specific revision dates |
| eCFR | Current XML file for each title | Current files alone do not provide all past snapshots |

The bulk repository is a collection of discoverable files, not a promised single download containing everything.
Enumerate its manifests and save a chosen scope before acquisition. GovInfo supports XML/JSON bulk-directory listings;
use documented listings and source-provided URLs instead of guessing paths or treating a directory response as content.

GovInfo's API can list publications added or modified in a time interval. Its collection service supports pagination,
with a documented maximum page size of 1,000 and a returned next-page cursor. Modification time describes a GovInfo
package change; it is not the legal effective date or necessarily the original publication date.

GovInfo also exposes sitemaps and feeds. The developer hub notes that update notifications can be suspended during large
reprocessing operations. Use feeds as discovery aids and reconcile source inventories; a quiet feed cannot establish
that nothing changed. Validate the discovery mechanism for current eCFR bulk files separately from Federal Register
package discovery. Do not assume every bulk collection is updated through the same API route.

Preserve source XML and relevant official PDF renditions. XML is preferable for structured extraction; PDF supports
inspection and citations to the published artifact. Verify which files are available in each package before declaring
its text complete.

Sources: [bulk collections and feeds](https://www.govinfo.gov/developers),
[API contract and change discovery](https://github.com/usgpo/api/blob/main/README.md),
[format and coverage notes](https://www.govinfo.gov/help/whats-available).

## Rate limits and import feasibility

These are planning inputs to revalidate at implementation. Actual response headers and service responses control
runtime pacing. No load test or account-specific quota inspection has been performed for this proposal.

| Access path | Verified published information | Implementation consequence |
| --- | --- | --- |
| GovInfo API | 36,000 requests/hour, 1,200/minute, 40/second in the current official README; API key required | Respect all windows, share the budget across workers, and leave capacity for recurring updates |
| GovInfo bulk files | Bulk downloading is explicitly supported; no numeric bulk-host throughput allowance verified here | Do not apply API quotas as a download guarantee; use bounded concurrency and resumable acquisition |
| FederalRegister.gov API | No API key required; no numeric rate allowance verified here | Keyless does not mean unlimited; conservative pacing, caching and retry handling |
| eCFR API | Public documented endpoints; no numeric rate allowance verified here | Validate endpoint behavior and throttle conservatively; avoid repeated full-title downloads |
| Regulations.gov GET API | Documentation points to api.data.gov's default 1,000 requests/hour; service-specific limits may differ; GET increases considered on request | Read limit/remaining headers; queue backfills and budget detail requests separately |
| RegInfo agenda XML files | Downloadable editions are published; no numeric throughput allowance verified here | Import edition files with bounded downloads; verify completeness against each edition listing |

GovInfo's explicit service limits differ from the generic api.data.gov default. Do not substitute the generic default
for the GovInfo contract. Do not use DEMO_KEY for production: api.data.gov documents much smaller demo limits.
Regulations.gov's POST/comment-submission limits are not the ingestion limits; Rostra does not need POST access to read.

Rate limits constrain speed, not simply record count. One listing call may return multiple records, while a single
record may need a detail request and several attachment downloads. Estimate work as:

```text
API calls = listing pages + required detail calls + API-mediated attachment calls + retries/reconciliation
minimum API time = API calls / available request budget
```

This lower bound excludes network transfer, parsing, storage, provider outages and other rate windows. Measure a bounded
sample before estimating a complete import. A bulk XML file can contain many provisions and avoid thousands of section
requests. Store originals once so parser improvements can replay locally without consuming provider capacity again.

Sources: [GovInfo limits](https://github.com/usgpo/api/blob/main/README.md),
[api.data.gov limits and headers](https://api.data.gov/docs/developer-manual/),
[Regulations.gov limit-increase policy](https://open.gsa.gov/api/regulationsgov/).

## Regulations.gov: deeper docket research

The documented GET API separates document search/details, docket search/details and comment search/details. Not all
fields returned by detail endpoints are present in search results. For example, the documentation directs callers to
docket details for the docket RIN. Document types include proposed rule, rule, supporting/related and other.

Do not promise a bulk import of all Regulations.gov content from the current documentation. It describes pagination
restrictions and an approach to large comment sets using lastModifiedDate, explicitly described there as beta pending a
permanent bulk solution. Recheck that contract before implementing pagination. A truncated search is not a complete
docket. Public availability is also limited by agency publication and processing; unavailable comments are not empty
comments and should not be inferred or reconstructed.

Recommended sequence:

1. Acquire docket metadata for covered rulemakings.
2. Acquire agency supporting documents and their available attachments.
3. Add selected comment collections only when required by a product workflow.
4. Evaluate nationwide comment backfill separately, with measured counts, storage, processing cost and acquisition time.

Attachments need their own URL, hash, retrieval status and extraction status. A complete JSON metadata response does not
mean the attached impact assessment or proposed text has been stored. Preserve publisher corrections, withdrawal flags
and unavailable artifacts without rewriting earlier observations.

Reference: [Regulations.gov API and FAQ](https://open.gsa.gov/api/regulationsgov/).

## RegInfo: planned activity

The Unified Agenda XML download page lists available current and historical editions, including editions beginning in
1995. Import the actual listed edition identifiers; do not assume every year has exactly two released editions or invent
missing URLs. An agenda entry describes a planned or ongoing action, often with projected dates; it is not itself a
published final rule.

Keep each edition as a distinct snapshot and use the RIN as a cross-reference where provided. A projected timetable is
not a guaranteed publication schedule. Agenda snapshots are not a live feed of every review-status transition. Review
records, information collections and draft documents have different availability boundaries and require separate
discovery before we claim they are covered.

Sources: [XML editions](https://www.reginfo.gov/public/do/eAgendaXmlReport),
[historical agenda](https://www.reginfo.gov/public/do/eAgendaHistory),
[agenda fields and identifiers](https://mobile.reginfo.gov/public/jsp/eAgenda/UA_HowTo.myjsp).

## State acquisition and commercial feeds

No completed nationwide feasibility audit is implied. Maintain one inventory row per jurisdiction, source and content
class, rather than one boolean that says a state is supported.

| Required inventory field | What must be established |
| --- | --- |
| Source owner and URL | Official publisher, agency or licensed provider; stable discovery entry point |
| Content class | Consolidated code, register, proposal text, adoption, emergency action, guidance or supporting document |
| Acquisition method | Bulk files, API, feed, HTML, PDF, or documented manual exception |
| Text completeness | Full text, amendment instructions, summary only, external attachment or unavailable |
| History | Earliest discoverable material, edition/version granularity and missing periods |
| Identity | Citation structure, register/document identifier, agency IDs, docket IDs and renumbering behavior |
| Updates | Publication cadence, correction behavior, change-discovery method and reconciliation inventory |
| Time semantics | Publication, filing, adoption, effective dates and source currency, with unknowns explicit |
| Reuse and operation | Access terms, rights to store/index/serve, limits and maintenance owner |
| Evidence | Sample files, inventory counts, extraction results, last verified date and known gaps |

Examples verified during planning:

- [Virginia's XML service](https://law.lis.virginia.gov/xmlapi/) exposes code titles, agencies, chapters and section
  details. Its register still needs separate acquisition assessment.
- [California OAL](https://oal.ca.gov/) exposes notice, review and agency-material entry points. Do not assume the notice
  alone contains the complete proposed text or every revised agency attachment.
- [Pennsylvania Code and Bulletin](https://www.pacodeandbulletin.gov/) provide different code and rulemaking collections;
  track their respective currency and acquisition conditions independently.
- [New York administrative rules](https://dos.ny.gov/node/1126) identifies the register and code publishing functions;
  API/bulk availability and historical completeness still require testing.

Evaluate direct sources and licensed feeds against identical sample publications. State Net advertises normalized
regulatory data and links to text versions through its API, but the reviewed page also distinguishes a forthcoming
Content API. It does not establish a license for Rostra to replicate, embed, redistribute or serve every full text.
See [State Net API description](https://www.lexisnexis.com/en-us/products/lexis-api.page).

Before selecting any feed, obtain sample payloads and establish full-text versus link-only access, agency and state
coverage, history, corrections, update latency, stable IDs, bulk export, termination/export rights, and commercial
rights for storage, search, AI processing, citations, reports, API/MCP delivery and customer access. Confirm whether
existing administrative code is included separately from rulemaking tracking. Record costs and restrictions explicitly.
Do not infer resale rights from a vendor's API marketing page or internal-dashboard integration example.
