# Information architecture

## Design boundary

Initial architecture for the conversational web application, recorded September 14, 2026. Read with the
[design brief](design.md). Browser routes below are proposals for design and engineering
alignment, not implemented routes or changes to the canonical [HTTP API](../engineering/api/README.md).
Canonical IDs are encoded safely as one path segment; display names are labels rather than record identity.

## Sitemap and persistent navigation

```text
Application
  New conversation (home)
  Conversations
    Saved conversation
      Contextual search results and evidence
  Updates
    Notification bell (same inbox)
  Issues
    Personal issue tracker
      Scope and included records
      Matched updates and evidence comparison
      Brief preview
  Following
    Subscription detail and delivery history
  Explore
    Search
    Bills
    Representatives
    Committees
  Settings
    Account
    Notifications
    Integrations
      MCP connection setup
      Webhook destinations

Linked evidence views
  Bill
  Representative
  Committee / other organization
  Meeting
  Vote
  Amendment
  Document and section
  Document comparison
  Supporting material
```

Persistent navigation prioritizes New conversation, recent conversations, Updates, and Following. Explore provides
direct search and directories in a secondary group; Settings stays accessible from the account area. There is no
separate Research destination competing with the conversational home. The initial empty home presents the composer
and suggested task types; opening the app does not automatically resume a different investigation.

The [persona review](design.md#13-prototype-scenarios-and-representative-content) adds Issues as a persistent destination after Updates. It stores ongoing
research scope across conversations. The bell is a compact Novu inbox opening the same Updates destination, not a
second activity feed. Following manages notification rules; Issues organizes the research those rules support.

## Workspace and navigation behavior

On wide screens, use navigation, a conversation region, and an optional evidence region. Opening a citation or result
shows the corresponding record alongside the conversation. Expand-to-page opens the same record template at its
stable URL. On narrow screens, evidence becomes a full-width view with an explicit return to the conversation.
Panel versus page changes presentation, not record identity or available evidence.

Direct record links work without an originating conversation. An ask-about-record action starts or explicitly adds
the record to a conversation. Returning to a conversation restores draft, context, selected evidence, filters, and
scroll position. Browser Back reverses navigation rather than clearing research. Sign-in preserves the intended
destination. Copy-link on a record returns its standalone URL without private conversation context.

## Page inventory

| Surface | Proposed browser route | Content hierarchy | Main actions |
| --- | --- | --- | --- |
| Home | `/` | Composer, scope, suggested tasks, recent work | Ask; select scope; resume |
| Conversation list | `/conversations` | Private history ordered by recent activity | Open; rename; delete |
| Conversation | `/conversations/{conversationId}` | Title, context, messages and interactive results, composer, evidence region | Ask; refine; inspect citation; stop; retry; add context |
| Updates | `/updates` | Matched changes, unread state, filters, subscription reasons | Open; mark read; manage follow |
| Issues | `/issues` | Personal trackers, scope summaries, recent changes | Create; open; rename; delete with subscription disposition preview |
| Issue tracker | `/issues/{issueId}` | Scope, included/excluded records, matched updates, evidence comparison, following state | Refine; include/exclude; research; configure follows; preview brief |
| Issue brief | In-context preview within `/issues/{issueId}` | Reviewed findings, citations, as-of time, annotations and gaps | Inspect evidence; edit selection; copy reviewed text |
| Following | `/following` | Targets and queries, events, channels, frequency, status | Open; edit; pause; resume; cancel |
| Subscription | `/following/{subscriptionId}` | Configuration, matching events, delivery history | Edit; inspect failure; pause; cancel |
| Search | `/search` | Query, entity type, filters, results, coverage | Refine; open; copy link; follow query |
| Bills | `/bills` | Jurisdiction/session filters, status, sponsor/date filters, results | Browse; open; follow |
| Representatives | `/representatives` | Name, jurisdiction, office/chamber, service-period filters | Browse; open; follow |
| Committees | `/committees` | Name, jurisdiction, chamber, classification filters | Browse; open; follow |
| Bill | `/bills/{billId}` | Identity and latest action, progress, activity, sponsors, amendments, votes, documents | Inspect stage; follow; read; compare |
| Representative | `/people/{personId}` | Identity and service, activity, bills, votes, amendments, memberships | Filter activity; open relationship; follow |
| Committee or organization | `/organizations/{organizationId}` | Identity and purpose, membership, activity, bills, meetings, materials | Open member or meeting; follow |
| Meeting | `/meetings/{meetingId}` | Status/date/timezone/location, agenda, related records, participants, materials | Open agenda evidence or related record |
| Vote | `/votes/{voteId}` | Question, result, voting body/date, totals, individual positions | Find position; open person or bill; open source |
| Amendment | `/amendments/{amendmentId}` | Identity, status, sponsor, parent bill, actions, text | Open bill, sponsor, or text; follow |
| Document | `/documents/{documentId}` | Version identity, section navigation, text, source | Find; select version; copy passage link; compare |
| Document section | `/documents/{documentId}/sections/{sectionId}` | Same reader focused on an identified section | Read context; copy link; add to conversation |
| Comparison | `/compare?from={documentId}&to={documentId}` | Explicit version pair, differences, surrounding text | Select pair; navigate changes; open original |
| Supporting material | `/supporting-materials/{materialId}` | Identity, provenance, related records, available sections | Read; open source; add context |
| Account | `/settings/account` | Identity and applicable account context | Manage supported account options; sign out |
| Notifications | `/settings/notifications` | Timezone, defaults, supported destinations | Edit defaults; manage destinations |
| Integrations | `/settings/integrations` | External AI connection and webhook entries | Open setup or destination management |
| MCP setup | `/settings/integrations/mcp` | Server URL, supported authentication, capabilities, help | Copy URL; inspect/revoke supported authorizations |
| Webhooks | `/settings/integrations/webhooks` | Destinations, verification and delivery information | Add; verify; edit; rotate secret; remove |
| Sign-in | Authentication-provider route, to be confirmed | Authentication and destination recovery | Sign in; return to work |

Representatives map to canonical people; committees map to canonical organizations. Do not introduce duplicate identity
routes for committees or representatives. Directory labels may be narrower than the underlying record type.
Search URLs preserve supported query/filter state; private or sensitive context remains in authenticated storage.
Copied search links may disclose the search terms, which the copy action must make understandable.

Notifications settings must show effective Novu channel preferences, verified email destination, and suppression reasons.
The bell and Updates share read/unread/archive state across devices. Archive does not cancel following or remove the
underlying legislative event. Follow detail retains delivery status even if the Novu inbox is temporarily unavailable.
Issue deletion previews whether referenced subscriptions will remain or be cancelled; it never silently changes a
subscription referenced elsewhere. Representative discovery offers manual selection without address collection.

## Content relationships

| Object | Relationships users can traverse |
| --- | --- |
| Bill | Jurisdiction/session, sponsors, committees, actions, amendments, votes, document versions, related bills |
| Person | Offices and service periods, committee memberships, sponsorships, amendments, recorded vote positions |
| Organization | Jurisdiction, membership tenures, referred bills, meetings, recorded actions and materials |
| Meeting | Organizing body, agenda items, linked bills, participants and documents |
| Vote | Voting body, motion, bill/amendment context, individual positions and people |
| Document/material | Publisher source, version/date, sections, associated bills or meetings |
| Conversation | Owner, messages, selected scope, evidence references, action receipts |
| Personal issue | Owner, name, explicit scope and revisions, included/excluded records, queries, subscription references, user relevance annotations |
| Subscription | Owner, one record or normalized query, event selection, delivery preferences, matched events |
| Update | Underlying change, related records, matching subscription reasons, delivery/read state |

Display relationships only when supported by records. A person and a dated office tenure are distinct; observing
membership on a date does not establish the start of that membership. Retain official terminology alongside normalized
labels when necessary to explain an action.

## Connected flows for preliminary prototypes

1. Home question -> disambiguation or scope selection -> bill results -> bill in evidence region -> progress stage ->
   supporting document section -> follow preview -> confirmed subscription.
2. Representative question -> profile -> recorded vote -> bill -> follow preview with own actions and sponsored-bill
   updates independently selectable.
3. Committee question -> committee activity -> meeting -> agenda item -> referred bill -> committee follow preview.
4. Updates -> changed record -> evidence -> originating subscription -> pause -> updated subscription state.
5. Recent conversation -> restored scope -> follow-up question -> version comparison -> passage citation.
6. Settings -> Integrations -> MCP setup -> supported external client authentication -> verified result if available.

## Dependencies and decisions before implementation

| Area | Existing boundary | Work to specify or verify |
| --- | --- | --- |
| Research records | HTTP record/search/diff contracts | Authenticated workflow smoke and coverage for design fixtures |
| Conversation | Source-grounded research-answer contract | History API/storage, retention/deletion, context limits, streaming/cancellation, structured response types |
| Assistant actions | Authorized application services and subscription mutations | Tool allowlist, argument validation, confirmation receipts, idempotent retry and unknown-outcome recovery |
| Bill progress | Canonical actions and statuses | Jurisdiction/measure stage mappings, evidence attribution and domain review |
| Activity following | Existing restricted target/event matrix | Specific action events, associated-bill semantics, complete event production and delivery verification |
| Updates | Per-subscription events and deliveries | Combined feed, read state, pagination and overlap/deduplication policy |
| Novu | Selected for in-app/email design; no deployment implied | Authenticated subscriber identity, workflow/preference mapping, receipt reconciliation, outage recovery, shared inbox state; see notification experience |
| Personal issues | Search and subscription primitives | Issue CRUD/ownership, scope revisions, exclusions, subscription references, query-change and deletion semantics |
| Evidence briefs/comparison | Document versions and cited research | Cross-jurisdiction comparison schema, source-version pinning, preview/copy formatting, coverage and assessment labels |
| MCP settings | Existing protected MCP authentication | Supported client setup and provider support for authorization listing/revocation; no assumed connection status |
| Account preferences | User and optional organization identity | Ownership/sharing policy and persistence of timezone/default preferences |

Preliminary designs can proceed using these proposed surfaces. Resolve these dependencies before presenting the
corresponding behavior as implemented. Address lookup, general web research, arbitrary external MCP sources, and
public conversation sharing are not prerequisites for the core prototype. Visual styling, exact responsive breakpoints,
tab grouping, and example copy remain designer proposals within the navigation and evidence requirements above.
