# Public chat launch backlog

Prepared September 15, 2026. Status: **In progress**. Implementation evidence is recorded with the owning tasks; no production acceptance is implied.

## Summary

Ship Rostra's first usable, publicly reachable conversation experience in the existing Legislation Next.js application
and deploy it through the existing Railway `legislation-web` service. This is a working placeholder for the larger
product, not a redesign of an already delivered UX and not a static marketing demonstration.

A visitor can ask a question, clarify its meaning, watch actual research activity, read a streamed answer containing
interactive legislative records, inspect citations, and continue the conversation. Research can use any implemented,
authorized data capability exposed by the application's API or MCP, supplemented by web search and source reading.
It is not limited to a curated federal dataset or a fixed number of questions.

The selected foundation is **AI SDK, AI Elements, shadcn/ui, Rostra's custom theme, and OpenRouter with Luna initially**.
Reuse the existing Legislation research registry directly in the development demo; integrate Tavily Search and Firecrawl Scrape later. Build the conversation-specific contracts,
clarification interaction, data-capability adapter, evidence binding, and domain components. Do not build a search
engine, scraper, MCP framework, or replacement ingestion pipeline.

### Current implementation priority

Design-fidelity audit after user review: the entity-card work is **not accepted**. Shell dimensions and successful
fixture pagination are not sufficient to match the designs. Correct the following before expanding this work:

| Surface | Actual design | Remaining mismatch or gate |
| --- | --- | --- |
| Clarification receipt | `vfPCe` | Browser retry succeeded without page errors: right-aligned author-row state, 8px question gap, 16px question text, and one complete accepted answer verified. Desktop/320px screenshots inspected; no narrow-screen overflow. Explicit timestamp activation shows the abbreviated-timezone tooltip. Message timestamp-footer override retained. |
| Entity cards | `H18fQ0`, `tc8bk`, `swjsp`, `OK9wn`, `keeKC`, `CFj83`, `mIUTX` | Generic label/value body is not the designed per-entity composition. Missing status marks, body hierarchy, vote dividers, contextual metadata, and applicable action rows must not be called complete. |
| Record destinations | Card title interaction contracts | External source URLs do not implement canonical record navigation or the shared meeting/vote drawers. Do not treat those substitutions as design-equivalent. Saved-work mutations remain outside approved demo scope. |
| Pagination | `HKOkJ`, `eg8Tw`, `h28wD` | Fixture page isolation/recovery works; record destinations and expiry recovery remain incomplete. The live search/page canary failed before producing a result set, so live pagination is unverified. |

No completion credit is given for these components until actual data, applicable interactions and visual states
match their referenced designs or an explicit user-approved exception is recorded.

Updated September 15, 2026 by user direction. This order takes precedence over phase numbering below; task IDs remain
stable for tracking.

1. Finish and verify working conversations: the updated composer, real streaming, follow-ups, stop, retry and safe errors.
2. Connect the existing authorized Legislation API/MCP capabilities, including clarification, actual tool activity,
   embedded records and inspectable citations. Verify this research journey end to end using our own data.
3. Integrate Tavily Search and Firecrawl Scrape last, then verify their additional web-research journeys.

OpenRouter configuration is required for model conversations. Tavily and Firecrawl accounts, keys and acceptance are
not prerequisites for conversation or internal-research development and verification. Apply DEC-05 and DEC-08 to the
provider/fixture subset needed for the current step; complete external-provider decisions when WEB tasks begin.
External tools remain planned scope, not removed scope. Production release still requires the acceptance and access
gates for every enabled capability; this priority change does not authorize deployment or waive those gates.

The [product backlog](backlog.md) remains the parent roadmap for accounts, full record pages, issues, briefs, following,
notifications, and organization features. This document owns the first public chat release and its development-to-
production sequence. Its explicit scope takes precedence over older demo assumptions for this release only.

## Confirmed scope

| Area | Decision |
| --- | --- |
| Entry | The working conversation experience is the homepage; no separate marketing page is required. |
| Access | No compulsory signup or waitlist enrollment to converse. Public access does not bypass data authorization. |
| Development research | Approved: invoke the existing read-only query services in-process using the shared MCP tool definitions, without an internal bearer token. Public API/MCP authentication and gated legal-text restrictions remain unchanged. |
| Conversation length | No three-question allowance, per-visitor lifetime question cap, or conversion gate. Context and execution limits protect individual runs, not a sales funnel. |
| Waitlist | Entirely deferred: no form, capture endpoint, database table, email integration, or early-access prompts. |
| Data | All implemented, authorized API/MCP research capabilities, across available jurisdictions and periods. No hard-coded federal-only restriction. |
| Design | Area 12 is the implementation baseline, not loose inspiration. Preserve its layout, hierarchy, suggestion questions/descriptions, and component treatment unless an approved scope change or strong reason requires a deviation. Record examples, quotations, counts, and timestamps are not live data. |
| UI foundation | AI Elements and shadcn/ui must inherit Rostra's custom tokens and typography, not their stock appearance. |
| Model | AI SDK with OpenRouter; Luna is the initial candidate, with an exact supported model ID verified and pinned during implementation. |
| External research | Tavily Search and Firecrawl Scrape, integrated through hosted MCP last, after working conversations and our own API/MCP research. No visitor provider setup. |
| Clarification | First-class inline interaction supporting choices, free text, validated selection, and continued research. |
| Deployment | Existing Next.js application and Railway service; do not create a second canonical app or recreate the deleted `legislation-api` service. |

## Decisions to close before implementation depends on them

These are proposals, not silently approved additions. Record the selected answer in the owning task. Do not block
independent theme or fixture work while a decision is open.

| Decision | Recommended starting point | Owner/task |
| --- | --- | --- |
| Conversation retention and refresh | Production remains memory-only and refresh expires the conversation. User-approved development exception: tab-scoped sessionStorage restores the current transcript, draft, evidence and confirmed answers through full reloads; active requests are interrupted, not resumed. No server-saved transcript or history-management UI. | Product/Backend, DEC-03 |
| Public research permissions | Approved: public-eligible read-only data, excluding organization-gated legal text and private account data. Trusted principal configuration and per-operation eligibility remain implementation gates. | Product/Security, DEC-02 |
| Runtime beyond a disconnect | Persist run status and rendered parts; interrupt non-durable work on process loss and allow an explicit retry. Do not promise that work survives container restarts unless a durable executor is deliberately selected. | Backend/Platform, DEC-04 |
| Provider accounts and spend | App-owned Tavily, Firecrawl, and OpenRouter credentials with approved budgets. Define operational throttles and a global emergency stop, not a question allowance. | Product/Platform, DEC-05 |
| Model settings and service targets | Evaluate the pinned Luna model with low and medium reasoning; choose quality, latency, context, and per-run limits from measured fixtures. | Backend/Product, DEC-06 |
| Theme modes | Approved: light and dark, defaulting to the system preference. The header offers Light, Dark, and System. Explicit overrides persist as `light` or `dark` under localStorage key `rostra.theme`; System removes that key. | Design/Product, DEC-07 |
| Privacy and deletion | Explain model/search processing, conversation retention, telemetry, and deletion behavior accurately. Provider training exclusion is not automatically zero retention. | Product/Security, DEC-03 and DEC-05 |

## Baseline and reuse boundaries

This is a planning snapshot, not a live production inventory. Concurrent ingestion and regulatory work is ongoing;
reconcile the source and target environment in DEC-01 instead of treating historical tool counts as an immutable contract.

| Existing surface | Reuse | Missing work or caution |
| --- | --- | --- |
| [Homepage](../../app/page.tsx) | Existing Next.js route and runtime | Replace the foundation content with the working conversation. |
| [App package](../../package.json) | React, Next.js, Zod, Drizzle, PostgreSQL and observability dependencies | Verify compatible AI SDK, AI Elements, shadcn and provider versions before installation. |
| [MCP registry](../../src/mcp/tools.ts) | Registered inputs, read-tool behavior, structured results and response bounds | Connect and validate; do not implement a second legislative query layer. |
| [API-backed MCP runtime](../../src/server/next/mcp-runtime.ts) | Existing authenticated transport and API adapter | API/MCP audiences remain separate; a public chat session is not an API bearer credential. |
| [Research answers](../../src/api/research-answers.ts) | Evidence identity and claim/citation validation patterns | Single-answer generation is not a complete conversational agent or UI stream. Avoid nested model generation when tools can return evidence directly. |
| [Tool contract](../engineering/tool-contracts.md) | Existing research operations and documented limitations | The legal-text pilot is gated and locally implemented; local availability is not public production acceptance. |
| [API acceptance](../operations/passage-search-delivery.md) | Current source-backed fixture evidence and search gates | Broad passage-search acceptance and ingestion completeness are distinct from working endpoints. |
| [Runtime guide](../operations/development.md) | Docker, Railway, explicit schema operations, health and telemetry | Do not reset ingestion data, alter embeddings, or recreate old deployment boundaries for this work. |

### Integrate versus build

| Capability | Concrete choice | Work classification |
| --- | --- | --- |
| Model and streaming runtime | `ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider` | Integrate; implement app contracts, execution policy and lifecycle. |
| Hosted MCP connections | `@ai-sdk/mcp` | Integrate; implement credential custody, connection cleanup, schema checks and safe errors. |
| Legislative tools | Shared `createLegislationResearchTools` registry and Next.js query service; existing API services for missing read capabilities | Reuse validated tools directly for the development demo. Public `/mcp` retains its authenticated transport. |
| Web search | [Tavily hosted MCP](https://docs.tavily.com/documentation/mcp), `tavily-search` | Integrate. Connect to `https://mcp.tavily.com/mcp/` with server-side header authentication. |
| Webpage and public PDF reading | [Firecrawl hosted MCP](https://docs.firecrawl.dev/mcp-server/tools), `firecrawl_scrape` | Integrate. Connect to `https://mcp.firecrawl.dev/v2/mcp` with server-side bearer authentication. |
| Uploaded document parsing | Firecrawl `firecrawl_parse` | Deferred with uploads; no local-file upload-command execution in the public agent. |
| Conversation presentation | [AI Elements](https://elements.ai-sdk.dev/) plus shadcn/ui | Reuse selected components; adapt them to Rostra's tokens and accessibility requirements. |
| Clarification | `ask_clarification` using AI SDK interactive tool results | Build the schema, inline component, server validation and continuation. Tool approval is a different interaction. |
| Data capabilities | `get_data_capabilities` over existing metadata and registered operations | Build a small app-specific projection; do not infer corpus completeness from row counts. |
| Legislative components | Typed records and citation snapshots from tool results | Build domain presentation, not model-generated executable UI. |
| Arithmetic and date helpers | Existing suitable dependencies or a separately approved library | Optional after core release; validated operations only, never `eval` or shell execution. |

Verify each provider's actual discovered schema at integration time. Documentation and registry examples can target
different AI SDK releases; do not paste version-incompatible examples or install floating versions into the release.
Do not add Exa, Tavily Extract, an autonomous external research agent, or a duplicate search provider without a measured
gap and a separate decision. Retain one visible research loop so tool progress and citations remain inspectable.

## Execution rules

- Every task below starts **Planned**. Use Planned, Ready, In progress, Blocked, and Done; phase completion is separate
  from task completion. Named owners are assigned when work starts; role names below are suggested accountability.
- Dependencies identify required inputs, not a requirement to finish an entire phase before starting any later work.
  Where a phase gate is required, all tasks in that phase must meet their acceptance criteria.
- A task is Done only with implementation or decision evidence, related tests where executable behavior changes, and
  affected documentation. An installed dependency, mock screenshot, HTTP 200, or empty result is not sufficient.
- Finish coherent implementation units before running focused checks. Repair related failures together, then run the
  required repository gates. Do not write executable validators or test suites for this narrative backlog.
- Verify changed UX in the integrated browser at desktop/mobile sizes with keyboard, accessible names, focus, error,
  empty and partial states. Use Fluent Agent guidance for new copy when available; record when unavailable.
- Reuse existing test infrastructure and co-locate behavior tests. Do not introduce a new framework or shared package
  without demonstrated need. Apply React Compiler and repository hook/type-helper guidance to generated components.
- Do not stage, commit, push, deploy, purchase services, send email, or change live configuration merely because a task
  appears here. Obtain the authorization required for the actual operation. Never disturb unrelated concurrent work.

Progress entry for an active task: **ID; state; named owner; decision/implementation summary; evidence link; blocker;
next action**. Keep entries with the owning phase. Do not copy this task list into a second competing tracker.

## Phases and gates

| Phase | Tasks | Exit gate |
| --- | --- | --- |
| 1. Scope and contracts | DEC-01 through DEC-08 | Access, retention, execution, provider and design decisions are explicit; acceptance fixtures selected. |
| 2. Theme and shell | THEME-01 through THEME-08 | Real homepage and shared primitives use Rostra's theme at desktop/mobile sizes. |
| 3. Conversation runtime | CONV-01 through CONV-09 | Multi-turn streamed conversation with authoritative state, stop/retry and context management. |
| 4. Legislative tools | TOOL-01 through TOOL-08 | Reviewed API/MCP research capabilities are callable with typed, authorized, bounded results. |
| 5. Clarification | CLAR-01 through CLAR-09 | Ambiguity becomes a working inline question, validated answer, and resumed research. |
| 6. Web research (last integration priority) | WEB-01 through WEB-07 | Begin after conversation and internal API/MCP research journeys pass; Tavily search and Firecrawl source reading then contribute attributable evidence to the same conversation. |
| 7. Embedded content | RENDER-01 through RENDER-10 | Domain records and citations render as interactive components, not raw JSON or invented records. |
| 8. Reliability and privacy | SAFE-01 through SAFE-08 | Public execution, long conversations, provider failures and data handling meet agreed controls. |
| 9. Acceptance | QA-01 through QA-08 | Functional, adversarial, accessible, performance and ingestion-overlap checks meet recorded targets. |
| 10. Production release | RELEASE-01 through RELEASE-07 | Approved artifact is successful on Railway and passes deployed workflow/API/MCP checks. |
| 11. Pilot operations | PILOT-01 through PILOT-05 | Initial production observation, recovery ownership and handoff are complete. |

## Phase 1: Scope and contracts

### DEC-01: Reconcile the executable baseline

Owner: Backend/Data. Depends on: none.

- Work: inspect current API handlers, typed client, MCP discovery, source-readiness records, package versions and Railway
  configuration. Build an operation matrix with implementation, authorization, target deployment and fixture evidence.
- Accept: each research capability is classified available, gated, unavailable or unverified. Sample designs and old
  smoke records are never treated as current evidence. Concurrent regulatory work is linked rather than rewritten.

### DEC-02: Define the public research boundary

Owner: Product/Security. Depends on: DEC-01.

- Work: approve the read-only capability set and public data eligibility, including gated legal text and source-rights
  restrictions. Specify the trusted principal used by server-side research and how future authenticated access differs.
- Accept: anonymous chat cannot inherit arbitrary organization privileges or reach private subscription/webhook data.
  API and MCP audience checks stay intact. Missing authorization cannot be remedied by changing a prompt or tool argument.

### DEC-03: Choose conversation ownership, retention and deletion

Owner: Product/Backend. Depends on: DEC-02.

- Work: resolve current-visit versus refresh/browser-restart persistence, retention duration, new-conversation behavior,
  optional history scope and deletion. Specify browser credential loss, shared-device risk and expired-conversation behavior.
- Accept: the selected policy explicitly covers transcripts, tool results, citations, reasoning metadata, request receipts,
  logs and backups. No account or waitlist is introduced. Nothing claims that data is unsaved while the server retains it.

### DEC-04: Specify conversation and run lifecycle

Owner: Backend/Platform. Depends on: DEC-03.

- Work: define conversation, message, turn, run, tool-call and event identities; ordering; idempotency; active-run ownership;
  stream interruption; cancellation; retry; and waiting-for-clarification. Decide whether any execution must be durable.
- Accept: transitions distinguish waiting, running, completed, stopped, interrupted and failed. Refresh recovery is not
  confused with continued computation. No HTTP request remains open solely to wait for human input.

### DEC-05: Approve providers and data handling

Owner: Product/Platform. Depends on: DEC-02 and DEC-03.

- Work: assign app-owned OpenRouter, Tavily and Firecrawl accounts, secret owners, rotation procedures, spending alerts,
  usage ceilings and approved processing/retention settings. Review which prompt fragments and URLs leave the app.
- Accept: credentials are supplied through secret storage, never chat or browser bundles. Numeric spend decisions and
  handling of provider exhaustion are recorded. No provider purchase or restrictive plan is implied by this backlog.

### DEC-06: Set model and performance acceptance targets

Owner: Backend/Product. Depends on: DEC-01 and DEC-05.

- Work: verify the exact Luna model route and SDK compatibility; compare supported reasoning settings on legislative
  lookup, multi-tool comparison and clarification tasks. Set measured latency, quality, context and per-run budget targets.
- Accept: record the chosen model identifier, settings and thresholds before QA acceptance. No floating latest alias,
  silent model fallback, or change to ingestion embedding/reranking models. Limits do not impose a conversation count.

### DEC-07: Reconcile Area 12 with the agreed experience

Owner: Design/Product. Depends on: DEC-03.

- Work: retain the visual language of landing `skMgg`, conversation `LU4wH`, mobile `vOFsZ` and the shared components.
  Specify clarification and domain-result states missing from those examples; agree theme-mode behavior.
- Accept: remove waitlist, quota, account, saved-issue and following assumptions from the implementation brief. Replace
  stale federal/state scope notes with actual capability behavior. Do not change the Pencil file without a design task.

### DEC-08: Select acceptance journeys and source fixtures

Owner: QA/Data. Depends on: DEC-01 and DEC-02.

- Work: choose real federal and state examples covering bill identity, two versions, votes, people, committees, meetings,
  amendments and materials; add web-only evidence, ambiguity, absent data and provider failure cases.
- Accept: fixtures name their source and expected relationship, not a prescribed model sentence. Missing target data is
  an explicit dependency, not fabricated seed content. Record which legal-text cases require an authorized principal.

Phase exit: decisions and fixture expectations are reviewable; no launch requirement relies on unsupported access or
an implicit retention policy. Theme work can proceed while provider setup is resolved.

## Phase 2: Theme and shell

### THEME-01: Install compatible foundation dependencies

Owner: Frontend/Backend. Depends on: DEC-06 and DEC-07.

Status: **In progress; GitHub Copilot**. The SDK package blocker is resolved using the user-approved
[downloaded archive](../../vendor/README.md). Vercel `ai@7.0.94` was rebuilt from 640 checksum-verified published files;
all other packages use the configured Microsoft feed. Registry and TLS settings remain unchanged.

- [x] Install AI core 7.0.94, React bindings 4.0.97, MCP client 2.0.46, and OpenRouter provider 3.0.0.
- [x] Resolve transitive core references to the same archive in local and Railway workspace configurations.
- [x] Complete root frozen-lockfile installation and verify the core/React/MCP/OpenRouter runtime imports.
- [x] Pass the web type-check with the installed SDK dependencies.
- [x] Pass the scoped web regression run: `vitest run app/components app/lib`, 5 files and 59 tests passed after SDK installation.
- [ ] Verify the complete Next.js production build with the remaining selected AI Elements components.

Next action: integrate the installed runtime and remaining components. The downloaded package does not itself complete
the streaming conversation or production-release gates.

- Work: select compatible pinned AI SDK, React bindings, MCP client, OpenRouter provider, shadcn/Tailwind and AI Elements
  releases. Inspect registry-generated imports and transitive dependencies against repository conventions.
- Accept: frozen pnpm installation and the Next.js build resolve the selected packages. Install only needed components;
  do not import a complete chatbot starter, replace shared tooling, or add LangChain alongside the selected runtime.

### THEME-02: Map Rostra tokens and fonts

Owner: Frontend/Design. Depends on: THEME-01.

Progress: **In progress; GitHub Copilot**. Rostra tokens and fonts, the
[theme provider](../../app/components/theme/ThemeProvider.tsx), pre-hydration initialization, and the header's
three-state theme control are implemented. Theme overrides survive reload; System clears the override and follows OS
changes. Focused initialization tests and integrated-browser persistence, keyboard and 320px header checks pass.
Full theme/shell acceptance and the model runtime remain open. The package-feed blocker was subsequently resolved by
the approved archive installation recorded in THEME-01.

Verification note: the theme's 15 focused tests, web type-check, scoped lint, reload/system/keyboard browser checks,
and 320px header layout pass. The root verification attempt stopped during the check stage before coverage. This is not
a clean repository verification result.

- Work: map background, foreground, surfaces, borders, primary/secondary actions, focus and semantic statuses to shadcn
  tokens. Baseline: surface `#F2F4F3`, ink `#0F1413`, brand `#14463A`, raised white, radii 4/6/8px.
- Accept: Public Sans controls, Fraunces headings, Newsreader passages and IBM Plex Mono metadata use appropriately loaded
  fonts. Font fallbacks, contrast, 100%/200% text sizing and approved modes work without stock violet or unrelated palettes.

### THEME-03: Adapt the selected AI Elements primitives

Owner: Frontend. Depends on: THEME-02.

Status: **In progress; GitHub Copilot**. Conversation and Suggestion are integrated with Rostra styling. Message,
prompt-input, tool-activity and source components remain open.

- Work: integrate conversation, message, prompt input, suggestion, tool activity and source primitives; add shadcn
  sheet, dialog, field, radio, checkbox and tooltip primitives where needed. Review generated code for local conventions.
- Accept: loading, focus, hover, selected, disabled and error states use semantic tokens. Custom components remain
  app-local. No unexplained UI cards nested inside other cards or unused attachment/voice controls appear.

### THEME-04: Replace the foundation homepage

Owner: Frontend. Depends on: THEME-03 and DEC-07.

Status: **In progress; GitHub Copilot**. The homepage now follows Area 12's layout and suggestion treatment; selection
fills the draft and restores composer focus. The SDK is now installed; live submission and transcript transition still
require conversation-runtime implementation.

- Work: build the compact Rostra header, first-question composer and meaningful starter questions. Transition into the
  transcript in the same experience; starter selection fills the draft and explicit submission starts research.
- Accept: first screen is usable at laptop and mobile sizes, with the composer visible. No early-access links, arbitrary
  capability claims, fake live metrics, dead navigation or design fixture records are shipped.

### THEME-05: Build transcript and evidence layout

Owner: Frontend. Depends on: THEME-03.

Message presentation now follows Pencil components `y03lVL` (Question turn) and `VUo8t` (Answer turn), checked
against demo instances `LU4wH` and `vOFsZ`. User turns have right-aligned 12px labels and muted 18px-radius bubbles
with 16x20px desktop / 12x20px mobile padding. Rostra turns remain unframed, with a 15px mark, 12px label,
16px body at 1.6 line height, and an icon-only Copy button with tooltip, restored by user direction. Desktop turns use the reference's 720px maximum width;
homepage and composer sizing remain unchanged. Browser screenshots cover desktop and mobile light/dark rendering,
multiline/long unbroken user text, and keyboard Copy. Broader panel and viewport acceptance remains in progress.

- Work: implement a readable transcript, composer region, optional desktop evidence panel and narrow-screen sheet.
  Specify breakpoints for usable reading widths instead of shrinking multiple columns indefinitely.
- Accept: opening/closing evidence preserves draft, scroll and focus. Mobile viewport and keyboard changes do not hide
  send/stop controls. Header, panel and transcript do not overflow at 320, 390, 768, 1280 and 1440px widths.

### THEME-06: Establish form and content conventions

Owner: Frontend/Design. Depends on: THEME-03.

- Work: define field labels, inline errors, tooltip names, status announcements, source-link treatment and reduced-motion
  behavior. Apply Fluent content and AI interaction guidance to changed customer-facing strings without mixing UI systems.
- Accept: no dot-glyph separators, routine freshness footers or unnecessary instructions. Source publication/version dates
  and meaningful limitations remain visible. Composer focus is retained while duplicate submission is prevented.

### THEME-07: Verify the foundation in the browser

Owner: QA/Frontend. Depends on: THEME-04 through THEME-06.

- Work: exercise draft entry, suggestion selection, overflow, evidence open/close and keyboard focus with representative
  short/long content. Inspect actual rendered fonts, tokens and approved theme modes in the integrated browser.
- Accept: retain desktop/mobile evidence and resolve layout/accessibility defects. Mock states establish component
  acceptance only; do not label the conversation operational before Phase 3 and tool integration pass.

### THEME-08: Persist theme overrides and add the header menu

Owner: GitHub Copilot. Depends on: the token/provider foundation in THEME-02.

Status: **Done**. Added at the user's request during implementation; this completes the theme-control feature, not
the whole theme/shell phase or production release.

- Work: provide one header icon button opening Light, Dark and System radio-menu choices. Reuse the theme provider;
  persist explicit overrides in `rostra.theme`, remove the key for System, and initialize before hydration.
- Accept: reload preserves an override; System resumes OS changes; no pre-hydration click is lost. Menu selection,
  keyboard opening, Escape/focus return and 320px placement work with accessible names and visible selection.
- Evidence: [menu](../../app/components/theme/ThemeToggle.tsx), [provider](../../app/components/theme/ThemeProvider.tsx)
  and [15 theme tests](../../app/lib/theme.test.ts). Focused types/lint and integrated-browser checks passed. At 320px,
  the menu's bounds were x=106, width=193.65625, right=299.65625. Root verification remains blocked as noted in THEME-02.
- Blocker: none for this task. Next action: reuse the provider/menu as the conversation interface expands.

Phase exit: a coherent Rostra shell and reusable themed components exist without carrying over the obsolete demo limits.

## Phase 3: Conversation runtime

### CONV-01: Define typed messages, tools and rendered parts

Owner: Backend/Frontend. Depends on: DEC-04 and THEME-01.

- Work: define validated contracts for text, tool activity, record references, citations, clarification, error and final
  state. Separate UI history, model context and authoritative tool evidence; retain ordering and model/settings provenance.
- Accept: unknown or malformed parts fail safely without executing HTML/JSX. Client-submitted assistant/tool content
  cannot become trusted evidence. Stable identifiers allow deduplication and rendering without text parsing heuristics.

### CONV-02: Implement anonymous session ownership

Owner: Backend/Security. Depends on: DEC-02 through DEC-04.

- Work: implement opaque browser-associated sessions with secure, HttpOnly, appropriately scoped cookies; origin/CSRF
  checks; server-derived ownership; and expiry. Define local-development cookie behavior separately from production HTTPS.
- Accept: one visitor cannot list, read, mutate, continue or cancel another visitor's conversation. Sequential IDs or
  guessed URLs grant no access. Cross-origin requests and caller-supplied organization identity are rejected.

### CONV-03: Implement the selected conversation store

Owner: Backend. Depends on: CONV-01 and CONV-02.

Status: **In progress**. Development-only tab checkpoints now preserve conversations and drafts across full reloads.
Browser acceptance covers completed-turn reload, in-flight interruption, keyboard Retry, and mobile layout. Pending
clarifications expire after reload; confirmed answers remain retained. Production ownership/storage acceptance is not
implied. See [reload recovery](../operations/development.md#conversation-reload-recovery).

- Work: implement approved storage for turns, rendered parts, citation snapshots, tool-call receipts, pending questions
  and run state. Add concurrency constraints and retention indexes; keep canonical ingestion tables independent.
- Accept: new conversation, reload and expiry follow DEC-03. Apply current prototype schema conventions without resetting
  live ingestion. No unapproved history UI or indefinite transcript/reasoning retention is introduced.

### CONV-04: Integrate the OpenRouter model loop

Owner: Backend. Depends on: CONV-01, DEC-05 and DEC-06.

- Work: configure the approved Luna route, provider privacy settings, system instructions and multi-step execution.
  Separate model reasoning metadata from display content and preserve provider-required context during tool continuation.
- Accept: a server-only credential produces a real streamed reply. Supported settings are verified against the selected
  model, raw provider failures are redacted, and the chat route does not change existing embedding generation.

### CONV-05: Connect the UI stream to the browser

Owner: Backend/Frontend. Depends on: CONV-03, CONV-04 and THEME-04.

Status: **In progress; GitHub Copilot**. Shared tab-memory chat survives client navigation from the homepage to
`/conversations/{id}`. The composer glow is homepage-only. Controlled browser streaming verified one initial send,
navigation, a follow-up, and MCP tool-activity rendering. The 390px conversation view has no horizontal overflow and
retains 44px send controls. This is browser transport evidence, not live model/MCP or interruption acceptance.

- [x] Basic live conversation milestone: the user confirmed "It's working!" after the transaction-pooling and
  optional-tool-input fixes. This adds user-observed UI confirmation to the live search/detail evidence in TOOL-02.
- [x] Add the `u00z9P` Jump to latest interaction using the existing scroll-follow library. It appears only away
  from the bottom, preserves the draft, moves keyboard focus to the latest visible message and respects reduced
  motion. Browser checks cover a long transcript, unchanged history position after content growth, smooth completion,
  390px layout with a 44px target, and instant reduced-motion navigation. Corrected against the complete component:
  22px radius, 1px input border, no shadow, 13px icon, 12px semibold label, 8px gaps and 16px horizontal padding.
  The live new-message count tracks visible message IDs added while away, not tokens or hidden clarification
  submissions, and resets upon returning to latest. The populated `2 new` state is screenshot/geometry verified.
- [ ] Complete interruption, truncated-stream and remaining structured-content acceptance before closing CONV-05.

- Work: connect AI SDK transport and `useChat` to the app-owned route; emit ordered text/tool/data parts and authoritative
  completion/failure. Persist according to the agreed lifecycle rather than relying solely on a final callback.
- Accept: first question and follow-up stream into the same transcript with stable IDs. Partial chunks and multibyte
  text assemble correctly; a truncated network stream cannot masquerade as a completed answer.

### CONV-06: Coordinate submissions and concurrent tabs

Owner: Backend/Frontend. Depends on: CONV-03 and CONV-05.

- Work: issue request identities, atomically acquire active-run ownership and deduplicate repeated sends. Choose explicit
  handling for new messages during a running answer or pending clarification; preserve the unsent draft.
- Accept: double clicks, retries and two tabs cannot launch conflicting runs or overwrite newer state. Duplicate
  submission has no duplicate model/tool charge where application deduplication can prevent it; uncertain provider outcomes remain explicit.

### CONV-07: Implement stop, interruption and retry

Owner: Backend/Frontend. Depends on: CONV-06.

- Work: propagate cancellation to supported model/tool transports; record terminal state before late events can mutate
  the transcript. Distinguish reconnecting to an existing run from deliberately retrying an interrupted/failed answer.
- Accept: retained text is labeled partial when appropriate. Process loss, tab closure and provider timeout behave as
  DEC-04 specifies. Stopping cannot promise reversal of already billed work; retry never blindly duplicates a live run.

### CONV-08: Manage long conversation context

Owner: Backend. Depends on: CONV-01, CONV-04 and CONV-05.

- Work: budget model context separately from retained UI history, compact older exchanges when necessary, retain explicit
  user choices and evidence IDs, and re-fetch exact source material when a follow-up needs omitted detail.
- Accept: conversations continue past the former three-question example and beyond a single context window. Summaries
  never become evidence or erase scope decisions. Oversized individual prompts produce recoverable errors, not a signup gate.

### CONV-09: Prove the basic runtime journey

Owner: QA/Backend. Depends on: CONV-05 through CONV-08.

- Work: test ordered streaming, duplicate sends, model rejection, slow response, cancellation, process interruption,
  refresh, expiry and long-context follow-ups with deterministic transport fixtures and an approved live model canary.
- Accept: server records and browser state agree for every terminal outcome. The live canary establishes provider
  connectivity, not legislative grounding; source/tool acceptance follows in later phases.

Phase exit: a real multi-turn conversation works end to end with explicit state and no artificial turn allowance.

## Phase 4: Legislative tools

### TOOL-01: Build the reviewed research-tool catalog

Owner: Backend/Security. Depends on: DEC-01, DEC-02 and CONV-01.

- Work: map every implemented research API/MCP operation to a tool name, input/output contract, access rule, source of
  truth and display type. Include batch and continuation operations; identify API-only gaps and gated legal-text access.
- Accept: no research capability is omitted just because it is absent from the designs. Private/admin/write operations
  are deliberately excluded. Tool count alone is not a coverage metric; the operation matrix explains any remaining gaps.

### TOOL-02: Connect the shared legislative research tools

Owner: Backend/Platform. Depends on: TOOL-01 and CONV-04.

Status: **In progress; GitHub Copilot**. The database blocker is resolved. The user approved direct in-process service calls for the
demo. The [chat adapter](../../app/chat/research.ts) now invokes the same validated
[tool registry](../../src/mcp/tools.ts) as MCP, with the existing Next.js query service. No chat MCP URL/token is required.
The former internal HTTP path was replaced, not retained as a fallback. Public authentication handlers are unchanged.

- [x] Extract shared definitions/callbacks without duplicating tool schemas or query logic.
- [x] Wire direct read tools into the development-only model loop and remove obsolete MCP token settings.
- [x] Verify direct/MCP registry parity: 25 tools; gated legal text absent; invalid bill ID rejected before querying.
- [x] Retain tool time/count/output limits, cursor data, shared pool ownership and post-cancellation result rejection.
- [x] Pass web/service type-checks and scoped lint; no unit suites started.
- [x] Run demo queries in read-only transactions with transaction-local timeout settings compatible with PgBouncer.
- [x] Verify live server timeout/read-only settings, cancellation of a slow statement, rollback and healthy pool reuse.
- [x] Verify populated search/detail through the real chat endpoint for the AI-in-education question.
- [x] Replace ambiguous optional model inputs with nullable fields, preserving canonical validation and rejecting invented cursors.
- [ ] Complete broader batch, cancellation and error handling acceptance against the real data service.

Evidence: [bounded read helper](../../src/db/database.ts), [research runtime](../../src/server/next/research-runtime.ts)
and [model adapter](../../app/chat/research.ts). Live search and detail returned sponsors for New Jersey A4352 and
Massachusetts H614. Two larger detail calls failed before narrower retrieval succeeded, so full batch acceptance is
not complete. No pooler configuration or ingestion data was changed. API-only capability adapters remain TOOL-03 work.

- Work: execute shared read services directly for the demo, with the same validation and public-eligible scope as the
  approved tools. Preserve existing public API/MCP auth and restricted legal-text checks.
- Accept: populated search and detail work without demo login or internal MCP credentials; no private/account/write
  operations are exposed, and public auth is not disabled. Production public-access approval remains a separate gate.

### TOOL-03: Add missing API-backed research adapters

Owner: Backend. Depends on: TOOL-01.

- Work: expose audited read operations not covered by MCP through the existing typed API client. Reuse schemas and safe
  error mapping; use task-oriented names rather than offering a generic arbitrary-URL or arbitrary-method API caller.
- Accept: HTTP and tool results have the same records, filters, pagination and authorization. No duplicated SQL, domain
  query logic, invented endpoint or second implementation of an existing MCP operation is added.

### TOOL-04: Normalize tool outputs and failures

Owner: Backend. Depends on: TOOL-02 and TOOL-03.

Status: **In progress; GitHub Copilot**. The connector rejects `isError` and malformed structured envelopes and avoids
returning raw transport/provider error details to the model. Per-record DTO validation, detailed error categories,
batch presentation and typed evidence projection remain open.

- Work: validate structured MCP content and API envelopes; distinguish transport errors, `isError`, batch-item failures,
  not-found, authorization, unavailable data and truncation. Keep raw evidence and safe UI projection separately bounded.
- Accept: HTTP 200 with an MCP error is not success. One failed batch item does not discard healthy results. Display
  metadata and source IDs come from validated data; errors contain correlation IDs without provider secrets.

### TOOL-05: Implement pagination and result budgeting

Owner: Backend. Depends on: TOOL-04.

- Work: preserve opaque cursors, query/scope binding, result-size bounds and batch limits. Bound model-visible text while
  retaining explicit continuation; prevent repeated identical calls and nonterminating pagination from exhausting a run.
- Accept: a partial list cannot be presented as an exhaustive count. Complete-vote-history claims require all relevant
  pages. Large document sections remain inspectable through bounded reads instead of being silently cut off.

### TOOL-06: Build data-capability discovery

Owner: Backend/Data. Depends on: TOOL-01 and TOOL-04.

- Work: implement `get_data_capabilities` using registered operations, supported filters and trustworthy source/readiness
  metadata. Separate implementation readiness, permission, ingested scope and temporary dependency health.
- Accept: unknown coverage stays unknown; an empty table or failed query cannot imply no legislation. No database URLs,
  queue internals, private organization identifiers or fabricated nationwide-completeness claims reach the model or UI.

### TOOL-07: Define research routing and trace behavior

Owner: Backend/Product. Depends on: TOOL-04 through TOOL-06 and CONV-05.

Status: **In progress; GitHub Copilot**. Plain-language [tool activity](../../app/components/chat/ResearchActivity.tsx)
renders pending, running, complete, failed and interrupted states from streamed dynamic tool parts. The disclosure
and step rows are backed by Pencil `h4Q7t`, `k5uXC` and `gVk10`: left chevron, 44px trigger, 14px semibold heading,
right-aligned count, 16px state icons, 13px row labels, indented 12px query details and recorded returned-page counts.
Failures use the separate expanded disclosure from `nxR08`, so a collapsed activity list cannot hide an error.
Light-mode state colors match the design tokens; dark mode maps to the existing contrast-aware palette.

Browser acceptance covers exact header dimensions/type/color, real-data conditional metadata, 320px wrapping,
light/dark screenshots, keyboard disclosure operation, reduced-motion spinner, and retaining the reader's open
state through running-to-complete. No per-tool retry is offered until a bounded read-retry contract exists; no
elapsed time or resolved scope is invented when execution metadata is absent. The richer working indicator
(`L54Ay`), per-tool retries, and additional metadata remain incomplete. Follow-ups preserve clarification text but
do not trust client tool evidence. Capability discovery and broader research routing acceptance remain open.

- Work: guide canonical ID resolution, exact-version reading, batched lookups and conditional web research. Stream actual
  tool start/result/failure events and meaningful safe labels; keep internal reasoning and raw credentials out of traces.
- Accept: the agent can perform several dependent lookups, ask a follow-up and acknowledge unsupported operations.
  Proposed work is not displayed as completed work; tool descriptions never substitute for server authorization.

### TOOL-08: Verify API/MCP capability parity

Owner: QA/Backend. Depends on: TOOL-02 through TOOL-07 and DEC-08.

- Work: exercise the operation matrix using populated, missing, forbidden, paginated and oversized fixtures. Include
  document-backed amendments, normalized vote positions and authorized/unauthorized legal-text pilot cases when enabled.
- Accept: each enabled capability has a passing tool path and evidence reference. Missing implementations remain named
  dependencies of their own workstream; this release does not silently claim regulatory coverage by adding a card renderer.

Phase exit: all eligible implemented research capabilities are reachable without duplicating the backend or loosening access.

## Phase 5: Clarification

### CLAR-01: Define the clarification contract

Owner: Backend/Frontend. Depends on: CONV-01 and DEC-04.

Status: **In progress; GitHub Copilot**. Independently testable question/response schemas are implemented;
binding them to the AI SDK message/run lifecycle remains dependent on CONV-01 and DEC-04.

- [x] Define bounded single-choice, multiple-choice and free-text inputs, with unique option IDs and valid selection bounds.
- [x] Bind responses to the expected question ID/revision and reject inactive or superseded questions.
- [x] Validate allowed choices, cardinality, text bounds, explicit skipping and unknown fields; responses cannot supply an approval flag or substitute a record ID.
- [x] Pass [19 focused contract tests](../../app/lib/clarification.test.ts), scoped lint and the web type-check.
- [ ] Bind pending requests and accepted responses to the authoritative conversation/run lifecycle.
- [ ] Ground record-option labels and IDs in retrieved evidence (CLAR-02), and enforce research-only question intent when registering the tool.

Implementation: [clarification contracts](../../app/lib/clarification.ts). These schema checks do not establish model
continuation. The independently verified question UI is recorded in CLAR-04. Next action: complete lifecycle binding
once the AI SDK dependency is available.

- Work: specify `ask_clarification` with question, input kind, stable option IDs, descriptions, optional record references,
  free-text allowance, selection bounds and skip policy. Define answered, skipped, superseded and expired outcomes.
- Accept: single choice, multiple choice and free text validate independently. A model cannot request credentials or
  use a clarification answer as approval for a mutation. Keep the interaction distinct from AI Elements tool confirmation.

### CLAR-02: Ground record choices in retrieved candidates

Owner: Backend. Depends on: CLAR-01 and TOOL-04.

- Work: bind candidate options to actual records retrieved in this conversation, with identifiers, titles, jurisdiction,
  session/version and distinguishing context. Resolve display values on the server rather than trusting model-written names.
- Accept: fabricated, unauthorized or mismatched record options are rejected or trigger a new lookup. Pure research-
  preference choices need no canonical ID, but cannot be misrepresented as real records or source evidence.

### CLAR-03: Implement pause and pending-question state

Owner: Backend. Depends on: CLAR-01 and CONV-06.

- Work: register an interactive tool and record the outstanding request against its run/tool-call ID. Finish the stream
  in a waiting-for-user state and prevent dependent tool execution until a valid answer arrives.
- Accept: only one active clarification interaction needs attention at a time. The run holds no open HTTP request or
  database transaction while waiting. Pending state follows approved refresh, retention and expiry behavior.

### CLAR-04: Build the themed inline question component

Owner: GitHub Copilot. Depends on: the question schema in CLAR-01 and shared primitives in THEME-03.

Status: **Done** for the reusable component and development preview, not live model integration.

- [x] Render single-choice, multiple-choice and free-text forms with optional text and explicit permitted skipping.
- [x] Use the shared Zod response validation, server-issued question identity/revision, and React Hook Form; no silent preselection or submit-on-select.
- [x] Preserve input on an unconfirmed submission, permit explicit retry, and prevent duplicate in-flight submissions in the component.
- [x] Reset input for a new question revision; expired/superseded questions expose no controls.
- [x] Render an accepted-answer summary and move keyboard focus to its heading.
- [x] Pass 30 focused contract/component tests, web type-check and scoped lint. Browser checks cover keyboard selection,
  selection cardinality, explicit submit, free-text failure/retry, skipping, inactive states and summary focus.
- [x] Inspect the rendered component and verify no horizontal overflow or clipped labels at 1440, 390 and 320px in
  both theme palettes. The 390px and 320px form widths are 350px and 280px respectively.

Evidence: [component](../../app/components/chat/ClarificationQuestion.tsx),
[component tests](../../app/components/chat/ClarificationQuestion.test.tsx), and
[development-only preview](../../app/dev/clarification/page.tsx) at `/dev/clarification`.
The preview uses explicit fixtures, sends no model/research requests, and calls `notFound()` outside development.
Provider-required question handling, server authorization, record grounding and continuation remain CLAR-02/03/05;
the component's local validation is not a replacement for those server checks.

- Work: compose a labeled radio group, checkbox group or text field with submit, optional additional text and an explicit
  skip action when permitted. Support long labels, real record descriptions, loading and validation errors.
- Accept: keyboard and screen-reader users can understand and submit the question. No choice is silently preselected;
  checking an option does not submit unexpectedly. Mobile layout fits and ordinary conversation remains accessible.

### CLAR-05: Validate answers and resume research

Owner: Backend/Frontend. Depends on: CLAR-02 through CLAR-04 and CONV-05.

- Work: wire AI SDK tool output submission to server validation of session ownership, pending ID, allowed options,
  cardinality, text bounds and question revision. Record the accepted answer atomically before continuing the model.
- Accept: double submission, replay, modified option IDs and a stale tab cannot answer a different question or run the
  continuation twice. The resumed model receives the original question, validated answer and retained research context.

### CLAR-06: Handle typed replies, skipping and changed intent

Owner: Backend/Frontend. Depends on: CLAR-05.

- Work: let a normal chat reply resolve the pending question or explicitly supersede it. Map free text to a canonical
  choice only when unambiguous; record cancellation/skip as a tool outcome before progressing to a new intent.
- Accept: an unanswered tool call never leaves malformed model history. Skipping does not choose a default bill or
  jurisdiction. Draft text is preserved and the user can redirect the conversation without being trapped in a form.

### CLAR-07: Preserve the answered-question record

Owner: Frontend/Backend. Depends on: CLAR-05 and CONV-03.

Status: **In progress**. Confirmed answers render once in the inline clarification summary. The model-continuation
message carries explicit clarification metadata and is omitted from the visual transcript, not from model context.
Browser checks verify a single visible answer before/after development reload and that an ordinary typed message
with identical text is still visible. Previously created untagged messages are not rewritten.

- Work: collapse submitted interactions into readable question/answer summaries and retain selected record references.
  Show superseded or expired state where applicable; treat changed answers as explicit new context for subsequent work.
- Accept: past answers and citations are not silently rewritten. Reload cannot resurrect a submitted interactive form
  as pending. Source inspection and returning to the transcript preserve focus and the accepted clarification.

### CLAR-08: Tune when the assistant asks

Owner: Product/Backend. Depends on: CLAR-06, TOOL-07 and DEC-08.

- Work: require clarification for material ambiguity in record identity, jurisdiction, session, date meaning or comparison
  versions. Reuse established context and do cheap discovery before asking users for information the tools can obtain.
- Accept: an ambiguous printed bill number produces grounded options; a clear question proceeds directly. Questions are
  concise and do not become a mandatory onboarding questionnaire. Source-data gaps are not blamed on the user's wording.

### CLAR-09: Verify the complete clarification lifecycle

Owner: QA. Depends on: CLAR-04 through CLAR-08.

- Work: test each input type, none-of-these/free-text behavior, invalid submissions, pending refresh, timeout, expiry,
  duplicate clicks, changed intent, keyboard flow and multi-turn recall of the selected scope.
- Accept: an approved live model journey searches, asks, receives a choice, resumes the correct record lookup and streams
  the grounded answer. Deterministic tests verify lifecycle correctness independently of variable model wording.

Phase exit: clarification is a complete part of the conversation, including recovery and real continuation, not a decorative form.

## Phase 6: Web research

### WEB-01: Connect Tavily Search

Owner: Backend/Platform. Depends on: DEC-05 and THEME-01.

- Work: connect Tavily's hosted MCP with `TAVILY_API_KEY` in server-side header authentication; discover and allowlist
  `tavily-search`. Configure approved result limits, general/news search and domain/date filters from the actual schema.
- Accept: a real search returns attributable URLs and excerpts. Disable unnecessary generated-answer/image payloads when
  supported; do not add Crawl, Map or another autonomous research loop. Keys never appear in URLs, logs or the browser.

### WEB-02: Connect Firecrawl source reading

Owner: Backend/Platform. Depends on: DEC-05 and THEME-01.

- Work: connect Firecrawl's hosted MCP using `FIRECRAWL_API_KEY`; allowlist `firecrawl_scrape` for approved public
  webpage/document URLs. Configure bounded extraction and discover supported output/format parameters.
- Accept: HTML and representative public PDF fixtures return actual extracted text or explicit failure. No promise of
  perfect OCR, tables, page anchors or complete content without evidence. Do not enable upload commands, Interact, Crawl or Agent.

### WEB-03: Enforce external-request safety

Owner: Security/Backend. Depends on: WEB-01, WEB-02 and DEC-02.

- Work: validate URL schemes, hosts and credentials; reject private/local targets and unsafe redirects wherever app-side
  fetching occurs. Limit sizes, duration and URLs per call; prevent forwarding internal auth or conversation secrets.
- Accept: test loopback, link-local, metadata-service, DNS/redirect and encoded-URL attacks. Rendering does not fetch
  arbitrary remote images. Provider-side fetching is a separate trust boundary whose behavior and limitations are documented.

### WEB-04: Normalize web evidence and provenance

Owner: Backend. Depends on: WEB-01 through WEB-03 and CONV-01.

- Work: assign app evidence IDs and retain requested/final URL, title, publisher where established, extraction time,
  available publication date, content hash and extracted excerpt. Keep search snippets distinct from read-source content.
- Accept: quotations match the retained extraction; missing dates stay unknown. Rank or search summaries are not proof.
  External URLs never acquire fabricated canonical bill/person IDs or overwrite existing ingested source versions.

### WEB-05: Combine canonical and web research

Owner: Backend/Product. Depends on: WEB-04, TOOL-07 and CONV-04.

- Work: use canonical records for structured facts and web sources for current developments, external context and data
  gaps. Prefer official sources for legal claims; distinguish stakeholder statements and reporting from official records.
- Accept: mixed-source answers show conflicts and dates rather than silently choosing a newer-looking webpage. Search
  queries disclose only necessary research terms. External content cannot change tool policy or system instructions.

### WEB-06: Implement provider failure and budget behavior

Owner: Backend/Frontend. Depends on: WEB-05 and CONV-07.

- Work: normalize auth failure, throttling, unavailable pages, blocked extraction, malformed responses and partial batches.
  Bound retries, honor usable retry guidance and propagate cancellation where supported.
- Accept: canonical research still works during a web-provider outage. Failed extraction is not cited as if read;
  a retry cannot loop indefinitely or quietly invoke a second provider. Provider limits never redirect to a waitlist.

### WEB-07: Verify external research acceptance

Owner: QA/Data. Depends on: WEB-03 through WEB-06 and DEC-08.

- Work: exercise official HTML, text PDF, scanned/complex PDF, recent reporting, source conflicts, unavailable content and
  injected page instructions. Inspect exact excerpts and safe source links in the browser and model evidence ledger.
- Accept: retain provider-version/target evidence and known extraction limitations. If required PDF fidelity fails,
  name the blocker before adding another parser; no fabricated page/line locators or unsourced fallback answer is accepted.

Phase exit: web discovery and source reading are real integrations in the same inspectable research loop.

## Phase 7: Embedded content and evidence

### RENDER-01: Implement a typed result renderer

Owner: Frontend/Backend. Depends on: CONV-01, THEME-05 and TOOL-04.

- Work: map validated result kinds to app-owned components, retaining stable record identity and tool-call association.
  Separate collapsed technical activity from selected user-facing results; deduplicate repeated records deliberately.
- Accept: model text cannot construct arbitrary components or executable markup. Unknown types have a safe presentation;
  partial input does not render a completed record. An empty tool result is visibly different from a loading result.

### RENDER-02: Render bills and legislative activity

Owner: Frontend. Depends on: RENDER-01.

Status: **In progress**. The bill body now has a dedicated `H18fQ0` presentation rather than generic label/value
rows: 18px status row, 13px state icon, 4px gap and the recorded latest action. Latest action is selected by source
ordinal only when the returned action collection explicitly reports `truncated: false`; partial collections do not
claim a latest action. Browser geometry checks match the 560px shell, 6px radius, 12px header/body padding and
reference title/known committee-state colors. The 320px view wraps without overflow. Canonical record navigation,
scope-name enrichment, applicable action footer and remaining status variants are not accepted as complete.

- Work: build bill summary/detail-in-conversation components with identifier, title, jurisdiction/session, source-backed
  status, latest action and relevant sponsor links. Support an ordered timeline and recorded progress where available.
- Accept: titles open evidence without invented app routes. Enacted, effective, procedural activity and unknown status
  remain distinct; no predicted passage percentage. Long titles and multiple jurisdictions fit at narrow widths.

### RENDER-03: Render people and organizations

Owner: Frontend. Depends on: RENDER-01.

Status: **In progress**. Person and organization cards now have dedicated source-grounded metadata and open
conversation-owned profile routes. Person profiles retain published term history without making historical terms
current; organization profiles separate classification/remit from sources. The profile composition was inspected
against `SeWfL` and `oI8CG`, but the full canonical shell, related-record tabs, standalone access and exact return
scroll/focus restoration are not complete. Browser checks verify profile navigation, readable 320px layouts and
draft preservation. One actual record per family passed the read-only service projection.

- Work: build person, legislature/chamber and committee components using canonical identity, jurisdiction, roles,
  service dates and returned relationships. Support person/organization ambiguity with the clarification flow.
- Accept: party is neutral metadata, not a status or inferred position. Missing contacts, membership or staff data is not
  invented. Historical service is not labeled current, and committee identity is not inferred from a similar name.

### RENDER-04: Render meetings and votes

Owner: Frontend. Depends on: RENDER-01.

Status: **In progress**. The vote body now follows Pencil `mIUTX`: 15px gavel, a 14px Newsreader
question beneath its 12px label, compact outcome row, 12px body gaps, and 20px Fraunces tally values with
top/column dividers. Only recognized source outcomes receive success/failure icons; unknown outcomes are not
classified from vote counts. Zero remains zero, missing counts are omitted, and source categories remain distinct
(Absent is not relabeled Excused; Not voting is not relabeled Not recorded). Projection probes and browser checks
cover accepted/rejected/missing outcomes, desktop/dark rendering, and an unclipped 320px screenshot. This verifies
the card body; parent-bill destination and applicable saved-work actions remain unfinished.

Vote titles now open a shadcn Sheet based on `FXJ4T` and `eVJov`, using session-owned result identity before a
read-only detail lookup. The drawer retains all reported tally categories and pages published positions in groups
of 25. Explicit page changes focus the first newly displayed member; browser checks cover Next and Previous.
Loading is visible immediately, temporary failures support retry without exposing raw errors, and expired results
focus a notice with Close instead of an ineffective retry. Browser checks cover pending-request cancellation,
late-response rejection, restored trigger focus, unchanged drafts and an unclipped 320px expiry notice. These are
controlled-response acceptance checks, not evidence of a successful live research journey. The exact app-local
`VoteDetails.test.tsx` recovery suite remains a separate verification gate.

- Work: build meeting/agenda and vote components with published date/time/zone, motion/question, result, available tallies,
  member positions and source references. Use bounded lists and continuation for large roll calls.
- Accept: procedural votes are not labeled final passage; absent, abstain, not-voting and unknown remain distinct.
  Missing agendas/outcomes are not empty confirmed events. No external calendar controls or inferred future hearings.

### RENDER-05: Render amendments, documents and materials

Owner: Frontend. Depends on: RENDER-01.

Supporting material titles now open a conversation-owned text reader, with source-ordered sections and bounded
continuation. Pending, processing, failed, unsupported and unavailable text remain distinct; stale extracted text
is hidden unless processing is complete. Meeting attachments are checked against their session-owned parent and
open an unavailable-text reader when no extracted document is linked. Returning restores the selected meeting.
Browser checks cover text continuation, attachment return, draft preservation and 320px layouts; a real material
passed the service projection. Full version-specific preview/download behavior and exact origin focus/scroll
restoration remain open against `subEg`/`I7oRP`; these routes are not complete canonical standalone readers.

Document header/body styling follows Pencil `keeKC`: file-text icon, version date, source row and version note.
Only returned calendar dates, source hostnames and raw version codes are displayed; database creation time is not
a retrieval timestamp, and a hostname is not a publisher name. The working Open source footer is provisional,
not the designed reader action. Its desktop height is about 34px; touch uses a 44px action without stacked padding.
Reader, comparison and saved-work actions remain incomplete.

Amendment metadata/status styling follows Pencil `CFj83`: file-diff icon, offered-by metadata, localized submitted
date and a compact status row. Direct research fields supply these values; missing sponsor/status/date fields are
omitted, and submission dates are not status dates. Known successful/unsuccessful statuses have distinct icons;
unknown statuses stay neutral. Parent bill labels, canonical title/parent navigation and Add to issue remain open.
These body-level changes do not constitute complete card acceptance.

- Work: create amendment, document-version and supporting-material components with returned identity, type, date, version,
  source and available text. Include gated legal-text blocks only when the connected operation is authorized and enabled.
- Accept: document-backed amendments do not invent sponsor/status fields. Missing/OCR-pending/unsupported/failed text
  remain distinct. Direct source links and available extracted text work without requiring full standalone product pages.

### RENDER-06: Render result collections and comparisons

Owner: Frontend/Backend. Depends on: RENDER-02 through RENDER-05 and TOOL-05.

Result snapshots now carry explicit `card` or `list` presentation from the originating tool. Single-record searches
and short final pages remain indexed lists; individual detail lookups use cards. This prevents layout changes based
solely on item count. Server probes cover exhausted continuations, and browser checks confirm a single-result search
has no detail-card wrapper or unnecessary pagination row. Other collection/navigation acceptance remains open.

Retrieval feedback now follows `h28wD` / `admK7`: a 12px-padded, 6px-radius inline notice above navigation.
Loading retains the current rows and disables navigation. Temporary failures focus the shadcn Try again button;
successful retry focuses the first new row. Expired or foreign snapshots return HTTP 410, retain visible records,
disable pagination and focus an explanatory notice instead of offering an ineffective retry. A new question is
required to retrieve current results; no expired query is reconstructed from client data. Browser checks cover
the loading/failure/retry/expiry sequence, preserved draft, and 320px layout. Canonical record navigation and
live data pagination acceptance remain open.

- Work: compose mixed record lists, accessible tables and exact-version comparison hunks. Display selected version
  identity and dates, source-grounded additions/removals, and continuation for long collections.
- Accept: literal differences come from the comparison service, not generated paraphrases. Semantic interpretation is
  separately labeled. Table overflow has a usable mobile treatment and differences are understandable without color alone.

### RENDER-07: Bind claims and citations to evidence

Owner: Backend. Depends on: TOOL-04, WEB-04 and CONV-01.

- Work: reuse suitable research-answer validation to resolve citations only against evidence produced for this run.
  Bind canonical document/section/version or external extraction snapshot; validate quotes and locators before publishing them.
- Accept: fabricated citation IDs and quotes never become verified citations. Validate complete claim/citation units before
  rendering them as grounded, even while text streams. Citation existence alone is not proof of semantic claim support.

### RENDER-08: Build citation inspection and copy behavior

Owner: Frontend. Depends on: RENDER-07 and THEME-05.

Status: **In progress**. Retrieved evidence now uses a collapsed, counted source disclosure instead of expanding
every search result below the answer. Inline citations still open their retained evidence directly. Expanded rows
show domain, version and passage separately when available. Browser acceptance covers collapsed default state,
keyboard expansion, all eight fixture sources remaining accessible, direct citation opening, evidence-close focus
restoration, and long-title layout at 390px without horizontal overflow. The label deliberately says "Retrieved
sources", not "Cited" or "Verified"; this does not establish claim-support validation under RENDER-07.

The evidence panel slides in over 240ms and out over 180ms; its mobile backdrop fades on the same schedule.
The last displayed source remains mounted during exit so closing does not flash an empty panel. Reduced motion
disables both animations. Browser checks verify exit content retention, mobile panel width, no animations under
reduced motion, restored citation focus, and the restored icon-only Copy button's copied-state feedback.

- Work: provide inline markers, a source list, exact passage inspection, source opening and copy citation. Show appropriate
  version/date/locator metadata for each source type and distinguish extracted web text from canonical document text.
- Accept: a marker always opens the evidence used for that answer, not the newest version silently. Missing locators are
  omitted. Copying a citation does not include a private transcript or secret URL; close/Back restores focus and reading position.

### RENDER-09: Connect component actions to research context

Owner: Frontend/Backend. Depends on: RENDER-02 through RENDER-08 and CLAR-05.

Status: **In progress**. The composer opens a shadcn reference picker based on `CVCjG`, with explicit Add/Cancel,
removable staged chips and a type menu. Existing result records can be staged immediately; bounded live searches
cover bills, people, organizations, meetings, votes, amendments and materials. Search returns up to five per type;
document versions can currently be selected only from retrieved records. References are limited to 12 per turn,
deduplicated by record identity and resolved against session-owned result snapshots before model execution.
Model context contains server-resolved identities, not client labels, evidence or retrieval restrictions. Staged
references survive development reloads; submitted message metadata preserves the original reference set for retry
and clarification continuation. Profile/reader Ask stages the record and returns without replacing draft text or
sending. Meeting attachments cannot yet be staged independently.

The current `@` entry opens the same picker restricted to people/organizations; it is not yet the designed inline
mention interaction. Collapsed reference groups, sent-turn reference display, comparison selection and browser
acceptance are unfinished. Live read-only searches succeeded for all seven searchable families; ownership,
deduplication, reload retention and request bounds passed focused runtime checks. Web types and scoped lint pass.
Integrated browser connection timed out during acceptance; no visual or interaction completion is claimed.

- Work: support opening a record, staging a record/version as context, asking a follow-up and explicitly choosing
  comparison versions. Keep the distinction between inspecting evidence and changing the next question's scope.
- Accept: actions use canonical IDs and preserve unsent text. Nothing submits unexpectedly, activates following, saves
  an issue or invents a route. Old answers retain their original evidence after the visitor changes context.

### RENDER-10: Verify component families and composed answers

Owner: QA/Frontend. Depends on: RENDER-02 through RENDER-09.

- Work: test each family with populated, long, missing, failed and paginated data, then inspect mixed streamed answers
  in the browser. Reuse a compact component gallery or existing story infrastructure rather than a parallel UI application.
- Accept: all required record types can be inspected from chat at desktop/mobile sizes. At least one actual tool result
  per enabled family reaches its renderer; static fixtures alone do not establish integration completion.

Phase exit: the conversation contains real, interactive domain content with inspectable evidence and reusable presentation.

## Phase 8: Reliability, safety and privacy

### SAFE-01: Enforce public execution controls

Owner: Backend/Platform. Depends on: DEC-05, CONV-06 and TOOL-05.

- Work: implement per-run tool/model/time/context limits, shared concurrency limits, fair request throttling and an
  operator emergency stop. Account for anonymous session resets and shared-network users in abuse controls.
- Accept: controls operate across replicas, not just browser state. Ordinary users can continue asking without a fixed
  question allowance. Throttling explains retryability; no limit or provider outage displays a signup/waitlist demand.

### SAFE-02: Verify source trust and rendered-content safety

Owner: Security/Backend. Depends on: WEB-03, RENDER-01 and RENDER-07.

- Work: validate and sanitize rendered Markdown/links; disallow executable HTML and automatic external embeds. Exercise
  prompt injection in retrieved records, PDF text, search snippets, tool descriptions and malicious citation URLs.
- Accept: untrusted content cannot exfiltrate secrets, register tools, alter authorization or fabricate trusted results.
  Review tool-definition changes before enabling them; third-party read-only hints are not security policy.

### SAFE-03: Implement redacted observability

Owner: Backend/Platform. Depends on: CONV-05, TOOL-07 and WEB-06.

Status: **In progress**. September 16: opt-in Sentry 10.73.0 captures browser, Next, stream and research errors.
An actual in-memory SDK transport probe confirmed sensitive data removal while preserving tool/category/reference.
Existing OpenTelemetry setup is preserved. Editor MCP uses project-scoped hosted OAuth without stored tokens;
local DSN, OAuth and live error/replay receipt are verified. Replay is intentionally unmasked for the demo by user
direction; logs and performance tracing remain disabled. Tool execution, pre-execution validation and unknown-tool
failures now use per-run deduplicated reporting, verified through the real SDK with a local mock model. Browser
transport errors and caught API 5xx responses are also covered. Source-map upload and wider run/cost/production
observability acceptance remain open. See [setup and privacy boundary](../operations/development.md#sentry-error-monitoring).

- Work: extend existing Langfuse/OpenTelemetry/logging with conversation/run correlation, tool name, durations, counts,
  model/provider, token/cost information where returned, terminal status and safe errors. Review payload capture defaults.
- Accept: normal production traces exclude full prompts, answers, private reasoning, cookies, tokens and sensitive URLs.
  Aborted usage that cannot be measured is marked unknown, not zero. Operators can trace a failure without reading the conversation.

### SAFE-04: Implement retention and deletion jobs

Owner: Backend/Platform. Depends on: DEC-03, CONV-03 and SAFE-03.

- Work: enforce the approved TTL and deletion behavior for conversations, pending questions, evidence snapshots and run
  receipts. Reuse the existing background execution platform if a scheduled job is needed; review log/backup retention too.
- Accept: expired or deleted sessions cannot retrieve old content or submit clarification. Cleanup never touches
  canonical ingestion data or credentials. UI/privacy language explains retention and backup limitations accurately.

### SAFE-05: Protect ingestion resources during interactive use

Owner: Backend/Data/Platform. Depends on: TOOL-08, WEB-07 and SAFE-01.

- Work: measure query pool pressure and search/model contention during ingestion; use bounded statement deadlines,
  connection budgets and request admission. Identify existing pools/services instead of opening one connection per tool.
- Accept: live research does not starve ingestion, build indexes or reset search state. A slow dependency fails with
  an actionable partial result. Broad search cutover remains owned by the existing data acceptance gates.

### SAFE-06: Define graceful degradation and health semantics

Owner: Backend/Frontend. Depends on: WEB-06, CONV-07 and TOOL-04.

- Work: distinguish model outage, canonical-data outage, web-search outage, failed extraction and malformed secondary
  content. Keep already-rendered answers readable and the static shell independent of an optional provider probe.
- Accept: health/readiness checks do not call paid model or search services. Existing health contracts remain intact;
  temporary provider failures do not expose keys, make false no-data claims or mark an incomplete answer complete.

### SAFE-07: Review deployment secrets and network exposure

Owner: Security/Platform. Depends on: CONV-02, TOOL-02, WEB-03 and SAFE-03.

- Work: audit environment-variable exposure, outbound hosts, MCP authentication, CSP, cookie settings, cache headers and
  source-link handling. Separate local/staging/production credentials and any rights-gated legal-text configuration.
- Accept: no `NEXT_PUBLIC_*` secret, bearer-in-URL, shared public transcript cache or privileged generic proxy. Anonymous
  sessions cannot use the app's service identity to enumerate nonpublic organization resources.

### SAFE-08: Complete operational failure drills

Owner: QA/Platform. Depends on: SAFE-01 through SAFE-07.

- Work: exercise provider 429/5xx, invalid tokens, empty tool discovery, midstream network loss, process termination,
  database saturation, repeated requests and deletion while a run/clarification is pending.
- Accept: observed outcomes match the lifecycle and retention contracts. No duplicate continuations, orphaned long-lived
  transports, misleading success states or unbounded retries. Record unresolved provider-side cancellation limits.

Phase exit: public access has enforceable boundaries, useful diagnostics and recovery without altering the agreed product scope.

## Phase 9: Acceptance and verification

### QA-01: Extend the focused executable test harness

Owner: QA/Backend. Depends on: DEC-08 and CONV-01.

- Work: reuse Vitest, app integration fixtures and existing browser infrastructure. Add deterministic model/MCP/search
  transport fixtures and failure injection for executable behaviors; isolate mutable database tests from live data.
- Accept: tests never reset the canonical production database, leak credentials or rely on the design's invented records.
  Mocked transport cases and paid live canaries are separable; no test suite is created for this backlog's prose.

### QA-02: Evaluate grounded research quality

Owner: QA/Data. Depends on: TOOL-08, WEB-07, RENDER-07 and QA-01.

- Work: assess source-supported claims, quotation fidelity, exact versions, status/effective-date distinctions, vote
  interpretation, cross-jurisdiction scope and web/canonical conflict handling against DEC-06 thresholds.
- Accept: unsupported claims and bad citations are release blockers. Review semantic support manually as well as
  validating IDs; a syntactically valid citation or high retrieval score alone is not an evidence-quality pass.

### QA-03: Evaluate conversational and clarification behavior

Owner: QA/Product. Depends on: CLAR-09, CONV-09, RENDER-09 and QA-01.

- Work: run realistic multi-turn tasks with shorthand references, changed topics, amended scope, unresolved entities,
  skipped questions and previously selected versions. Include more than three turns and a forced context-compaction case.
- Accept: the assistant asks when needed, remembers explicit choices, permits redirection and never forces waitlist
  enrollment. Failure to find evidence remains distinct from uncertainty about what the visitor asked.

### QA-04: Complete security and isolation acceptance

Owner: Security/QA. Depends on: SAFE-02, SAFE-04, SAFE-07 and QA-01.

- Work: test cross-session reads/writes, tool-output forgery, stale/replayed clarification, CSRF, URL attacks, source
  injection, credential redaction and gated-data access. Verify authorization before retrieval and before cached result reuse.
- Accept: no finding permits unauthorized access or execution. Capture reproduction and repair evidence for failures;
  model refusals alone cannot count as the enforcement mechanism.

### QA-05: Complete browser and accessibility acceptance

Owner: QA/Design. Depends on: THEME-07, RENDER-10, CLAR-09 and SAFE-06.

- Work: exercise the complete customer journey in the integrated browser at 320/390px mobile, medium, laptop and desktop
  widths, plus 200% text size. Test keyboard, accessible names, focus return, live announcements and reduced motion.
- Accept: mobile keyboard does not conceal input/actions; streaming does not forcibly scroll older content or announce
  every token. All approved theme modes and source/clarification overlays pass rendered inspection, not screenshots alone.

### QA-06: Measure latency, cost and ingestion overlap

Owner: QA/Platform/Data. Depends on: SAFE-05, SAFE-08 and QA-02.

- Work: measure time to useful feedback, first answer content and completion; tool latency, context growth, cost per
  representative run and concurrency effects. Exercise approved load alongside active ingestion with a safe test budget.
- Accept: meet DEC-06 targets or record a release-blocking decision. No timing is presented as a production SLA from one
  small canary; failures are not fixed by silently broadening timeouts or changing embedding/search infrastructure.

### QA-07: Run repository and build gates

Owner: Engineering. Depends on: implementation complete and QA-02 through QA-06.

- Work: run the smallest relevant completed-slice checks, repair related defects, then `pnpm --filter legislation build`
  and root `pnpm verify`. Confirm frozen dependency installation and the release Docker build.
- Accept: record exact commands and results tied to the candidate artifact. Unrelated dirty-work/install failures are
  named, never reverted or hidden. Do not call verification clean or proceed as fully accepted while required gates are blocked.

### QA-08: Sign off the release candidate

Owner: Product/Engineering/Platform. Depends on: QA-02 through QA-07.

- Work: review the operation matrix, known data gaps, provider extraction limitations, privacy copy, retention policy,
  cost controls and remaining defects. Confirm release scope, operational owner and allowed target environment.
- Accept: no unsupported tool, fake example answer, waitlist control or unapproved persistence feature remains. Explicitly
  approve or block the candidate; a completed implementation checklist is not by itself production authorization.

Phase exit: behavior is verified end to end and the exact candidate is eligible for a controlled release.

## Phase 10: Railway production release

### RELEASE-01: Prepare an isolated release rehearsal

Owner: Platform. Depends on: DEC-05 and DEC-08; deployed rehearsal requires QA-08.

- Work: choose an approved Railway staging/preview target in the existing project or another approved isolated target.
  Plan provider keys, allowed data fixtures, public origin, retention and smoke credentials without changing production ingest jobs.
- Accept: environment/service IDs and permissions are recorded. Do not create a new billable environment silently or
  point destructive test setup at production. Anonymous chat and protected API/MCP canaries have separate credentials.

### RELEASE-02: Verify release configuration and container

Owner: Platform/Backend. Depends on: QA-08 and RELEASE-01.

- Work: retain repository-root Docker context, `apps/legislation/Dockerfile`, Config File Path
  `/apps/legislation/railway.json`, `PORT` binding on `0.0.0.0`, non-root runtime and `/ready` health check. Check watched paths.
- Accept: installed dependencies, fonts/assets and standalone output are present in the image. Server-only provider/MCP
  secrets are runtime configuration, not baked into builds. Shell rendering does not depend on external model calls.

### RELEASE-03: Rehearse schema and recovery operations

Owner: Backend/Platform. Depends on: CONV-03, SAFE-04 and RELEASE-02.

- Work: review the pending schema diff against the actual target, including unrelated concurrent migrations; apply only
  approved changes through the explicit release operation. Follow the repository's fix-forward prototype schema policy.
- Accept: neither build nor startup auto-migrates. No database reset, ingestion repair or credential replacement is
  bundled into this release. Record a recovery plan compatible with the resulting schema, not an assumed old-app rollback.

### RELEASE-04: Run staged end-to-end canaries

Owner: QA/Platform. Depends on: RELEASE-03.

- Work: exercise real streaming, model-to-MCP research, Tavily-to-Firecrawl reading, inline clarification continuation,
  embedded records, citations, reload/stop/retry and privacy boundaries on the staged artifact.
- Accept: proxy transport delivers incremental content rather than buffering the whole reply. Existing authenticated
  API/MCP smoke remains healthy; source reading and tool errors are inspected beyond HTTP status. Capture desktop/mobile results.

### RELEASE-05: Authorize and execute the production deployment

Owner: Platform/Product. Depends on: RELEASE-04.

- Work: obtain explicit production release approval, identify the running and immediately preceding successful
  `legislation-web` artifacts, review effective environment differences and deploy the approved candidate to explicit IDs.
- Accept: record the submitted deployment ID and observe its `SUCCESS` state. Upload success or command exit zero is
  insufficient. Do not deploy unrelated unfinished workspace changes or recreate `legislation-api` as a rollback target.

### RELEASE-06: Verify the public production experience

Owner: QA/Platform. Depends on: RELEASE-05.

- Work: verify the actual HTTPS origin, homepage, `/health`, `/ready`, cookies, streaming, clarification, source panels,
  repeated follow-ups and approved retention. Run existing authenticated API/MCP smoke and a bounded mixed-source research canary.
- Accept: a visitor can converse beyond three questions without login/waitlist prompts. Correct records and evidence
  render at desktop/mobile sizes; protected operations still reject unauthorized callers. Leave no sensitive smoke artifacts public.

### RELEASE-07: Verify emergency stop and release recovery

Owner: Platform. Depends on: RELEASE-06 and SAFE-08.

- Work: rehearse disabling new chat runs independently of ingestion/API serving, inspect alerts, and verify the approved
  fix-forward or prior-compatible-artifact recovery procedure. Define treatment of in-flight runs during a release replacement.
- Accept: operators can contain spend or failures without deleting data/services. No old artifact is restored against an
  incompatible schema. Record final deployment status, origin, known limitations and who owns the next observation window.

Phase exit: the approved candidate is actually serving verified public conversations on Railway.

## Phase 11: Pilot operations and handoff

### PILOT-01: Observe the first production window

Owner: Platform/Product. Depends on: RELEASE-07.

- Work: observe the agreed initial window using redacted model/tool latency, failure, abandonment, clarification and
  cost signals. Track ingestion pool pressure and provider exhaustion separately from UI completion.
- Accept: compare measurements to agreed thresholds and record the observation interval and owner. Do not use transcript
  capture as an unannounced substitute for telemetry or infer success solely from a healthy process.

### PILOT-02: Validate retention and privacy in production

Owner: Security/Platform. Depends on: PILOT-01 and SAFE-04.

- Work: confirm actual expiry/deletion processing, log retention, provider settings and secret custody using controlled
  sessions. Review any diagnostic payloads emitted by newly integrated libraries after deployment.
- Accept: retained data matches the approved policy; expired sessions and pending questions fail safely. No private
  research, credentials or user identifiers appear in provider URLs or routine application telemetry.

### PILOT-03: Resolve observed launch defects

Owner: Engineering/QA. Depends on: PILOT-01.

- Work: triage groundedness, clarification, streaming, usability and provider failures. Convert reproducible defects into
  focused regression tests and reviewed fixes; add missing work to this backlog with explicit scope and dependencies.
- Accept: critical access/citation/data-integrity defects block continued rollout. Repairs repeat the relevant acceptance
  and release gates; no additional tools, model fallback or ingestion changes are enabled as an unreviewed workaround.

### PILOT-04: Reconcile the larger product roadmap

Owner: Product/Engineering. Depends on: PILOT-03.

- Work: link reusable delivered conversation/theme/evidence work to the parent backlog's BASE, CHAT, VIEW and SHIP rows.
  Identify remaining account, history, full-page navigation and write-back requirements separately.
- Accept: parent tasks are not marked fully Done for a public-chat subset. Waitlist, issues, alerts, team workspaces,
  uploads and action approvals remain deferred until separately selected; there is no automatic prototype-data migration promise.

### PILOT-05: Close the release handoff

Owner: Product/Platform. Depends on: PILOT-02 through PILOT-04.

- Work: deliver the public URL, exact deployed artifact, enabled tool matrix, evidence links, runbooks, owner contacts,
  provider budgets, known data gaps and next-priority tasks. Record final gate status and explicit remaining blockers.
- Accept: another engineer can operate, debug, disable and redeploy the experience without access to this conversation.
  No phase is marked complete with missing production evidence or unnamed operating ownership.

Phase exit: the first experience has an operating owner and an evidenced handoff, not only a successful deployment.

## Required acceptance journeys

These scenarios supplement task-level tests. Use real eligible fixtures, with deterministic substitutes only in isolated
automated tests. Each row needs a result, target/artifact, evidence link and any limitation before its owning gate closes.

| Journey | Required observation | Owners |
| --- | --- | --- |
| First question | Homepage composer sends; real tool activity appears; sourced answer and record component render. | CONV-09, TOOL-08, RENDER-10 |
| Ambiguous bill | Actual candidate records appear; selection resolves the intended jurisdiction/session; research resumes once. | CLAR-09 |
| Typed clarification reply | Normal chat answers or supersedes the pending question without malformed tool history or lost draft. | CLAR-09, QA-03 |
| Many follow-ups | More than three questions work; compaction retains explicit scope and exact evidence references. | CONV-08, QA-03 |
| Bill changes | Two real versions are selected; service-produced diff and interpretation are distinct; both sources inspectable. | RENDER-06, QA-02 |
| Who voted | Procedural/final votes and individual positions are correctly distinguished; pagination is honest. | TOOL-08, QA-02 |
| Civic research | Person, committee and meeting identities and relationships follow actual returned data, including gaps. | RENDER-03, RENDER-04 |
| Amendment/material | Structured and document-backed amendments and extracted supporting materials retain their actual identity. | RENDER-05, TOOL-08 |
| Web plus canonical | Search finds external reporting; source is read; answer distinguishes it from official legislative facts. | WEB-07, QA-02 |
| Public PDF | Extracted quotation is inspectable; OCR/format/locator limitations are explicit rather than invented. | WEB-07, RENDER-08 |
| No evidence | Search failure, unsupported/gated scope and a genuine empty response produce different safe outcomes. | SAFE-06, QA-02 |
| Stop and disconnect | Partial answer remains readable; late events cannot overwrite terminal state; explicit retry is deduplicated. | CONV-09, SAFE-08 |
| Clarification recovery | Refresh, expiry, replay and concurrent tabs cannot answer stale questions or continue twice. | CLAR-09, QA-04 |
| Cross-visitor access | Guessed IDs, copied URLs and forged tool results cannot expose or mutate another conversation. | QA-04 |
| Ingestion overlap | Interactive load meets agreed budgets without starving ongoing source ingestion or modifying its indexes. | QA-06 |
| Production path | Railway serves incremental output and all enabled tool families while existing API/MCP auth remains healthy. | RELEASE-06 |

## Dependency and scope handoff

Critical path: **DEC contracts -> THEME foundation and CONV runtime -> TOOL research -> CLAR interaction -> WEB evidence
and RENDER components -> SAFE controls -> QA acceptance -> RELEASE -> PILOT observation**.

Theme and provider configuration can proceed independently after their decisions. Clarification UI can be built against
its validated contract before real model continuation is ready, but CLAR-09 requires the complete loop. Component families
can proceed independently after RENDER-01. None of these parallel implementation options waive their integration gates.

| Parent work | This release contributes | Still outside this release |
| --- | --- | --- |
| BASE-04, BASE-05, BASE-10 through BASE-15 | Fixtures, read adapters, contextual evidence, components and test foundations | Full signed-in shell, account lifecycle and all product destinations |
| CHAT-01, CHAT-03 through CHAT-11, CHAT-13 through CHAT-15 | Conversation contracts, context, streaming, tool access, citations and quality | Private-account history and any persistence/history scope not selected in DEC-03 |
| CHAT-02 and CHAT-12 | Only the explicitly approved anonymous retention/refresh behavior | Account-owned list/rename/delete/history management unless separately approved |
| VIEW-01 through VIEW-22 | Reusable record and evidence presentation embedded in chat | Full standalone directories, record pages and unrelated product navigation |
| CHAT-16 through CHAT-18, ISSUE and ALERT | No completion credit | Product mutations, saved issues, briefs, following, notifications and external messaging |
| SHIP-03, SHIP-04, SHIP-06 through SHIP-08, SHIP-10 through SHIP-14 | Public chat's diagnostics, verification, privacy and Railway release evidence | Full-product, organization, email and notification acceptance |

## Explicitly deferred

- Waitlist capture, conversion gates, invitation emails and launch campaigns.
- Fixed question allowances or compulsory signup to continue research.
- Accounts, shared/team conversations, workspaces, billing and subscription-based tool entitlements.
- Separate conversation-history UI until DEC-03 explicitly includes it; public sharing and cross-device recovery.
- Issues, saved briefs, follows, alerts, webhooks, contact actions and any other mutation tool.
- Full search/directory/detail routes beyond the evidence interactions needed by chat.
- Uploads and Firecrawl Parse, browser automation, autonomous provider research agents and scheduled web monitoring.
- Raw SQL, shell, arbitrary code execution, unrestricted HTTP tools and visitor-supplied MCP servers.
- Building new datasets, legal-deadline engines, regulation-search capabilities or representative address lookup here.
- New ingestion/index migrations, embedding changes and preservation/migration of disposable prototype state.

## Reference links

- [Design source](../../legislation.pen), Area 12; [design brief](../design/design.md).
- [Public API contract](../engineering/api/README.md) and [MCP contract](../engineering/tool-contracts.md).
- [Regulatory API/MCP boundary](../regulations/api-mcp-contract.md) and [source acceptance](../operations/passage-search-delivery.md).
- [Authentication](../operations/authentication.md), [runtime/deployment](../operations/development.md), and
  [database pooling](../operations/database-connection-pooling.md).
- [AI SDK interactive tools](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage),
  [MCP client](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools), and
  [OpenRouter provider](https://ai-sdk.dev/providers/community-providers/openrouter).
- [Tavily MCP](https://docs.tavily.com/documentation/mcp), [Firecrawl setup](https://docs.firecrawl.dev/mcp-server), and
  [Firecrawl tools](https://docs.firecrawl.dev/mcp-server/tools).

## Execution record

No implementation task has started and no release gate has passed by creation of this backlog. Begin with DEC-01,
DEC-02 and DEC-03; assign owners and resolve the selected defaults before dependent implementation. This document is
local planning material until the user explicitly chooses how to publish it; do not stage or include it in a code PR
without that instruction.