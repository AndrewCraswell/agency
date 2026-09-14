# Legislative intelligence MVP product specification

## Primary user

The primary user is a legislative researcher, policy analyst, journalist, or public-affairs professional who needs to
find and verify state and federal legislation across jurisdictions without learning each source system. They need
canonical records, official source links, and predictable retrieval through the conversational web application or an
MCP-capable agent.

## Conversational product experience

The [designer brief](design.md) is the self-contained handoff for preliminary app designs.

The home page is a chat-first research workspace. Users describe what they want to find, understand, compare, or
follow. Responses combine cited explanations with interactive results, bill progress, activity, and subscription
controls. The conversation is the main interface to the product. Structured views remain directly accessible through
stable links, search, updates, and following management.

Bills, representatives, and committees are first-class research and following targets in the core product scope.
Their profiles and activity must be designed together with the conversation, even when implementation is delivered
in successive slices. This supersedes treating representative and committee profiles as optional later browsing pages.

The design brief defines features, actions, states, and designer acceptance.
The [information architecture](information-architecture.md) defines navigation, proposed browser routes, content
relationships, and connected flows. These documents specify intended behavior; they do not certify API or data readiness.
The [notification experience](notification-experience.md) includes Novu delivery and preference requirements.
Its [prototype scenarios](design.md#13-prototype-scenarios-and-representative-content) incorporate the simulated persona review.

### Core capabilities

- Discover legislation, representatives, and committees through conversation and structured search.
- Inspect source-linked bill, representative, and committee activity, including bills, amendments, votes, memberships,
  meetings, and available materials. Separate an entity's own actions from updates to associated legislation.
- Visualize a bill's recorded progress using a jurisdiction- and measure-specific path, with supporting actions,
  uncertain stages, alternative outcomes, and a distinction between enactment and effective dates.
- Read and compare identified document versions, open exact supporting passages, and retain research context.
- Follow records and searches through configurable event categories, channels, and delivery frequency; review updates
  and manage subscriptions through direct controls as well as the conversation.
- Resume private research conversations, inspect and edit their context, and recover from interrupted requests.
- Maintain personal issue trackers across conversations, with explicit scope, included records, saved-query follows,
  exclusions, and source-linked updates. Separate user relevance judgments from official legislative facts.
- Deliver in-app and email notifications through Novu, with one consistent inbox state, effective preferences,
  transparent suppression and failure states, and durable application-owned matching and delivery records.
- Configure external AI access to this product under Settings, Integrations, MCP. The web assistant requires no user
  MCP setup and uses the same authorized application services as the HTTP API.

Conversation persistence, structured assistant responses, action execution, bill-stage mapping, and expanded activity
subscriptions require explicit implementation contracts. Existing research-answer and subscription endpoints alone
do not establish support for the complete experience.

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

## Representative data and lookup program

Core representative profiles require current and historical office service, official profiles, sponsorship,
amendments, votes, committee and event activity. Address-to-representative discovery and linked mentions in legislative
text remain separately gated by the data roadmap. Raw address input is not an MCP contract and is not retained by
default. The complete data, extraction, privacy, API, and rollout tasks live in the
[identity, entity, and representative roadmap](../engineering/identity-and-representative-roadmap.md).

## Definition of done

The product is ready when the package verification suite passes, the [data synchronization catalog](../engineering/data-sync-catalog.md)
accurately describes deployed capabilities, and required external services have been validated in the target environment.
Implemented web workflows must also pass the browser acceptance scenarios in the design brief at desktop
and mobile sizes, including keyboard operation, evidence inspection, and incomplete-data states.

## Adopted application and API program

The next approved product layer is a first-party web application and documented HTTP API over the canonical legislation
data. It includes retrieval and search for bills, amendments, votes and voter identities, documents and OCR sections,
supporting materials, people, organizations, commissions and meetings; source-grounded research answers and
document diffs; and subscriptions with in-app, email, or webhook
delivery. The [HTTP API contract](../engineering/api/README.md) is the design boundary. It is not evidence that these
routes are implemented.

The MCP and HTTP API will share one application-service layer. Source-grounded answers are allowed only when every
nontrivial claim cites retrieved canonical evidence; free-form uncited summaries remain excluded.

## Explicit exclusions

- General web research, connecting the web assistant to arbitrary external MCP servers, and public conversation
  sharing remain outside the initial experience. External AI clients connecting to this product's MCP server are included.
- State recurring ingestion follows the staged [Open States rollout](../operations/openstates-rollout-checklist.md). Nationwide
  activation and freshness claims require its per-jurisdiction acceptance; pilot extraction alone is insufficient.
- Committee media, recordings, transcripts, Mux, and Deepgram remain deferred until a research scenario requires media
  evidence.
- Uncited AI summaries and autonomous policy conclusions remain deferred. The approved research-answer contract is
  source-grounded and separately evaluated.
- Billing, paid plans, and collaborative portfolios remain deferred for implementation; billing/address mockups may
  be explored under the [design handoff](design.md#design-handoff). Novu is included in notification design scope;
  implementation and deployment remain subject to the notification integration gates. The application program includes a
  web interface and narrowly scoped subscriptions, notifications, and webhooks implemented against the HTTP contract.
- Temporal, LangChain, LangGraph, Redis, OpenSearch, dedicated vector stores, and graph databases remain deferred until
  measured PostgreSQL or orchestration limits justify additional operational systems.

Any exclusion is reconsidered only through an architecture or product decision that names the new requirement,
evidence, cost, owner, and effect on the release contract.
