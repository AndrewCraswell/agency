# Shopify Blog Writer for SEO

## Product goal

Build a premium Shopify content workspace that turns a merchant's goals, catalog, existing content, research sources, and SEO opportunities into reviewable blog drafts, then continuously improves those articles with stronger internal links and product relevance.

The interface should expose an editorial workflow rather than resemble a generic AI chat wrapper.

## Product principles

1. Make the editorial workflow visible from opportunity through publication.
2. Keep merchants in control of evidence, links, and publishing decisions.
3. Present recommendations with reasons, not unexplained scores.
4. Separate fast drafting from durable research and verification.
5. Treat existing content and catalog data as strategic assets.
6. Target WCAG 2.2 AA for all merchant and storefront experiences.

## Feature inventory

| Capability | Features |
| --- | --- |
| Core authoring | Title and brief input, article generation, editing, preview, Shopify draft creation |
| Shopify integration | Embedded authentication, blog selection, articles, products, app-owned metafields |
| Cloud execution | Durable generation jobs, progress, retries, persistence, and model routing |
| Knowledge retrieval | Crawling, ingestion, embeddings, pgvector, hybrid retrieval, and source provenance |
| Research | Web search, page extraction, evidence ledger, citations, and factual verification |
| Agent workflow | Topic, title, outline, research, drafting, linking, and editorial review steps |
| Internal commerce links | Relevant product and article recommendations, verified URLs, and anchor text |
| SEO intelligence | Search Console, DataForSEO, keyword clusters, gaps, and opportunity scoring |
| Storefront components | Theme app extension for related products and further reading |
| Content maintenance | Scheduled scanning, stale-link checks, and retroactive link recommendations |
| Quality platform | LangSmith or Langfuse tracing, evaluations, datasets, cost, and latency monitoring |

## Milestone roadmap

### Milestone 0: Shopify feasibility spike

**Goal:** Prove the controlling integration path before building AI architecture.

Create one bounded Linear feasibility issue and assign an owning `FEN-###`. Do not create a duplicate GitHub issue.

Deliver the smallest reversible probe:

1. Scaffold an embedded React Router Shopify app.
2. Install it on a development store.
3. Authenticate an Admin GraphQL request.
4. List the store's blogs.
5. Create a hard-coded, unpublished article using `articleCreate`.
6. Record required scopes, API limitations, development-store behavior, and deployment requirements.

**Exit gate:** A static draft article appears in Shopify Admin and can be opened by the merchant.

Estimated effort: **1-2 days**.

### Milestone 1: Minimum AI writing prototype

**Goal:** Given a title and brief, produce editable content and create a Shopify draft.

#### Included

- Embedded Shopify application
- Polaris App Home interface
- Destination blog selector
- Title and article brief fields
- Request-bound LangChain generation
- Editable generated body
- Sanitized HTML preview
- Create draft in Shopify action
- Model errors and Shopify user errors
- Basic generation tracing
- No automatic publishing

#### Explicitly excluded

- Vector retrieval
- Internet research
- Specialized agents
- Keyword research
- Product recommendations
- Theme blocks
- Scheduling
- Automated citations
- Claims of factual verification

**Exit gate:** A merchant can install the app, generate an article, edit it, and create an unpublished Shopify article without leaving the embedded workflow.

Estimated effort after the spike: **3-5 days**.

### Milestone 2: Durable cloud generation and RAG

**Goal:** Move generation from a request-bound action into durable execution and ground it in stored knowledge.

Moving to the cloud means shifting from an HTTP request that must remain open to an asynchronous, persistent generation job.

#### Platform changes

- Dispatch generation into `apps/agentic`.
- Persist generation requests, stages, artifacts, costs, and results.
- Stream or poll job progress from the Shopify app.
- Add retry and cancellation behavior.
- Add PostgreSQL tenant isolation by shop installation.
- Enable pgvector.
- Store raw crawl artifacts in Azure Blob, which Agency already uses.

#### Ingestion

- Source registration and crawl schedules
- Sitemap and RSS discovery
- Canonical URL normalization
- Conditional requests using ETag and Last-Modified
- Normalized content and chunk hashes
- Deterministic chunking
- Embedding version tracking
- Idempotent upserts
- Removal or deactivation of stale content

#### Retrieval

- Vector similarity
- PostgreSQL full-text search
- Metadata filters
- Reranking
- Source excerpts and provenance

**Exit gate:** The same brief produces a draft grounded in retrieved source material, with every retrieved passage traceable to its original URL.

Estimated effort: **2-4 weeks**.

### Milestone 3: Quality, observability, agents, and research

**Goal:** Make quality measurable before increasing agent complexity.

#### LangSmith versus Langfuse

| Concern | LangSmith | Langfuse |
| --- | --- | --- |
| LangGraph integration | Best native integration | Supported, more manual |
| Tracing | Excellent agent and graph traces | Framework-neutral traces |
| Evaluations | Strong managed online and offline workflow | Strong datasets and configurable evaluations |
| Prompt management | Deep LangChain integration | Framework-independent |
| Self-hosting | Generally commercial or enterprise | Open-source and first-class |
| OpenTelemetry | Supported | Core architectural emphasis |
| Best use | LangChain and LangGraph product | Mixed frameworks or data sovereignty |

Use **LangSmith** initially because Agency already has:

- the `langsmith` SDK;
- environment and secret handling;
- a `traceOperation` wrapper;
- LangGraph;
- trace links in the web application.

Adding Langfuse now would duplicate instrumentation without improving the prototype. Preserve the existing tracing abstraction so Langfuse remains an option if self-hosting, data residency, or framework independence becomes a product requirement.

#### Agent graph

Implement agents as explicit LangGraph nodes, not independent autonomous processes:

1. Topic planner
2. Title strategist
3. Research planner
4. Source retriever
5. Evidence extractor
6. Outline writer
7. Section writer
8. Internal-link planner
9. Claim verifier
10. Editorial reviewer

#### Deep research

- Exa or Tavily for discovery
- Firecrawl for extraction
- Evidence ledger containing source, excerpt, publication date, and supported claims
- Citation coverage checks
- Rejection of unsupported factual claims

#### Evaluations

- Representative briefs and expected attributes
- Factual-support score
- Citation coverage
- Structure and intent adherence
- Product-link relevance
- Unsupported-claim rate
- Editorial acceptance rate
- Cost and latency per article

**Exit gate:** Prompt or model changes can be evaluated against a stable dataset before deployment.

Estimated effort: **2-4 weeks**.

### Milestone 4: Product and article link intelligence

**Goal:** Recommend commercially useful internal links without allowing the model to invent URLs.

#### Product synchronization

Store structured product fields separately from embeddings:

- Shopify product ID
- Title and handle
- Description
- Product type
- Tags and collections
- Publication state
- Availability
- Price
- Updated timestamp

Embed only descriptive, relatively stable content. Apply price, availability, tenant, and publication state as relational filters.

#### Article synchronization

- Article ID and blog ID
- Title and handle
- Summary
- Headings and cleaned body
- Tags
- Publication state
- Canonical URL
- Last update timestamp

#### Recommendation process

1. Retrieve candidates semantically.
2. Apply keyword and metadata filters.
3. Rerank against the intended section.
4. Explain why each candidate is relevant.
5. Suggest anchor text and insertion location.
6. Let the merchant approve links.
7. Verify handles and availability immediately before draft creation.

**Exit gate:** Generated content includes approved, valid internal links to relevant products and existing articles.

Estimated effort: **2-3 weeks**.

### Milestone 5: SEO opportunity engine

**Goal:** Choose what to write based on measurable search opportunity.

#### Integrations

- **Google Search Console:** actual queries, pages, clicks, impressions, CTR, and average position
- **DataForSEO:** competitor keywords, volume, difficulty, intent, SERPs, and keyword gaps

Use Nango's existing Agency integration pattern for Search Console OAuth. DataForSEO can initially use a platform-owned account with usage attributed by shop.

#### Workflow

1. Synchronize Search Console performance.
2. Discover competing domains.
3. Retrieve competitor-ranked keywords.
4. Find missing and underperforming keyword clusters.
5. Compare clusters against existing content.
6. Detect likely cannibalization.
7. Match opportunities to Shopify products.
8. Calculate an opportunity score.
9. Recommend creating, refreshing, or consolidating content.
10. Generate constrained title candidates.

#### Opportunity categories

- Striking-distance rankings
- High impressions with low CTR
- Competitor content gaps
- Long-tail clusters
- Emerging topical authority
- Commercial product opportunities
- Declining existing content

**Exit gate:** The app can explain why a topic is recommended and whether the correct action is a new article or an update.

Estimated effort: **3-5 weeks**.

### Milestone 6: Storefront related-content extension

**Goal:** Render product and reading recommendations through Shopify-native storefront data.

#### Data model

Define app-owned Shopify metafields declaratively in `shopify.app.toml`, then write values with the Admin API.

Plan for Article-owned fields such as:

- related products: `list.product_reference`
- related articles: `list.article_reference`

The article-reference type has been supported since Shopify API version 2025-10. Verify the exact TOML owner declarations during implementation.

#### Theme app extension

Provide merchant-installable blocks for article templates:

- Related products
- Further reading
- Optional combined recommendations section

The blocks should:

- read public storefront metafields;
- preserve theme typography and spacing;
- hide when no recommendations exist;
- expose only essential theme-editor settings;
- use semantic lists and headings;
- meet WCAG 2.2 AA.

Recommendations for an individual article belong on the article template. A blog-index recommendation surface should use separate blog-level configuration or an app-owned metaobject rather than treating a single article as the owner of the entire blog page.

**Exit gate:** A merchant can add the extension block through the theme editor without editing Liquid.

Estimated effort: **1-2 weeks**.

### Milestone 7: Content refresh scanner

**Goal:** Continuously improve existing content as the catalog and article graph change.

#### Scanner checks

- Newly relevant products
- Discontinued or unavailable linked products
- New articles worth linking
- Broken or redirected links
- Orphaned articles
- Topic cannibalization
- Stale factual claims
- Declining Search Console performance
- Missing related-content metafields
- Better anchor-text opportunities

#### Safety model

The scanner should create a proposed diff, not silently rewrite published content.

Each recommendation should include:

- affected article;
- proposed change;
- insertion or replacement location;
- reason;
- supporting product, article, or keyword data;
- expected SEO or merchandising benefit;
- confidence;
- approval state.

**Exit gate:** Merchants can review and apply a batch of evidence-backed content-refresh suggestions.

Estimated effort: **2-4 weeks**.

## Initial prototype implementation

### Repository placement

The app lives at:

```text
D:\agency
|-- apps
|   |-- agentic
|   |-- web
|   `-- blog-writer
`-- packages
```

Do not add Polaris to `apps/web`. That application is a Fluent UI control plane. Mixing Fluent and Polaris would create inconsistent UI conventions and bundle two design systems into one surface.

Scaffold `apps/blog-writer` with Shopify CLI's React Router app template. The new app should use current Polaris web components such as `s-page`, `s-section`, and `s-button`, not the legacy `@shopify/polaris` React package.

### Prototype request flow

```text
Embedded form
  -> authenticated server action
  -> Zod validation
  -> LangChain prompt
  -> model structured output
  -> Markdown-to-sanitized-HTML conversion
  -> editable preview
  -> explicit create-draft action
  -> Shopify articleCreate
  -> open draft in Shopify Admin
```

### Shopify scopes

Request only the content scopes needed to list blogs and manage articles:

- `read_content`
- `write_content`

The feasibility spike should confirm the final scope set against Shopify Admin API version `2026-04`.

### UI structure

#### Article brief section

- Destination blog
- Article title
- Writing brief
- Optional audience
- Optional tone
- Generate button

#### Draft section

- Generated summary
- Editable article body
- Tags
- Sanitized preview
- Regenerate action
- Create Shopify draft action

#### Feedback states

- Initial instructional empty state
- Generation skeleton
- Model timeout or refusal banner
- Shopify permission error
- Shopify GraphQL user error
- Draft-created confirmation with Admin navigation

Keep generation and Shopify creation as separate actions. Never publish automatically in the prototype.

### Server responsibilities

#### Loader

- Authenticate the embedded request.
- Query available blogs.
- Return only IDs, titles, and handles needed by the form.

#### Generate action

- Authenticate again server-side.
- Validate title and brief.
- Build the LangChain prompt.
- Invoke the configured model.
- Validate structured output.
- Convert generated Markdown through a sanitizing Unified pipeline.
- Return the editable draft and usage metadata.

#### Create action

- Authenticate again.
- Revalidate edited title, body, blog ID, tags, and summary.
- Call Shopify `articleCreate`.
- Force `isPublished: false`.
- Surface all Shopify user errors.
- Return the created article ID and Admin destination.

### Initial model contract

The model should return structured data:

```text
summary
bodyMarkdown
tags
```

The merchant-supplied title remains authoritative. The model should not silently replace it.

The system prompt should require:

- informative structure;
- semantic headings;
- no invented quotes or statistics;
- no unsupported product claims;
- no fake citations;
- no external links unless supplied;
- no script, style, iframe, or arbitrary embedded HTML.

### Dependencies

Keep the initial chain small:

- LangChain core
- One model-provider adapter
- Zod
- Unified Markdown-to-HTML pipeline
- `rehype-sanitize`

Agency requires discussion before introducing new libraries. Capture these dependencies in the owning Linear feasibility issue. Polaris and Shopify framework dependencies are justified by the embedded-app surface.

### Prototype tests

- Prompt contract produces valid structured output.
- Invalid or truncated model output is rejected.
- HTML sanitation strips unsafe content.
- Blog loader handles missing permissions.
- Article creation always requests an unpublished draft.
- Shopify user errors are shown to the merchant.
- Generate and create actions cannot be submitted accidentally twice.
- Keyboard-only completion works.
- Fields, status updates, and errors have accessible names and announcements.
- Desktop and narrow embedded-admin layouts remain usable.

### Prototype definition of done

- Runs from the Agency pnpm workspace.
- Installs on a Shopify development store.
- Uses Shopify-native embedded authentication.
- Lists the store's blogs.
- Generates a useful article from a title and brief.
- Allows review and editing.
- Creates an unpublished Shopify draft.
- Records model latency, usage, and failure state.
- Does not claim research grounding, SEO optimization, or factual verification.
- All durable work references the owning `FEN-###`.

## Delivery sequencing

Do not decompose the entire roadmap into implementation issues before the feasibility spike succeeds.

1. Create one feasibility issue.
2. Prove authenticated draft creation.
3. Record limitations and revise the architecture.
4. Create the minimum set of issues for Milestone 1.
5. Evaluate prototype usage before committing to RAG infrastructure.
6. Add later milestones only when the preceding exit gate is met.
