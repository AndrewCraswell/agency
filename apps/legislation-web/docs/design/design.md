# Legislative research app design specification

Maintained design handoff; product priorities and navigation follow the current product specification and IA.

## 1 Purpose and design assignment

Design a conversational web application for discovering, understanding, and following legislation, representatives,
and committees. The home page is a chat box through which users research and operate the product. Answers open into
interactive results, source evidence, record profiles, bill progress, and following controls.

Produce an information architecture, annotated screen designs, reusable components, and connected desktop and mobile
prototypes. This brief contains the requirements needed for preliminary design. It describes intended behavior rather
than claiming that every supporting API, dataset, or notification integration is ready.

The primary experience is **ask, inspect evidence, maintain an issue, and prepare a reviewed update** for association
and boutique policy researchers. Users can also browse and manage work directly; evidence inspection preserves context.

Use the [IA collection requirements](../product/information-architecture.md#supporting-discovery) for high-volume surfaces:
period scope, grouping, filters, ordering, bounded rendering and selection. Show those behaviors in connected
desktop/mobile designs, not only short sample lists.

### Workflow handoffs

The [product specification](../product/product-spec.md) owns ICP priorities and scope; the IA owns navigation.
The focused contracts below own their respective behavior. This brief retains shared visual requirements and examples,
not a competing conversation contract or proof of implemented capabilities.

| Deliverable | Owning design specification |
| --- | --- |
| Open chat anywhere, manage turns/references, render answers, inspect citations and write selected work back | [Conversation screens](#5-conversation-screens) |
| Maintain issues, prepare/review briefs and navigate exact evidence | [IA objects, surfaces and connected flows](../product/information-architecture.md) |
| Configure monitoring and in-app/email delivery | [Notification experience](../product/notification-experience.md) |
| Govern account/integrations and conditional shared work | [Product boundaries](../product/product-spec.md), [organization behavior](../product/organization-features.md) |

Use one coherent source fixture set across the connected journeys. Reuse shared collection, evidence and craft components;
do not implement separate chat and direct-control versions of the same feature.

### Fixed product decisions

- Conversation is the home experience. There is no separate AI assistant destination or dashboard before the composer.
- Bills, representatives, and committees are first-class research and following targets.
- Personal issue trackers keep research scope and relevant records accessible across conversations.
- Every substantive generated claim has inspectable source evidence. Official records, generated interpretations, and
  user annotations are visibly distinguishable.
- Bill progress reflects recorded evidence and the applicable legislative process, without a percentage-complete score.
- Novu supports the in-app and email notification experience. The bell and Updates share one inbox state.
- MCP setup belongs in Settings, Integrations. It connects external AI clients to this product; web users need no MCP setup.
- Conversations and issue trackers are personal in the initial experience. Do not imply team sharing or automatic
  organization-wide notification delivery.

### Designer discretion

Propose typography, palette, iconography, component styling, spacing, tab grouping, responsive breakpoints, and motion.
Recommend a coherent visual direction with one representative workspace and record view before styling every screen.
Use readable, restrained surfaces suited to long research sessions. Make evidence and primary actions easier to find
than decoration. Exact layouts below express hierarchy and behavior, not mandatory pixel coordinates.

Do not introduce additional product capabilities through visual mockups without labeling them as proposals.

## 2 Users and the tasks to support

| Perspective | Typical task | What the design must help them understand |
| --- | --- | --- |
| Association policy researcher | Prepare a recurring member/board update | Relevant developments, exact amended text, selected findings and reviewable citations |
| Lobbyist | Track an issue across states, notice a hearing change, review amended text | What changed, the next published event, supporting evidence, and notification timing |
| Person following representatives | Identify an officeholder and understand their work | Correct identity and service period, sponsorship versus bill outcomes, and the question behind a vote |
| Lawyer | Follow proposed legal changes and compare provisions | Exact versions and passages, as-of dates, effective-date conditions, and limits of corpus coverage |
| Non-profit researcher | Follow an issue across jurisdictions and prepare an update | Why records match, gaps in coverage, manageable alerts, and reusable cited findings |
| Company researcher | Monitor proposed changes relevant to an industry | Differences across jurisdictions and the evidence behind a relevance assessment |

The [ICP strategy](../product/icp.md) prioritizes association teams and solo/boutique researchers. Other perspectives
test evidence comprehension, not separate product modes or equal go-to-market priority.
Industry relevance and political or legal interpretations must never be presented as established facts without evidence.

## 3 Information architecture

```text
New conversation                      Default home
Conversations                         Recent and saved research
Updates                               Personal notification inbox
Issues                                Persistent personal research trackers
Following                             Record and query subscriptions
Explore
  Search
  Bills
  Representatives
  Committees
  Meetings
Settings
  Account
  Address
  Data and privacy
  Notifications
  Integrations
    MCP connection
    Webhook destinations

Evidence reachable from any relevant surface
  Bill and legislative progress
  Representative
  Committee or organization
  Vote
  Meeting and agenda
  Amendment
  Document and passage
  Version comparison
  Supporting material
```

Keep New conversation, recent conversations, Updates, Issues, and Following easy to reach. Explore can occupy a
secondary navigation group. Place account/settings consistently and provide a persistent notification bell.

**Conversation** holds a question sequence and its explicit context. **Issue** holds durable research scope and selected
records. **Following** holds the rules that generate updates. Creating an issue does not silently create subscriptions.
Archiving a notification does not stop following its subject.

Record views have stable standalone URLs and also open beside a conversation. A representative is a canonical person;
a committee is a canonical organization. Different entry points must lead to the same record identity and template.
The exact route inventory remains an engineering concern and is not necessary for the designer to invent.

## 4 Shared workspace layout

### Wide screens

Use persistent navigation, a main conversation region, and an optional evidence region. Initially the composer is
prominent in the main region. Once a conversation begins, messages occupy the central reading area with the composer
accessible below. Selecting a result opens evidence beside the conversation. Users can expand evidence to a standalone
page and return without losing their place.

Keep question text, citations, and document passages comfortably readable. Collapse navigation or expand evidence when
necessary rather than forcing three unusably narrow columns. The designer should show both closed and open evidence states.

### Narrow screens

Use one main content surface at a time. Evidence opens as a full-width view with a clear return to the conversation.
Navigation and context controls can use sheets or drawers. Preserve draft text, scroll position, filters, and selected
versions when switching views. The on-screen keyboard must not conceal the composer or its send/stop control.

### Cross-surface behavior

- Opening a record is distinct from adding it to research context. Provide an explicit add-to-context action.
- Browser Back reverses navigation. Closing evidence restores focus to the result or citation that opened it.
- Copying a record or passage link never includes private conversation content. Copying a search link makes clear that
  its query and filters are included.
- Direct links work without a prior conversation. Sign-in returns the user to the intended destination.
- Failed secondary content must not prevent reading evidence that loaded successfully.

## 5 Conversation screens

This conversation-screen section is the canonical handoff for these screens and supersedes
earlier conversation/context/citation/action examples wherever they disagree. It defines global and contextual entry,
linear turns, the composer, supported content blocks, reference tagging, evidence citations, truthful activity and explicit
write-back. Its canvas alignment section distinguishes reusable components from unsupported visible controls.

| Surface | Design emphasis |
| --- | --- |
| Home/new draft | Composer and explicit scope; no mandatory setup or issue; references alone do not submit |
| Active conversation | One readable transcript/composer, selected references and optional shared evidence view |
| Contextual entry | Reuse the same conversation and destination picker; Ask/Add to context stage input without sending |
| History | Authorized conversations with title, recent activity, rename and consequential deletion; no public sharing |
| Progress and recovery | Truthful executed work, incomplete output and original-operation recovery, not private chain-of-thought |
| Write-back | Exact proposed destination and confirmed receipt; Issues/Brief/Following own the saved result |

Deleting a conversation does not delete independently saved issues, findings or follows. Shared history requires the
organization ownership and authorization contracts; it is not enabled merely by a workspace selector or this handoff.

## 6 Discovery and evidence screens

### Structured search and directories

**Purpose:** let users refine discovery directly without writing a new message for every filter change.

Search has query, record-type selection, appropriate filters, results, and coverage feedback. Bills support jurisdiction,
session, status, sponsor, and supported dates. Representatives support name, jurisdiction, office/chamber, and service
period. Committees support name, jurisdiction, chamber, and classification. Offer manual officeholder discovery without
requiring an address. Support ambiguity by showing jurisdiction, office, and service dates in selection results.

Results expose enough identity and relevant context to decide what to open. Preserve filters and scroll position when
returning. Show exact-word search as a deliberate option, explain unavailable modes, and identify truncated results.
Never render ranking scores as confidence percentages. Empty results and unavailable coverage need different states.

### Bill detail

**Purpose:** answer which bill this is, where it stands, and what changed most recently.

Content hierarchy:

1. Printed identifier, title, jurisdiction/session, current recorded status, latest action/date, and follow control.
2. Recorded progress visualization and the next published event if available.
3. Activity timeline and access to text, amendments, votes, sponsors, and committee relationships.
4. Document versions, source links, and contextual coverage/freshness information.

Keep identity and version context visible during long reading. Secondary actions include ask about this bill, add to
issue, copy link, read a version, and compare versions. The activity filter should make actions, votes, amendments, and
document publication distinguishable. Use links to the same representative and committee templates used elsewhere.

### Legislative progress visualization

Use a path appropriate to the jurisdiction and measure type. A bicameral bill may involve introduction, committee work,
action in each chamber, resolution of differences, executive action, and enactment. This is illustrative, not a universal
sequence. Resolutions and other measures may not become laws.

Each established stage opens the dated actions supporting it. Distinguish current recorded status from a selected
historical stage. Accommodate repeat referrals, amended text, veto and override paths, failed passage, and session
endings. Do not infer failure from inactivity or a next hearing from ordinary process expectations.

Show known scheduled events separately from a possible procedural path. Distinguish enacted from effective, including
unknown, conditional, or multiple effective dates. Provide a complete text timeline and a narrow-screen alternative.
Color alone cannot identify completed, current, unknown, or unsuccessful outcomes. No predicted passage probability.

**Design variants:** ordinary progression, repeated committee activity, veto branch, enacted with later effective date,
and incomplete history. Label any fictional example clearly as illustrative.

### Representative detail

Overview is profile-only: identity, current/historical service, office and supported staff information. Keep activity,
bills, amendments, votes and Current/Past memberships in their own sections. Header actions are Follow and Ask, not export
or duplicated metrics. See the [IA evidence hierarchy](../product/information-architecture.md#linked-evidence).

Separate actions by the person from later updates to bills they sponsor. Show office or membership applicable when an
action occurred. A vote includes its motion/question and procedural context; do not equate a procedural vote with a
final position on the bill. Missing positions are not abstentions. Explain unfamiliar terms near the relevant content.
Avoid activity-based effectiveness, ideology, or agreement scores.

### Committee detail

Overview is profile-only: identity, purpose and office. Members, activity, bills, meetings and materials have their own
sections; do not repeat them as overview counters or related-record rails. Follow and Ask remain the header actions.

Separate formal committee actions, meeting/publication updates, and changes elsewhere to referred bills. Users can open
members, bills, meetings, documents, and official evidence. Include current/historical membership and unknown dates.
Display rescheduling and cancellation prominently without hiding the original event context.

### Supporting evidence templates

| Template | Required content | Main actions |
| --- | --- | --- |
| Vote | Motion/question, voting body, date, result, totals, recorded positions | Find representative; inspect position; open bill/source |
| Meeting | Scheduling status, date/timezone, location, agenda, related bills, participants/materials | Open agenda item, record, material, or source |
| Amendment | Identity, parent bill, sponsor, status/actions, available text | Open bill/person; read text; follow |
| Supporting material | Title/type, publisher/date, related records, readable content or original | Read; open original; add context |

All templates require loading, incomplete-data, unavailable, and direct-link states. An evidence pane and standalone
page use the same content hierarchy, not separately designed identities.

## 7 Reading and comparing documents

### Document reader

Show bill/material identity, document version/date, source, and section navigation before the text. Support find-in-text,
search-result highlights, passage links, original-source access, and add-to-context. Reading a cited passage should expose
surrounding text rather than isolate a quotation from its qualifiers.

Keep cited versions fixed. If newer text exists, show a notice and an explicit action to compare or open it. Do not
silently replace the version behind an old answer. Handle unavailable text, extraction in progress, low-quality text,
and an original document available without extracted sections.

### Version comparison

Use explicit older/newer version selectors with dates and identities. Show additions, removals, unchanged context,
change navigation, and source access. Side-by-side presentation may work on wide screens; provide an inline alternative
for narrow screens. Mark additions/removals with labels or symbols as well as color. Disclose incomplete comparisons.

Document comparison describes textual change. Generated descriptions of legal or industry implications remain cited
research assessments for review. The app's legislative corpus does not imply complete coverage of current law,
regulations, court decisions, or legal deadlines.

## 8 Issues and research briefs

### Issue list and creation

**Purpose:** let an investigation persist beyond a single conversation.

Issue list entries show name, scope summary, recent activity, and follow status. Create from chat, a search, or the list.
Creation asks for a name and exposes jurisdiction/session/date scope, queries, and initial selected records. Show which
information will be saved. Following is an explicit additional decision.

### Issue detail

Use the bounded overview with direct Records, Findings, Compare and Brief subviews. Keep name/ownership and saved scope
visible; provide Resume research, scope/inclusion controls and explicit following. Do not duplicate an entire issue in chat.

Show why records matched and distinguish user inclusion from automated query matches. Excluding a record must explain
its effect on this issue and affected notifications. Query changes have an effective time and preview whether existing
matches are included. Initial historical results must not appear as newly occurring legislative actions.

Deleting an issue previews what happens to its linked follows. It never silently cancels a subscription used elsewhere.
Global email preferences do not hide the issue's underlying matched events.

### Evidence comparison and brief preview

Compare records across jurisdictions using bill identity, version/status date, relevant passage, recorded or proposed
change, known effective-date information, and coverage gaps. Separate factual text from an assessment of relevance to
the user. Do not assert company-specific compliance obligations from an industry label alone.

A brief moves through preparation, draft, evidence review and reviewed copy. Persist selection, reporting interval,
text, annotations, citations and review state together. Changed inputs/content require review again. Preserve real
source/version dates, not a routine As-of badge. Personal review is not publication, independent approval or an archive;
organization exports/sharing remain a separately gated extension.

## 9 Following and Novu notifications

### Configure a follow

The same configuration appears from chat, record pages, searches, and issues. Content order: target/query, event
categories, channels, frequency/timezone, effective-delivery summary, confirm/cancel. Use ordinary language for event
choices. Advanced detail may be expandable; the saved configuration must be unambiguous.

| Target | Categories to account for in the design |
| --- | --- |
| Bill | Status/actions, votes, amendments, new document versions |
| Representative | Own sponsorships, amendments, votes, membership/profile changes; separately, updates to associated bills |
| Committee | Membership, referrals/actions, meeting changes, agenda/material publication; separately, referred-bill updates |
| Query | New or updated matching records within the saved scope |

Some categories require additional backend work. Annotate their dependency in the design handoff; do not replace a
specific event with an unexplained generic update. Users can inspect, edit, pause, resume, and cancel existing follows.

The [notification contract](../product/notification-experience.md#preferences-and-timing) owns channel, cadence, batching,
preference and dispatch semantics. In-app/email are ordinary channels; webhooks stay secondary. Do not invent additional
schedules/channels or translate configured cadence into guaranteed source detection or receipt.

### Bell and Updates

Novu powers one consistent in-app notification experience. The bell shows unread count and recent items; opening Updates
shows the full inbox. Both use the same read/unread/archive state across devices. Looking at the bell alone does not
mark all items read; opening an item marks that item read. Also provide explicit read/unread controls.

An update shows the subject, specific change, action date, a concise source-grounded description, and why it was received.
Open the relevant record/change and expose the originating follow. Within the same delivery batch, overlapping follows
produce one event with multiple reasons. Independent delivery windows may still produce separate messages.

Archive removes an item from the active inbox without cancelling a follow. Inbox unavailable is distinct from no updates.
Canonical matched events remain accessible through Following and Issues when notification delivery is disabled.

### Email and preference designs

Include immediate-update and digest email layouts in the design package. Show record identity, change/date, reason
received, direct evidence link, and preference/unsubscribe access. Digests identify their time window and group related
changes. Do not include private conversation text, legal/client notes, or strategy in email.

Settings, Notifications exposes global channel permissions, supported category preferences, verified destination,
and timezone. A follow requesting email cannot override global email opt-out. Show the effective state in the follow
preview with a route to change preferences. Legislative urgency never makes alerts impossible to disable.

Following detail defaults to full-width Matched events, with Delivery history secondary and attempts collapsed in selected
detail. Preserve per-channel queued, accepted, delivered-where-evidenced, suppressed, failed and unknown outcomes.
Design correction/reschedule and failed/unknown delivery alongside unavailable inbox; never equate acceptance with receipt.

## 10 Account and integration screens

Account shows identity, applicable account context, and sign-out. Do not introduce team roles or invitations into the
initial personal experience. Existing authentication flows handle expiry and safe return without dedicated lifecycle screens.

Integrations has MCP and advanced webhook entries. MCP setup shows the product server URL with copy action, supported
external-client authentication instructions and help, with no in-app connection-status or verification UI. Users check
access in their own client. Authorization listing/revocation requires provider support. Never expose server credentials or
ask users to copy browser-session tokens. Connecting this app to arbitrary external MCP sources is outside scope.

Webhook management accounts for destination creation, verification, editing, secret rotation, removal, and failure
feedback. Secret handling is an advanced flow; include one-time display and clear recovery states without exposing
secrets in screenshots or shared prototype examples. Novu's operational dashboard is not an end-user page.

The [product specification](../product/product-spec.md) owns current privacy, provider and billing boundaries.

## 11 Components and required state coverage

Create reusable variants rather than one-off mockups for every result or message.

| Component family | Variants and behaviors to document |
| --- | --- |
| App shell | Navigation expanded/collapsed, evidence open/closed, mobile navigation, bell |
| Composer and context | Empty/draft/submitting/stopped, multiline, scope picker, removable context, ambiguity selection |
| Answer and citation | Streaming/complete/incomplete/error, evidence link, unavailable citation |
| Result and identity | Bill/person/committee, selected/opened/followed, long title, historical identity |
| Activity | Action/vote/document/meeting, source/date, correction, unknown attribution |
| Progress | Completed/current/unknown/alternative outcome, selected stage, text equivalent |
| Reader and diff | Version selector, section navigation, highlighted passage, additions/removals, missing text |
| Issue controls | Scope revision, included/excluded record, relevance reason, follow preview |
| Notifications | Read/unread/archived, multiple matching reasons, paused, suppressed, failed, unavailable |
| Forms | Default/focus/disabled/invalid/saving/success, destructive confirmation, unknown save result |
| Collection parts | Toolbar, applied scope, group heading, pagination, selection, retrieval limit, preview footer, period picker, date control |

### Shared collection parts

Every collection described in the [IA](../product/information-architecture.md#supporting-discovery) is assembled from one set of
canvas components rather than a toolbar redrawn per screen. They exist on the `Collections — Shared parts` board and
must be instanced, not copied by hand, so a change to paging or scope language reaches every surface at once.

| Part | Canvas id | Contract it carries |
| --- | --- | --- |
| Collection — Toolbar | `yBfzT` | Collection search, principal scope picker, Filters with an applied count, Sort |
| Collection — Applied scope | `ky1Gk` | The scope in force stays readable, with Reset to the collection's stated defaults |
| Collection — Group heading | `pLJPC` | One grouping level, never an accordion; repeats marked continued when a group spans pages |
| Collection — Pagination | `pyj8X` | Twenty a page, Previous and Next, exact totals only when returned for the whole filtered set |
| Collection — Selection bar | `nhoEp` | Selection by record across pages, page-scoped header checkbox, count and Clear |
| Collection — Retrieval limit | `eSkBu` | A ranked-search window stated as a window, with a route to refine |
| Collection — Preview footer | `QGPwm` | At most five records and a View all that carries the same scope through |
| Collection — Period picker | `u6hXE` | Sessions grouped by jurisdiction with published dates and classification |
| Collection — Date control | `We77V` | The filtered field is named, and undated records are listed rather than counted as matches |

Scope, sort, grouping and paging stay four separate ideas. Scope decides which records qualify, sort orders the whole
matching set, grouping only adds headings to that order, and paging bounds what is drawn. A heading is never allowed to
imply that a page holds a complete month or session, and a preview limit is never presented as a total.

Do not narrate these rules on screen. A note explaining that search covers the whole collection rather than the current
page, that a repeated heading means the month continues, that a cancelled meeting stays on the list, or that closing a
drawer discards edits is design rationale, not product copy. The control, the marker and the row already carry it. Write
a line only when it tells the user something the interface cannot show: that a date was never published, that an unknown
position is not a No, that a message was accepted rather than received, or what a scope change will do before they
confirm it. Keep needed qualifiers and consequences concise; do not impose a sentence quota on correctness.

Every major surface needs populated, loading, empty, partial-data, and recoverable-error designs. Include examples with
long titles, dense histories, many versions, missing vote positions, no known next event, and failed document extraction.
Do not use zero or none to represent unknown coverage. Identify restricted access without leaking private record details.

## 12 Visual accessibility and content requirements

Target WCAG 2.2 AA. Document keyboard order, visible focus, accessible names, modal focus return, and screen-reader
announcements. Streaming should not announce every token. Use restrained motion and respect reduced-motion settings.
Validate text contrast and status differentiation; never rely on color alone for votes, progress, or document changes.

Start design review at 1440-pixel desktop and 390-pixel mobile widths. Include a medium-width layout and demonstrate
reflow at 320 pixels and enlarged text. These are review sizes, not mandated production breakpoints. Long tables need
an intentional narrow-screen presentation rather than shrinking all content.

Use plain, neutral language. Preserve official terminology where necessary and explain it in context. Put source and
coverage qualifications next to the affected claim. Avoid unsupported promises such as real-time nationwide coverage,
exhaustive legal research, or guaranteed delivery. Do not use dot glyphs as visual separators.

Review new/changed customer-facing copy with Fluent Agent MCP when available and record the guidance applied. Historical
unavailability is not a current tool status; the conversation handoff records its own review. Annotate copy questions
separately from interaction questions.

## 13 Prototype scenarios and representative content

Use one coherent illustrative dataset across the prototype. Include a personal housing issue, two jurisdiction-specific
bills, two versions of one bill, a representative with a procedural vote, a committee, a rescheduled meeting, and a
follow matching the same event through two routes. Add one missing-text record and one unknown effective date.
Label fictional records as illustrative; do not invent official source links or mix fabricated events into real profiles.

| Prototype flow | Evidence that the design succeeds |
| --- | --- |
| Ask about housing, refine states, open bill, inspect progress, read passage, follow | Scope persists; stages and claims open evidence; saved follow matches the preview |
| Find representative manually, inspect vote, open bill, follow selected actions | Correct officeholder and vote question are understood; associated-bill alerts are separate |
| Open committee, inspect changed meeting, open agenda/bill, configure immediate follow | Published scheduling and detection limits are clear; no invented deadline |
| Resume issue, exclude a match, compare jurisdictions, prepare brief | Durable scope is editable; relevance reasons and source limitations survive copying |
| Open an older cited version, see newer-text notice, compare versions | Original citation stays fixed; user chooses the new version deliberately |
| Open bell, read update, inspect evidence, pause follow, check settings | Inbox state stays consistent; archiving and pausing are distinct; email opt-out is respected |
| Open external record link with expired session, sign in, continue | Destination returns; pending mutations are not replayed |
| Open MCP setup | Correct address and authentication instructions; verification occurs in the external client, without an in-app status claim |

Run the primary research flow and notification management on both desktop and mobile. Prototype at least one missing-data
and one failed-action recovery path rather than only successful responses.

## 14 Deliverables and review sequence

1. **Structure review:** sitemap, page inventory, low-fidelity workspace/evidence layouts, and the main research flow.
2. **Visual direction review:** a styled home, active conversation with bill evidence, and mobile counterpart; typography,
   spacing, palette, and component direction with rationale.
3. **Complete preliminary design:** all screen families in this brief, linked prototypes, component variants, immediate
   and digest email designs, accessibility notes, and required incomplete/error states.
4. **Handoff review:** design-to-requirement coverage, content decisions, responsive behavior, asset specifications, and
   an explicit list of unsupported or newly proposed capabilities.

Use descriptive frame names such as Conversation with bill evidence, Committee with rescheduled meeting, and Follow
with email disabled. Organize the design file into Foundations, Workspace, Evidence, Issues, Notifications, Settings,
and Prototype flows. Link components to their usages. If using Figma, use reusable components, variants, and auto layout.
Equivalent structure is acceptable in another design tool.

For each screen annotate entry point, primary action, content hierarchy, navigation result, loading/error behavior,
keyboard/focus behavior, and any data dependency. Do not mark an unimplemented interaction as production-ready.

### Acceptance checklist

- Chat is clearly the home experience and can open usable structured evidence.
- Bills, representatives, committees, issues, and following are understandable without reading this brief.
- Source links preserve exact evidence and document versions.
- Users can distinguish recorded fact, assessment, unknown coverage, and personal annotation.
- Progress and votes communicate their actual meaning without misleading shortcuts.
- Subscription previews show effective delivery settings and support direct management.
- Bell, Updates, email, and follow history form a coherent notification experience.
- Desktop, mobile, keyboard, enlarged-text, and required recovery states are accounted for.
- Primary ICP reporting/question journeys and supporting evidence scenarios have connected prototype paths.

The persona critique was simulated, not a user study. Recruit qualified target researchers under the
[ICP validation plan](../product/icp.md#7-validation-and-decision-rules), adding specialist perspectives where they expose
distinct interpretation risks. Observe whether they identify scope, interpret evidence, configure intended
notifications, and recover from missing data without coaching. Resolve critical misunderstandings and repeat affected
flows. Engineering browser acceptance follows implementation and is separate from design review.

## 15 Scope boundaries and open decisions

Design all core surfaces above. Implementation sequencing may differ from the design sequence.

Engineering must still settle conversation retention/deletion, issue persistence and query revisions, expanded activity
events, jurisdiction-specific progress mapping, Novu status reconciliation, recipient isolation, and authenticated
end-to-end data readiness. These dependencies should be annotated, not hidden by optimistic sample data.

Keep team/client workspaces, organization-wide distribution, campaign/contact tools, automated external messaging,
arbitrary external MCP sources, general web research, court/regulatory feeds, deadline calculations, and
company-specific compliance determinations outside the initial personal design. Billing and address lookup may be
explored in mockups under the [design handoff](#design-handoff); their implementation and provider activation remain
separately gated. Organization extensions are specified in [organization features](../product/organization-features.md).
Public conversation sharing, file export formats, weekly digests, quiet hours, and additional channels require decisions.

The designer should bring back proposals for visual direction, responsive panel behavior, dense comparison layouts,
progress-branch presentation, and simplified follow setup. Any proposal affecting scope or notification semantics must
be called out explicitly for product review.

## 16 Supporting specifications

The [product specification](../product/product-spec.md) maps this brief to product boundaries and acceptance. Linear
owns implementation tracking.

This is the canonical design brief; it supersedes the preliminary experience requirements and simulated persona critique. Use the following focused contracts for additional detail:

- [Product specification](../product/product-spec.md)
- [Information architecture](../product/information-architecture.md)
- [Notification experience and Novu integration](../product/notification-experience.md)

Maintain this brief when approved product decisions change. The supporting specifications retain the detailed API,
data, and notification contracts; resolve contradictions before implementation rather than designing around assumptions.

<a id="design-handoff"></a>

<a id="design-handoff--design-handoff-and-remaining-review-work"></a>

## Design handoff and remaining review work

Consolidated September 14, 2026 from the completed overhaul and two superseded design reviews. The current design
artifact is [legislation.pen](../../legislation.pen); the screen requirements above define the intended
experience. This section preserves useful constraints and unresolved review work without repeating old frame counts,
completed work orders or superseded token replacements. It does not certify the current design or shipped UI.

<a id="design-handoff--design-authority-and-scope"></a>

### Design authority and scope

- Use the [product specification](../product/product-spec.md), [information architecture](../product/information-architecture.md),
  and the screen requirements above for product behavior. Track implementation acceptance in Linear; completing
  mockups does not complete product work.
- Billing and address lookup are allowed in design exploration. Their payment, entitlement, geography/provider and
  release requirements remain deferred. The removed representative-lookup API is not an available implementation.
- Mobile push has no approved delivery contract. Current personal notification scope is in-app/email; organization
  digests, Slack and Teams belong to the separate [organization proposal](../product/organization-features.md).
- The source file still imports the shadcn library. Preserve that import and the deliberate Rostra/shadcn mapping.
  The original review's recommendation to remove it is superseded.

<a id="design-handoff--durable-design-constraints"></a>

### Durable design constraints

- Keep product canvas content at `x >= 20000` while the imported library boards occupy the left-hand region. Do not
  move product frames into that region without first checking imported-board bounds.
- Use the existing theme/brand board as the single token reference. Map shadcn semantic colors to Rostra brand tokens;
  `accent` means the subtle interaction background, not the brand green. Preserve the distinction between brand and evidence.
- The later review adopted the standard Tailwind/shadcn type and radius scales: 12px is the smallest listed type size;
  do not reintroduce the earlier 11px token or retired brand/signal aliases from the old work order.
- Use tokenized color, typography and spacing. The five 118px search-label alignment offsets are now the named
  `label-column` token at the same value; they remain an alignment constant, not a spacing step, and not a general
  license to hardcode layout values.
- After token changes, resolve foreground/background values and check contrast; a valid token reference can still
  produce invisible text. Historical counts from a token-renaming incident are not a current audit.
- Legislative progress is a sequence of recorded states, not a completion percentage. Unknown, missing and unavailable
  evidence must remain distinguishable from zero or confirmed absence. Never rely on color alone for status.
- Panel and standalone-page presentations share the same evidence hierarchy. Preserve exact citations/versions,
  readable long-form text, direct official source links and record-specific limitations. The removed Coverage and sources
  destination must not be recreated. Vote and meeting direct links use their shared drawer/sheet content under the
  [IA return contract](../product/information-architecture.md#evidence-entry-and-return), not duplicate page templates.
- The later review deliberately retained `Shell — App Sidebar` and `Shell — Nav Item, Active Count`. Zero instances
  alone are not deletion authority; the earlier instruction to delete the sidebar is superseded.
- Disabled optional slots and intentional absolute overlays need visual review before treating them as clipping defects.
  Preserve meaningful layout fallbacks for disabled slots.
- `Notification Row` and `Notification Row — Mobile` are distinct components. When adopting components, remove the
  replaced hand-drawn elements and check for duplicated children, overflow and hidden coverage notes.

<a id="design-handoff--remaining-review-queue"></a>

### Remaining review queue

These findings were open in the latest retained review. They require a fresh design inspection; no current counts or
automatic Done states are inferred from the historical reports.

| Review work | Scope | Existing backlog ownership |
| --- | --- | --- |
| Component adoption | Tabs, form controls, activity/notification rows, legislative stages, coverage notes and shadcn primitives | Foundation and design; affected page workstreams |
| State completeness | Amendment, meeting, vote, supporting material, coverage, search, conversations, billing and address mockups | Foundation and design; legislative pages |
| Responsive behavior | Narrow layouts for evidence/search/coverage and exploratory billing/address screens; 320px reflow and enlarged text | Foundation and design; release acceptance |
| Keyboard/focus behavior | Real screen focus states, modal focus return, keyboard navigation; more than a showcase example | Foundation and design; release acceptance |
| Navigation reconciliation | Reachable search, meetings, settings and direct evidence links; shared drawer/page return behavior and direct source access per the evidence-navigation handoff | Foundation and design; legislative pages |
| Research components | Consistent answer block, evidence container, reader and comparison typography | Conversation and research; legislative pages |
| Copy and usability | Fluent guidance, target-ICP prototype evaluation and resolution of critical misunderstandings | Integrations and release |

The previous design reviews were scenario and artifact audits, not evidence of interviews or production usability.
Use the acceptance flows in the designer brief and verify implemented UX in the integrated browser before release.

<a id="design-handoff--canvas-tooling-notes"></a>

### Canvas tooling notes

Access the encrypted design only through Pencil tools and read their current schema/reference. Inspect the meaningful
parent and rendered output before diagnosing a blank screenshot or bounds issue; historical refresh/+50px artifacts
are not universal geometry rules. Some subtrees have resisted broad traversal, so zero matches do not prove zero usage.
Exclude disabled ancestors from visible-clipping conclusions and never rebuild/delete solely from one tool result.
