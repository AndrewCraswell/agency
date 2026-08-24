# Legislative intelligence MVP product specification

## Primary user

The primary user is a legislative researcher, policy analyst, journalist, or public-affairs professional who needs to
find and verify state and federal legislation across jurisdictions without learning each source system. They need
canonical records, official source links, and predictable retrieval through an MCP-capable agent.

## Research scenarios and success measures

1. Known-bill lookup: retrieve a bill by canonical ID or jurisdiction, session, and printed identifier. Success means
   one correct canonical record is returned within two seconds at the service boundary, with title, current status,
   sponsors when available, and at least one official source link.
2. Topical discovery: search for bills concerning a topic across selected jurisdictions and dates. Success means the
   documented evaluation set places a relevant bill in the first ten results for at least 90 percent of test prompts,
   with explicit pagination and no result outside the requested filters.
3. Timeline review: explain the ordered actions and votes for a known bill. Success means all stored events are returned
   in stable chronological and upstream order, ties are deterministic, and relevant official links remain available.
4. Passage search: find bill sections containing a phrase or semantic concept. Success means exact phrases are found by
   lexical search, semantic evaluation queries reach 80 percent recall at ten, and every match identifies its bill,
   document version, section, and source URL.
5. Version comparison: compare two official versions of a bill. Success means added, removed, and unchanged passages
   are distinguished, input versions are identified unambiguously, and truncated output reports that fact.

## Planned representative experience

After the current embedding program, the next product program adds address-to-representative discovery in the web
application, current and historical office service, official profiles, sponsorship, amendments, votes, committee and
event activity, and linked mentions in legislative text. Raw address input is not an MCP contract and is not retained by
default. The complete data, extraction, privacy, API, and rollout tasks live in the
[identity, entity, and representative roadmap](identity-and-representative-roadmap.md).

## Definition of done

The product is ready when the package verification suite passes, the [data synchronization catalog](data-sync-catalog.md)
accurately describes deployed capabilities, and required external services have been validated in the target environment.

## Adopted application and API program

The next approved product layer is a first-party web application and documented HTTP API over the canonical legislation
data. It includes retrieval and search for bills, amendments, votes and voter identities, documents and OCR sections,
supporting materials, people, organizations, commissions, meetings, and calendars; source-grounded research answers and
document diffs; representative lookup for the web application; and subscriptions with in-app, email, or webhook
delivery. The [HTTP API contract](http-api-contract/README.md) is the design boundary. It is not evidence that these
routes are implemented.

The MCP and HTTP API will share one application-service layer. Source-grounded answers are allowed only when every
nontrivial claim cites retrieved canonical evidence; free-form uncited summaries remain excluded.

## Explicit exclusions

- State real-time ingestion remains deferred until historical state coverage is reliable and a freshness requirement is
  approved.
- Committee media, recordings, transcripts, Mux, and Deepgram remain deferred until a research scenario requires media
  evidence.
- Uncited AI summaries and autonomous policy conclusions remain deferred. The approved research-answer contract is
  source-grounded and separately evaluated.
- Billing, paid plans, collaborative portfolios, and Novu remain deferred. The approved application program includes a
  web interface and narrowly scoped subscriptions, notifications, and webhooks implemented against the HTTP contract.
- Temporal, LangChain, LangGraph, Redis, OpenSearch, dedicated vector stores, and graph databases remain deferred until
  measured PostgreSQL or orchestration limits justify additional operational systems.

Any exclusion is reconsidered only through an architecture or product decision that names the new requirement,
evidence, cost, owner, and effect on the release contract.
