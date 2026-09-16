# Information architecture

## Design boundary

Updated September 15, 2026 around the [product specification](product-spec.md) and [ICP priorities](icp.md): a policy
researcher answers a question, maintains an issue, and prepares a recurring member/client update. The
[design handoff](../design/design.md) owns detailed visual/interaction requirements; this page owns hierarchy, object
boundaries and navigation. It does not add an interface for every possible buyer or API object.

Browser routes below remain proposals, not implemented routes or changes to the [HTTP API](../engineering/api/README.md).
Canonical IDs are encoded safely as one path segment; names are labels, not identity. A stable URL can open a shared
drawer, reader or issue subview without creating a separate page design.

Current canvas alignment was checked read-only against issue overview `ifkHQ`, brief preparation `PMdsp`, reviewed brief
`AGG8U`, follow detail `ROZoK` and meeting direct entry `fNvTx` in the [design source](../../legislation.pen).
These establish design intent, not executable prototype links, data readiness or browser acceptance.

## Navigation priorities

| Layer | Destinations | Why it belongs here |
| --- | --- | --- |
| Primary work | New conversation, Conversations, Updates, Issues, Following | Ask, resume research, assess changes, maintain findings and control monitoring |
| Supporting discovery | Global Search; Bills, Representatives, Committees and Meetings in Explore | Reach/refine evidence directly without another prompt or mandatory issue |
| Linked evidence | Bill/person/body profiles, vote/meeting details, text/amendments/materials and comparison | Answer the current research question; no new primary navigation for each record type |
| Setup | Account, privacy, optional Address, notification preferences and Integrations | Available when needed, not prerequisites for professional research |
| Conditional shared work | Organization/workspace context, authorized management and issue-level review | Add only with the shared product's access/lifecycle acceptance; absent from personal-only use |

Conversation is home, not the only way to work. Issues are the repeat-work destination, not an optional persona feature.
Keep the existing primary navigation order; simplify hierarchy and defaults rather than moving familiar destinations.
There is no separate dashboard, AI assistant, Research, Reports, Tasks, Clients, or Coverage and sources destination.
Global search and directory filters reuse the same discovery model rather than introducing parallel search systems.

## Sitemap and persistent navigation

```text
Application
  New conversation (home)
  Conversations
    Conversation and explicit research context
  Updates
    Notification bell (same inbox state)
  Issues
    Issue overview and saved scope
      Records (included, query matches, excluded)
      Findings and annotations
      Compare selected evidence
      Brief (prepare, review, copy)
  Following
    Follow configuration and Matched events (default)
      Delivery history
        Selected delivery and optional Attempts
  Explore
    Bills
    Representatives
    Committees
    Meetings
  Global Search (header entry, same /search destination)
  Settings
    Account
    Address
    Data and privacy
    Notifications
    Integrations
      External MCP setup
      Webhook destinations

When shared work is available and authorized
  Organization selector (sidebar top; includes Personal)
  Workspace selector (sidebar bottom, below Settings)
  Organization/workspace management (Settings)
  Assignment, review and report sharing (inside the issue)
```

Home presents a composer and scope, with recent work available; it does not automatically resume another investigation.
No mandatory persona, organization, address or integration setup. A useful one-off answer need not become an issue.
From an existing issue, Resume research carries explicit selected context; Records, Findings, Compare and Brief remain
within that issue, not top-level applications. Do not make the user revisit chat just to copy a reviewed brief.

The [conversation integration design](../design/conversations.md) owns access from every surface. One header command
opens the active authorized conversation or an empty draft without attaching the current page. Contextual Ask/Add to
context use the same surface and explicitly stage references without sending. The same contract owns turn content,
reference tagging, citations, progress and confirmed write-back; no floating assistant or per-record conversation store.

## Objects and boundaries

| Object | Owns | Must not imply |
| --- | --- | --- |
| Conversation | Questions, messages, scope/context, evidence references and action receipts | Opening evidence saves it to an issue; deleting chat deletes separate research/follows |
| Issue | Owner, explicit scope/revisions, included/excluded records, queries, selected findings and follow references | A folder alone, automatic subscriptions, or relevance/approval for every query match |
| Finding | Selected source/version/passage, interpretation, annotation and review state | An official fact merely because a user or model wrote it |
| Personal brief | Selected findings, output/reporting scope, text, citations and revision-bound review | Independent approval, automatic publication, client sharing or a permanent report archive |
| Follow | A record or normalized query, selected events, delivery preferences and matched history | Inclusion in an issue, guaranteed receipt, or user review of evidence |
| Update | A matched change, subscription reasons, read/archive state and delivery references | A second issue inbox to manage, or stopped following when archived |
| Canonical record | Source-backed identity, evidence and relationships | Personal notes, client ownership, or source truth changing with workspace selection |
| Customer organization/workspace | Shared ownership and an authorized client/initiative audience | A civic committee, nested client CRM, or access granted by a label/tag |
| Shared report revision | Identified output snapshot, approval and recipient grants when delivered | A personal reviewed brief automatically gaining the same controls |

Creating or editing an issue is not following it. Exclusion must expose its effect on associated query/record follows;
issue deletion previews which independently owned or shared rules remain and which can be cancelled. Keep the mutation
receipt available outside a deleted issue. Do not reduce clicks by silently changing subscriptions or sharing evidence.

## Surface and route inventory

### Primary work

| Surface | Proposed browser route | Content hierarchy | Main actions |
| --- | --- | --- | --- |
| Home | `/` | Composer, editable scope, recent work | Ask; select scope; explicitly resume |
| Conversations | `/conversations` | History for the authorized personal/workspace context | Open; rename; delete |
| Conversation | `/conversations/{conversationId}` | Title/context, cited answers/results, composer and optional evidence | Ask; refine; inspect; add context; stop; recover |
| Updates | `/updates` | Legislative changes, unread/archive state, filters and matching reasons | Open evidence; mark read/archive; manage follow |
| Issues | `/issues` | Issue names, scope and relevant developments | Create; open; rename; delete with consequence preview |
| Issue | `/issues/{issueId}` | Bounded overview and scope; Records, Findings, Compare and Brief subviews | Include/exclude; edit scope; save findings; resume research; configure follows |
| Brief | Within `/issues/{issueId}` | Selection and reporting scope -> generated draft -> evidence review -> reviewed copy | Inspect citations; annotate; edit/regenerate; review; copy |
| Following | `/following` | Targets/queries, events, effective channels, cadence and state | Open; edit; pause/resume; stop |
| Follow detail | `/following/{subscriptionId}` | Compact configuration; Matched events default; Delivery history secondary | Open change; edit rule; inspect selected delivery; check original operation |

Brief selection, text, annotations, citations and review belong to the same saved draft. Changing reviewed inputs/content
requires review again; opening a source or adding a finding is not review. Retain reporting interval and source/version
dates, not a routine As-of badge. Do not invent a separate `/reports` route or public brief link for personal work.

Updates and the bell use one read/unread/archive state across devices. An issue's recent changes are contextual research
links, not a separately managed notification inbox. Follow detail retains application-owned matching/delivery evidence
when Novu is unavailable. Show batch/channel outcome first; expand attempts only for troubleshooting. Do not flatten
unknown into delayed, accepted into delivered, or a failed history read into a claim that follows are running.

### Supporting discovery

| Surface | Proposed browser route | Scope and actions |
| --- | --- | --- |
| Search | `/search` | Query, entity type and relevant filters; refine, inspect, add selected evidence, copy supported search link or follow query |
| Bills | `/bills` | Jurisdiction and Congress/published session; supported status/sponsor/date filters; browse, inspect and follow |
| Representatives | `/representatives` | Name, jurisdiction, office/chamber and service period; manual discovery without an address |
| Committees | `/committees` | Jurisdiction, chamber and classification; inspect members, activity and meetings |
| Meetings | `/meetings` | Today/upcoming, past or undated; body/date/status filters; open shared meeting detail |

Scope, sort, grouping and paging remain distinct. Filter/order the whole supported result set before paging; do not
create year/month folders for bill identity or filter only the loaded page. Bill scope uses Congress/published session;
activity groups by its event date, materials by publication date, and service/membership by tenure. Preserve undated items
without treating them as date matches. Date filters name the actual field; reporting interval is separate from issue scope.

Use bounded rendering, current 20-record collection pages and at-most-five type previews. View all preserves scope;
it does not promise access beyond a ranked retrieval window. Show truthful totals/limits, preserve filters/page/selection
on return, and bind selection to record IDs. No all-matches bulk operation without a server-defined result-set contract.
Keep this scale behavior inside the existing collections rather than adding navigation or summary dashboards.

### Linked evidence

| Surface | Proposed browser route | Shared content and navigation |
| --- | --- | --- |
| Bill | `/bills/{billId}` | Identity/status, recorded progress, activity, sponsors/body relationships, amendments, votes and versions; ask, follow, read, compare or add selected evidence |
| Representative | `/people/{personId}` | Profile/service, office and supported staff information; separate activity, bills, votes, amendments and current/past memberships; Follow and Ask |
| Committee/civic organization | `/organizations/{organizationId}` | Profile/purpose/office; members, activity, bills, meetings and materials in their own sections; Follow and Ask |
| Meeting | `/meetings/{meetingId}` | Shared drawer/sheet, including direct entry; status, schedule/timezone/conditions, agenda, related records and materials |
| Vote | `/votes/{voteId}` | Shared drawer/sheet, including direct entry; motion, body/date, outcome/totals and individual positions with source links |
| Amendment | `/amendments/{amendmentId}` | Identity/status, parent bill, sponsor, actions and text; affected-section references beside the text with any mapping qualifier |
| Document | `/documents/{documentId}` | Version identity, section navigation, original source and reading context; find, select version, cite or compare |
| Section | `/documents/{documentId}/sections/{sectionId}` | Same reader focused on the identified section; exact-range links only under their approved locator contract |
| Comparison | `/compare?from={documentId}&to={documentId}` | Explicit version pair and differences with context; inspect originals without losing the selected pair |
| Supporting material | `/supporting-materials/{materialId}` | Shared reader with publisher/type/version/date and related records; read, open source, explicitly download or add context |

Representative and committee directory labels map to canonical people and civic organizations, not duplicate identities.
Person/body overviews are profiles, not aggregate dashboards repeating their detail tabs. A person and a dated service
tenure are distinct; observed membership does not establish a start date. A vote position is not a motion's outcome.
Preserve source terminology and real relationships without decorative metrics, speculative relationships or extra Open buttons.

### Settings and conditional administration

| Surface | Proposed browser route/placement | Boundary |
| --- | --- | --- |
| Account | `/settings/account` | Identity, supported account/session actions and sign-out; no provider capability inferred from a mockup |
| Address | `/settings/address` | Optional single owner for address resolution/retention; return to Your representatives; never the working-jurisdiction filter |
| Data and privacy | `/settings/privacy` | Actual data categories and owning controls; export/deletion only under approved rights/lifecycle contracts |
| Notifications | `/settings/notifications` | Effective in-app/email preferences, verified destinations, cadence/timezone defaults and actionable suppression |
| Integrations | `/settings/integrations` | External MCP and webhook entries; not required by the web assistant |
| MCP | `/settings/integrations/mcp` | Actual environment URL, authentication method and setup; verify in the external client, with no in-app connection status |
| Webhooks | `/settings/integrations/webhooks` | Authorized destinations, verification, rotation/removal and selected delivery diagnostics; not a generic automation builder |
| Organization/workspace settings | Within Settings when authorized; route contracts remain to be defined | Members/access, workspace lifecycle and approved report/integration/billing controls; no extra primary admin application |
| Billing | Owning account/organization settings, only when commercial contracts are approved | Provider-backed terms and entitlements; no invented cancellation consequences, seats or unlimited promises |
| Sign-in | Authentication-provider route, to be confirmed | Authorize and restore intended destination; do not replay pending mutations |

The [organization behavior](organization-features.md) and [management design](../design/organization-workspace-design.md)
own shared work. Show the organization selector at the sidebar top for active membership; show the workspace selector
below Settings only in organization context. Personal has no workspace selector or mandatory organization setup.

Within shared Issues, Assigned to me, Needs my review and All my workspaces are authorized views, not new destinations
or access grants. Keep client/initiative boundaries at the workspace and review/export/sharing at the issue's Brief.
Do not add nested workspaces, a client database, global task suite or standalone report hub.

Direct links authorize the resource before aligning the visible organization/workspace. Switching cannot copy, move or
retarget drafts, mutations or late responses. Preserve their original context; show the shared audience before composing.
Membership never exposes personal conversations. Reusing public evidence across clients does not copy private annotations,
approval or recipient grants without an explicit selection and destination review.

## Evidence entry and return

| Situation | Presentation | Return and state rule |
| --- | --- | --- |
| Open evidence during research | Beside the conversation/issue when space permits; full-width on narrow screens | Opening is inspection, not Add to context; retain owning draft, scope, filters, selected versions and focus |
| Open a vote or meeting | Reuse its drawer/sheet for contextual and direct entry | Close restores origin; parentless meeting exits to Meetings, vote uses a source-supported parent or Search, not a new Votes directory |
| Open a document/material or comparison | Read/compare immediately using the shared template | No mandatory metadata-only stop; return to the precise origin, including its overlay and list state |
| Open a copied/deep citation | Resolve exact identity/version/section and authorized range | Do not replace old evidence with latest text; offer newer evidence separately; missing extraction differs from missing source |
| Back, Close or session recovery | Reverse the current navigation step; Escape closes the topmost transient surface | Do not accumulate duplicate page/drawer history, clear drafts, lose review selection or replay a save |

Use one main content surface on mobile and avoid stacked drawers. Collapse navigation/evidence when columns become too
narrow. Restore keyboard focus and an explicit safe exit even for parentless entry. Ignore late responses for a different
record/context. Copy record/passage links without private research context; search links may contain query/filter terms
and must make that disclosure understandable. Permission denial must not reveal another workspace's content.

## Connected acceptance flows

| Priority and ICP | End-to-end path | Acceptance emphasis |
| --- | --- | --- |
| Core: association update | Open/create issue -> scope and Records -> include/exclude -> Findings -> compare exact text -> prepare/review/copy Brief -> reopen next week | Recurring output without rebuilding research; qualifiers/citations and review survive navigation |
| Core: consultant question | New conversation/Search -> scope/disambiguate -> inspect bill/person/vote evidence -> cited answer -> optionally save findings to issue | No forced issue, address, workspace or integration setup; actor and version meaning stays correct |
| Core: monitor and respond | Updates or issue change -> source comparison -> revise findings -> originating Follow -> edit/pause/stop or selected delivery recovery | Legislative change before diagnostics; no implied cancellation from archive or duplicate save after unknown outcome |
| Supporting: committee evidence | Committee Meetings -> shared meeting detail -> agenda bill/material reader -> return | Schedule conditions, source-only/missing states, paging and focus preserved; no calendar/media promise |
| Conditional: team review | Authorized workspace -> assigned issue -> identified report revision -> review -> permitted recipient sharing | Personal/client separation, changed-output approval invalidation and revocation/offboarding acceptance |
| Secondary: external AI | Settings -> Integrations -> MCP instructions -> external client authorization | Optional entry; correct setup without an in-app verification or connection-status screen |

Exercise core/supporting flows at desktop/mobile sizes, with keyboard access, large collections, partial sources and
failed/unknown operations. Shared and integration flows are required when offered, not prerequisites for a personal
research pilot. The [product specification](product-spec.md#acceptance-and-success-measures) owns release and outcome criteria.

## Dependencies and value gate

| Boundary | Required contract/acceptance, not inferred from design |
| --- | --- |
| Research and discovery | Prospect's source scope, search/paging limits, canonical identities, document/range locators and evaluated comparisons |
| Conversation and actions | Ownership/history, context/streaming/cancellation, structured responses, authorized tool allowlist, confirmation and idempotent unknown-outcome recovery |
| Issues and briefs | Scope revisions, inclusion/exclusion/follow effects, pinned findings, saved draft/review revisions, concurrency and deletion receipts |
| Progress and monitoring | Jurisdiction/measure stage mappings, target/event production, associated-bill semantics, pause/backfill policy and verified channels |
| Novu and preferences | Authorized subscriber mapping, one inbox, deduplication, preference writes, delivery receipts and outage recovery; see [notification experience](notification-experience.md) |
| Shared ownership and output | Workspace authorization, assignments/approval, export/sharing rights, recipient lifecycle, offboarding and approved commercial terms |
| Account/integrations | Address retention, provider capabilities, authentication/revocation, webhook secrets and data lifecycle; no placeholder functioning controls |

Do not add navigation to solve an unresolved contract. First ask whether an existing issue subview, evidence template or
settings detail completes the target ICP's job. New complexity needs the [product value gate](product-spec.md#scope-and-complexity-budget),
an owner and observable acceptance. This IA does not authorize implementation, new data rights or a broader compliance product.
