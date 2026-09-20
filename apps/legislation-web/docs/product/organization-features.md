# Organization features

## Purpose and status

Documented September 14, 2026 for companies, lobbying firms, unions and law firms using Rostra for shared legislative
research. This is the proposed organization layer over the existing personal experience, not an implementation or
release claim. These additions require their own delivery work and acceptance.

WorkOS already handles login. API, webhooks and MCP already belong in Settings, Integrations. Reuse those foundations;
neither a new login system nor a new integration destination is required. Organization membership, resource ownership
and permissions still need to be connected to the application. Reuse existing WorkOS capabilities where configured,
without treating successful login as proof of workspace authorization or automated provisioning.

The [pricing and offerings](pricing.md) page owns the flat-pricing proposal, Free boundaries and unresolved seat/enterprise decisions.

## Placement in the existing design

This page owns the screen-level handoff: organization switcher at the top of navigation, workspace switcher at the
bottom, and organization management screens. It supersedes the earlier proposal to select workspaces only within
Issues.

Extend the [information architecture](information-architecture.md) and [Rostra mockups](../../legislation.pen). The issue
frames `ifkHQ` (issue detail), `wO1CP` (comparison) and `PMdsp`/`AGG8U` (brief preparation/review) anchor the research-to-report journey.
Navigation names below describe proposed placement, not implemented routes or finalized interface copy.

| Feature | Existing surface | Addition |
| --- | --- | --- |
| Organization selection | Top of shared sidebar | Show Personal and authorized organizations when the user has organization membership |
| Workspace selection | Bottom of shared sidebar, below Settings | Select an authorized workspace inside the active organization |
| Client or initiative grouping | Issues | Group related issues by client, practice group or initiative; grant access explicitly |
| Assignments | Issue detail and its included records | Responsible member, status and optional due date; keep assignments scoped to the issue |
| Review | Issue, Brief preview | Draft, review request, reviewer comments and approval of an identified report revision |
| Word/PDF export | Issue, Brief preview | Export the reviewed content as editable DOCX or fixed PDF |
| Report branding | Settings, Organization, Reports | Organization name, logo and default formatting; permitted per-report overrides |
| Client report sharing | Issue, Brief preview | Named recipients, restricted report access, expiration/revocation and access history |
| Email digests | Following configuration; Settings, Notifications | Digest scope, schedule, timezone and authorized recipients; delivery state in Updates/Following |
| Teams and Slack connections | Settings, Integrations | Organization-owned connection, allowed destinations, connection health and disconnect |
| Teams and Slack routing | Following configuration | Choose an authorized channel and preview the information delivered |
| Members and permissions | Settings, Organization, Members and access | Invitations, removal, role changes, workspace access and ownership transfer |
| Billing | Settings, Organization, Billing | Subscription, billing contact and invoices for authorized billing administrators |

Do not add a separate Reports destination initially. Brief preview is the preparation, review, export and sharing
surface; keep issued report revisions accessible from their issue. API/webhooks/MCP stay in the existing Integrations
surface. Email and chat channels are additional delivery destinations, not new research sections.

## Workspaces and collaboration

### Recommended mental model

The organization is the durable owner of shared work. A workspace is an access-controlled area for a client, practice
group or initiative. An issue is a specific research question monitored over time inside that area. Keep these concepts
distinct: a workspace answers “who is working together and for whom?”; an issue answers “what are we investigating?”

```text
Alex's account
  Personal: private conversations, issues and follows
  Meridian Public Affairs: organization membership
    Housing Coalition: client workspace
      Housing supply and tenant protections: issue
        Included records, comparisons, assignments, report revisions
      Parking minimums: issue
    Internal policy: initiative workspace
      State budget monitoring: issue
```

Example names are design fixtures. One person can belong to several organizations, with different permissions in each.
A client name labels a workspace; it does not automatically create another organization or give the client access.
Do not add a separate client database, nested workspaces or practice-group hierarchy initially. Tags can categorize
issues but must never grant access.

The following recommendations fill gaps in the earlier specification. They are proposed defaults for product review,
not previously approved commercial terms or implemented behavior.

| Object | Ownership and visibility |
| --- | --- |
| Personal work | Belongs to the individual; organization membership never exposes it |
| Organization | Owns shared work, subscription, membership policy, branding and connections |
| Workspace | Belongs to exactly one organization; defines the internal audience for its issues |
| Issue | Belongs to one personal account or one organization workspace; shared issues inherit workspace access |
| Legislative record | Canonical source evidence; including it in two workspaces does not duplicate the official record |
| Assessment or assignment | Belongs to an issue, so two clients can have different positions and owners for the same bill |
| Report revision | A dated snapshot of selected issue research, with its own approval and recipient grants |
| External recipient | Can open specifically shared report revisions; is not automatically an organization member |

An issue has one workspace initially. Reuse across clients means explicitly copying selected research into a new issue,
with fresh assignments, approvals and delivery settings. Do not share a mutable issue between different client audiences.
Source references can be reused; client commentary requires an explicit selection and destination preview.

### Organization selection and everyday navigation

Show an organization selector at the top of the shared sidebar, above New conversation, when the user belongs to an
organization. It lists Personal and authorized organizations. Pin a separate workspace selector at the bottom, below
Settings, while an organization is active. Personal has no workspace selector. Changing organization restores its last
accessible workspace, selects its only workspace, or opens a chooser. See the design specification for empty states.

In Personal, preserve the existing experience. In an organization, Issues defaults to the active workspace. Offer
Assigned to me and Needs my review, plus an explicit All my workspaces overview inside Issues.
These are views of the same issues; they do not grant extra access. Show workspace name, issue owner, latest change and
next due assignment on each shared issue row. Counts and search suggestions must exclude unauthorized content.

The organization selection is an ownership context, not a legislative coverage filter. Bills, representatives,
committees and source documents keep their canonical identities. Follow and Add to issue actions on these records
show the intended personal or workspace destination before saving. Do not infer a shared destination from a bill URL.

Selecting an organization or workspace changes the accessible conversations, Issues, Following and Updates context.
Organization settings remain organization-scoped when switching workspaces.
It does not move the page's existing resources or rewrite unsaved work. Save drafts under their original context and
restore them on return. On direct links, authorize the resource first, then align the visible organization selector;
never use the selector's last value to decide the linked resource's ownership. Separate browser tabs can hold different
organization contexts. An asynchronous response must return to the context that started it.

New conversation in Personal remains private. New conversation in an organization uses the active workspace; if none is
selected, choose an authorized workspace before composing. Label that conversation as shared
with the workspace before the user writes. Do not create a third, vaguely private organization conversation category
in the initial release. Personal research can contribute selected findings through Add to issue without sharing the
whole conversation. Resume research from a shared issue opens an authorized workspace conversation, not a colleague's
personal chat. Any future private organization drafts need an explicit ownership and offboarding policy first.

The assistant follows the same rules as direct controls. It names the destination for a shared mutation and reports what
was saved. It cannot silently invite people, expose another client's material, approve a report or distribute it.
Search, retrieval and generated answers must be limited to authorized workspace context before content reaches the model.

### Creating an organization and its first workspace

1. An existing user chooses Create organization from the selector or Settings when no selector is shown. Show the organization name and applicable Firm plan
   before any purchase. Keep unresolved seat policy out of mockups; joining does not cancel a personal subscription.
2. Create the organization with its first owner. Collect only name and the billing information required at purchase;
   allow logo and report branding later. Do not require a corporate domain or silently enroll colleagues by email domain.
3. Create a first workspace with name, optional description and a responsible workspace manager. Default to Restricted:
   only explicitly added members can access it. Offer Organization-wide as an explicit choice with a visible audience preview.
4. Invite colleagues using email, organization role, selected workspaces and workspace roles. Preview the resulting access
   before sending. An invitation grants nothing until accepted by the matching verified identity.
5. Land in that workspace's empty Issues view with Create issue and Add selected personal research. Creating an issue
   does not subscribe anyone to updates; Following remains a separate explicit choice.

Invitation states are Pending, Accepted, Expired and Revoked. Recommend a seven-day invitation lifetime; resending
invalidates the old invitation and rechecks the inviter's authority. Show a wrong-account recovery action and preserve
the intended destination through sign-in. An existing member invitation updates access through a reviewed change rather
than creating a duplicate membership. A user with organization membership but no workspaces sees a useful no-access
state, not the organization's private workspace names.

### Permissions and administration

Use two layers of permission. Organization roles manage the account; workspace roles govern research. Avoid a broad
“admin can do everything” rule that would expose one client's information to unrelated staff.

| Role or permission | Allowed responsibility | Content access |
| --- | --- | --- |
| Organization owner | Ownership transfer, appoint administrators, organization closure and explicit access recovery | Requires workspace membership for ordinary reading |
| Organization administrator | Organization details, invitations/removal, workspace inventory and connection policy | No automatic right to read restricted workspace content |
| Organization member | Participate in specifically granted workspaces | Only assigned workspaces and explicitly organization-wide workspaces |
| Billing permission | Subscription, billing contact and invoices | Does not grant research or membership-management rights |
| Workspace manager | Manage workspace membership, settings, archive and work reassignment | Can read and edit that workspace |
| Workspace editor | Maintain issues, selected evidence, commentary and assignments; prepare reports | Can read and edit that workspace |
| Workspace reviewer | Inspect evidence, comment and approve a requested report revision | Can read that workspace; cannot silently edit the revision being approved |
| Workspace viewer | Read internal workspace research | No edit, approval or external-sharing rights |
| External recipient | Open granted approved report revisions | No workspace browsing or internal comments |

Editor and reviewer capabilities may be combined explicitly for a member. Workspace manager does not automatically
mean report approver. Recommend requiring a reviewer other than the revision's substantive author for external client
reports. A small team can assign two people both capabilities; a one-person organization can prepare drafts but cannot
claim independent review. Whether to permit a separately labeled self-approved output is a product decision before launch.

Workspace managers can add existing organization members to their workspace. They need organization invitation authority
to invite a new internal member. General administrators can remove membership but cannot quietly add themselves to a
restricted workspace. An owner may use an explicit recovery action to appoint a replacement manager: require a reason,
record the old/new grant, and notify existing workspace managers. This is an administrative recovery power, not a claim
that restricted content is inaccessible to the organization under every circumstance. Stronger ethical-wall requirements
need a separately specified recovery policy.

Administrators see the minimum workspace inventory needed for administration: identity, manager, membership count and
lifecycle status, not issue titles, search terms, snippets or report contents. Workspace names may themselves be
sensitive; explain this metadata visibility at creation. Hide restricted workspaces entirely from ordinary nonmembers.
All shared issue content inherits workspace access; defer per-issue permission exceptions. External report grants are
the intentional narrow exception and never grant the parent issue.

### Daily issue work and review responsibilities

Keep the current issue scope, included records, query matches, exclusions, comparisons and coverage disclosures.
Add a compact shared-work section for workspace, responsible member, internal priority and next action. Record-level
assignments live beside included records or in an issue assignment panel, not in a new global project-management app.

An assignment has one responsible member, an issue, an optional included record, a clear action, status and optional
due date. Recommended statuses are To do, In progress, Blocked and Done. Record completion and reassignment history.
Do not use legislative statuses such as Passed for tasks, or confuse assignment completion with report approval.
An assignee must already have sufficient workspace access; choosing a name cannot silently grant it. A date-only due
date is shown as a date; a timed deadline includes a timezone. Overdue is derived from the deadline, not another status.

Keep unread updates personal to each recipient. Alex reading an event does not mark it reviewed for everyone.
Issue-level triage can separately record who assessed the event, the result and any resulting assignment. Notifications
about assignments and review requests appear in the existing Updates inbox with filters, distinct from source changes.
Mentions notify only authorized members and never expand access.

Position, priority and assessment are human judgments scoped to the issue. Show author and changed time. The same bill
can be supported in one client workspace and opposed in another. A newer source version flags relevant assessments and
drafts for reconsideration; it never silently rewrites an approved brief. Concurrent edits require revision checks and a
conflict explanation rather than silently overwriting a colleague's work.

## Briefs, exports and sharing

### The complete report journey

Use the existing issue brief preview as the report workspace. The author chooses Issue update or Tracked legislation
report, audience, reporting period and included findings. Show the organization/workspace, selected sources, version
dates, excluded material and coverage gaps before generation. Generated explanations are editable drafts, never approvals.

The working sequence is Draft -> In review -> Approved. Request changes returns work to Draft. Approval stores the
exact revision, reviewer and time. A substantive edit during review creates a new revision and invalidates the pending
approval request; it cannot retain another revision's approval. Resolve blocking comments before approval. A newer
legislative source raises a warning without changing what was reviewed. Reviewers can inspect the cited version and
compare it with the new version before deciding whether to approve or request an update.

Keep approval, export and sharing separate. Approved is a content state; Shared is distribution history, since one
approved revision can have multiple recipients and exports. A replacement revision does not automatically replace
recipients' earlier links. Show Earlier revisions on the issue and identify superseded content when an authorized
recipient opens an older report. Withdrawal can disable future hosted access while preserving the internal audit record.

Recommend granting external-sharing authority explicitly to workspace managers, subject to organization policy.
The sharing dialog selects an approved revision, names recipients, sets expiration and download permission, and previews
exactly what they see. Creating a recipient grant or copying a link does not send email. A future Send action must show
recipients and content and require its own explicit execution. Recipient access uses verified email identity; possessing
or forwarding the URL alone is insufficient. Report-only recipients need a lightweight verification flow, not a paid
internal seat or access to the full application.

The recipient page shows report title, issuing organization, reporting period, revision date, findings, citations and
limitations. It omits internal navigation, assignments, author scratch work, reviewer discussions and client-workspace
activity. Approved selected commentary may be included, while review comments remain internal. Source links must open
official evidence or a permitted evidence view without relying on access to the underlying issue. Failure states include
wrong identity, expired link, withdrawn report and revoked permission without revealing private details.

Draft exports, if supported, must be visibly labeled Draft and cannot use the approved-report sharing flow. Approved
DOCX/PDF exports pin the same content, citations and branding as the approved revision. Changing report branding affects
future revisions; it must not silently change previously approved exports. A downloaded file cannot be recalled.

Support two initial outputs from the same selected research:

| Output | Contents |
| --- | --- |
| Issue update | Audience, reporting period, jurisdictions, important developments, reviewed commentary, next actions, cited evidence and open questions |
| Tracked legislation report | One row per selected bill: identity, jurisdiction, version/status date, recent change, position, responsible member and source link |

Separate source text, generated explanations and human commentary. Retain exact version references, passage citations,
as-of dates and known coverage gaps. Excluded records and unselected query matches must not enter a report implicitly.
Do not describe a legislative comparison as a complete survey of current law or infer legal applicability.

Word edits outside Rostra are not approved Rostra revisions. A future live tracking page must be identified as updating,
not silently replace an issued snapshot. Revocation cannot recall downloaded files or delivered email; automated client
distribution and a collaborative client portal remain separately gated.

## Digests and Teams/Slack delivery

### Shared monitoring defaults

A shared follow belongs to the workspace and survives its creator leaving. Editors manage the rule; its recipients are
explicit authorized members, not every organization member. Personal delivery preferences can mute a member's copy
without stopping the shared rule. Following must distinguish Pause for everyone from Stop my notifications.
Adding a workspace member does not silently subscribe them to every follow or backfill their inbox with old events.

Recommend daily/weekly digests for internal authorized recipients initially. External clients receive the approved-report
flow; automated external delivery of research judgments remains deferred. Digests select one workspace initially, with
issue filters, event categories, local send time and timezone. Do not combine client workspaces in one outbound digest.
Within that audience, deduplicate a canonical event while showing all relevant issue reasons.

Schedule edits apply to future batches without resending completed windows. Use a stable window identity for retries.
Recommend skipping email for an empty, successfully collected window while retaining a visible successful run. A failed
or incomplete collection has a distinct state and coverage notice. After an outage, send one labeled catch-up summary
covering unsent events rather than a flood of historical digests. Daylight-saving rules must produce one daily/weekly
scheduled run per intended local date; define the shifted execution time for missing or repeated clock times.

An organization connection and a permitted workspace destination are separate decisions. The administrator connects
Slack/Teams; a workspace manager authorizes which destination that workspace may use after inspecting the payload.
Initial channel messages contain public source facts and an authenticated link; no private client name, query terms or
commentary unless explicitly approved in the preview. Authorization is rechecked at dispatch, including queued retries.

An automated digest collects followed changes. A client brief contains deliberately selected and reviewed findings.
Keep their scheduling and approval semantics separate. Extend the [notification experience](notification-experience.md)
and existing application-owned matching, batching, preferences and delivery records rather than creating a second inbox.

Channel membership can include guests outside Rostra. Disclose the outbound audience, enforce allowed destinations,
retain delivery outcomes and stop future dispatch after disconnect. Provider choice remains open: selecting Novu for
in-app/email does not configure Teams/Slack. Sending a digest does not mark its contents reviewed.

## Organization administration and enterprise extensions

Initial administration covers organization/account identity, invitations, membership removal, workspace permissions,
ownership transfer, billing access, and an audit history of membership, sharing and approval changes. Identity-provider
membership and application access must reconcile consistently; login alone cannot grant access to organization data.

Larger-client extensions include automated provisioning/removal through the customer's identity system, central access
policies, administrative audit export, explicit research/report retention and deletion policies, and contracted support.
Assess which WorkOS capabilities are already enabled before estimating new integration work. Baseline privacy, isolation
and secure authentication are common requirements across plans, not enterprise-only benefits.

Application availability, source publication, ingestion, matching and delivery latency are distinct operational measures.
Only offer commitments backed by observed performance and staffing. Certifications, dedicated hosting, 24/7 support and
unlimited data redistribution are not implied by the enterprise label or this document.

### Settings, removal and continuity

Keep Account settings personal: identity, sign-in and personal-data actions. Under Settings, add Organization sections
for General, Members and access, Workspaces, Reports, Billing and Activity. Keep Notifications and Integrations in their
existing destinations with explicit personal/organization context. Workspace settings are a small contextual view for
name, members, visibility and archive, linked from Issues and the organization workspace inventory.

Members and access shows active and pending people separately, organization role, granted workspaces and invitation
state. Member removal previews affected workspaces, open assignments, review requests and connection responsibilities.
Removal must revoke access promptly even if reassignment is incomplete; place unfinished work in a visible Needs owner
state. Keep authorship and approval history. Cancel pending review authority and future delivery to that member.
Previously valid approvals remain historical facts unless separately withdrawn by an authorized reviewer.

Require an active replacement before the last owner leaves or loses ownership. Organization-owned integration jobs
must not depend on a departed employee's active personal session; if a connection cannot continue, stop it and surface
reconnection rather than silently losing delivery. A personal-account deletion preview distinguishes personal data from
organization-owned work, which remains with the organization under its retention policy.

Archive is the initial workspace closure action. Preview and explicitly apply the pause of workspace-owned monitoring,
prevent new research mutations and show archived issues read-only. Explain whether existing report grants remain active;
recommend leaving them as issued until separately revoked or expired. Restoring the workspace does not silently resume
delivery. Organization-wide visibility changes need a named-audience preview because they expose all contained issues.
Moving an issue between workspaces is deferred initially; explicit copying provides a reviewable new audience and leaves
approval and delivery behind. Permanent deletion, contractual retention, downgrade grace periods and organization closure
require their own launch policy; cancellation must never turn confidential content public or erase it without notice.

Activity records membership changes, role grants, workspace visibility, recovery, approval, sharing, revocation and
connection changes with actor, time, object and outcome. Organization administrators receive administrative metadata;
content-related details remain workspace-authorized. Report “link accessed” only for a verified access event; it is not
proof the recipient read or understood a report.

### Existing engineering foundations and remaining contracts

The [authentication guide](../operations/authentication.md) establishes verified user and optional organization IDs.
The current subscription schema in `src/db/schema/schema.ts` still requires `ownerUserId` and includes it in active-rule
uniqueness alongside optional `ownerOrganizationId`. Those fields alone do not implement durable shared-workspace
ownership. Add an explicit application membership/permission model and resolve shared subscription identity and creator
attribution before promising offboarding continuity. Weekly scheduling also extends the current subscription frequency
constraint; it is not already supported by choosing a new UI label.

Specify organization membership, workspace membership, issue ownership, report revision, approval, recipient grant and
audit event as distinct concepts. Reuse WorkOS for identity; verify which provisioning capabilities are enabled before
designing around them. Authorization must cover lists, counts, search, retrieval, downloads, exports, assistant tools,
API/MCP calls and background dispatch. An optional organization token claim is not proof of access to every workspace.

Customer organizations are distinct from canonical legislative organizations such as committees and agencies.
Keep existing `/organizations/{organizationId}` evidence routes for civic records. Proposed management routes can live
under `/settings/organization/{accountId}/...`; shared issue routes remain `/issues/{issueId}` with server-resolved
ownership. Do not overload civic organization tables or routes for customer administration.

## Detailed placement in the current .pen

The September 14 inspection read the actual JSON hierarchy, component references, labels and dimensions of
`apps/legislation/legislation.pen` (historical path; the current file is [the W design source](../../legislation.pen)).
This is structural design evidence, not a rendered visual or interactive acceptance
review. Earlier references to `legislationpen.pen` are stale. No design nodes were changed during this specification work.

The current sidebar has no workspace selector. The proposed selector is a deliberate extension to its shared component,
not an already-present control. The shell notes reserve the top header for brand, command search, help, notifications
and account. Preserve that rule and the existing typography, spacing variables and component references.

| Existing node | Exact design extension |
| --- | --- |
| `ULB76`, Foundations — Shell rules | Amend sidebar rules to document organization context and shared/personal variants; retain page-owned controls |
| `x8pNV5`, Shell — Sidebar, 264 px | Add conditional organization selector above New conversation and pinned workspace selector below Settings; reuse both across desktop instances |
| `fSLz1`, Shell — App Header | Keep header responsibilities unchanged; account remains identity/sign-out, not a second organization switcher |
| `qFh3d`, Issues — List | Add organization variant: workspace filter, Assigned to me and Needs my review views, workspace/owner labels |
| `SSExy`, Issues — Create | Put destination workspace and audience before scope fields; preserve the explicit optional Following step |
| `ifkHQ`, Issues — Record | Replace Private to you only in the shared variant with workspace/audience; add owner, assignment panel and review summary |
| `wO1CP`, Issues — Comparison | Retain source version columns; show issue context and carry only selected comparison content into a report |
| `PMdsp`/`AGG8U`, Issues — Brief preparation/review | Add output type, revision state, reviewer panel, approved export and restricted sharing; retain citations and open questions |
| `dtIwY`, Updates — Inbox; `ttmwU`, Updates — Bell panel | Add authorized assignment/review events and context filtering; retain one recipient inbox and the existing compact bell |
| `gGUll`, Following — Follow configuration | Show workspace owner, recipient selection, schedule and permitted destinations with audience preview |
| `X6Gf7`, Settings — Account | Keep personal scope explicit, especially Export your work and Delete account |
| `ZSccR`, Settings — Integrations | Add organization ownership, Slack/Teams connection health and allowed destinations beside existing MCP/webhooks |
| `hpAPM`, Settings — Notifications | Distinguish personal preferences from organization digest defaults |
| `mzh4Z`, Settings — Subscription and billing | Add authorized organization billing variant; do not imply a decided seat count |
| `drf0u`, Issues — Mobile, record; `JkgLV`, Home — Mobile | Put selector in navigation drawer; show workspace on issue; use full-width assignment/review sheets |

Workspace settings belong inside the content area. Workspace selection belongs at the bottom of the shared sidebar.
Avoid a second permanent sidebar. An issue breadcrumb becomes Issues / Housing supply and tenant protections; keep its
workspace audience visible in the issue header. Both context selectors remain visible in the shell. Personal issue frames
keep their Private to you label. On mobile, preserve top organization and bottom workspace positions in the drawer;
the existing four primary destinations remain in the bottom bar.

Add adjacent frames in the existing Shell, Issues, Updates/Following and Settings sections rather than a disconnected
organization dashboard. The minimum additional state set is:

1. Organization selector: personal, multiple organizations, empty membership and access revoked.
2. Organization setup and invite acceptance: valid, wrong account, expired and revoked.
3. Shared Issues list: one workspace, all accessible workspaces, empty and no workspace access.
4. Workspace creation/access dialog and organization member detail/removal preview.
5. Shared issue with assignments, unassigned work and a concurrent-edit conflict.
6. Brief in review, changes requested, approved, and newer-source warning.
7. Share preview, recipient report, expired/revoked access and earlier revision.
8. Organization general/members/workspaces/reports/billing/activity settings.
9. Digest and Slack/Teams destination preview, disabled connection and failed delivery.
10. Mobile switching, shared issue and review/recipient views.

Prototype one connected example: Alex joins Meridian, is granted Housing Coalition access, opens the existing housing
issue, assigns a version comparison to Jordan, prepares a report, receives Jordan's approval and grants a named client
access to that revision. Then demonstrate that the client cannot open the issue and Alex cannot find an unrelated
restricted client workspace. Revoke the report and remove Alex to demonstrate both access boundaries and work continuity.

## Competitor patterns informing this proposal

Official sources checked September 14, 2026. Help documentation is stronger evidence of interaction rules than marketing
copy. These are documented/advertised capabilities, not findings from authenticated competitor testing. Recommendations
in the final column are Rostra design judgments; they do not establish that a competitor lacks the recommended behavior.

| Product | Verified relevant pattern | Implication for Rostra |
| --- | --- | --- |
| Plural | Distinguishes user account, organization and workspace; documents organization/workspace administrator and member roles. [Permission levels](https://help.pluralpolicy.com/accounts-permission-levels-and-workspaces) | Use a clear ownership hierarchy and separate administrative authority from everyday research roles |
| Plural | Workspace creation sits below organization selection; organization administrators can inspect workspace inventory but need to join to see its contents. [Workspace management](https://help.pluralpolicy.com/team-workspace), [organization administration](https://help.pluralpolicy.com/basic-information-for-organization-administrators) | Make client workspace access explicit and design setup before bulk invitations; use Rostra's agreed top organization and bottom workspace selectors |
| FastDemocracy | Advertises task assignment, team/client collaboration, customizable scheduled reports and self-updating links/widgets. [Product overview](https://fastdemocracy.com/) | Assignments and useful delivery are expected; visibly distinguish an updating tracker from an approved dated report |
| Quorum | Describes shared workspaces, permissions, saved searches, internal notes, assignments, activity logs and stakeholder digests. [State platform](https://www.quorum.us/products/state/) | Make handoffs and team responsibility first-class within Issues; broader advocacy and CRM functions remain outside this scope |
| Notion, an interaction reference | Distinguishes open, closed and private teamspaces, and documents inherited permissions and the broadest effective access grant. [Teamspaces](https://www.notion.com/help/intro-to-teamspaces), [sharing and permissions](https://www.notion.com/en-gb/help/sharing-and-permissions) | Explain the audience before creation; use restricted workspaces by default and avoid complex per-issue overrides initially |

BillTrack50 and State Net remain part of the broader [market comparison](../research/pricing.md). BillTrack50's official
pricing page returned HTTP 403 in this pass, so this proposal does not infer detailed current role or sharing behavior
from it. Do not infer any competitor's revision-approval, revocation or offboarding semantics from a generic sharing claim.

The useful product promise is: a team can turn inspected legislative evidence into an accountable, reviewed client
deliverable while preserving client boundaries. This requires proving the connected workflow, not merely adding member
invitations, folders or an export button.

## Proposed defaults and decisions still requiring agreement

The agreed navigation places organization selection at the top and workspace selection at the bottom of the sidebar.
Recommended defaults are restricted client workspaces; one workspace per shared issue; explicit shared-conversation audience; separate billing
permission; revision-specific independent review for external briefs; and report-only external access.

Before implementation, agree exact role combinations and the cancellation and retention policy that organization closure
depends on. This specification settles the remaining defaults: invitations last seven
days, a solo organization ships work labeled Prepared without independent review rather than blocked work, owner
recovery appoints a replacement Manager without granting the owner research access, and closure stays out of the first
release. Pricing still owns seat policy, Free entitlements and API/MCP packaging. Later extensions
can include cross-workspace reporting with an audience intersection check, permission groups, automated provisioning
and collaborative client portals after the initial boundaries are working.

## Delivery and acceptance

1. Define organization ownership and access, then implement workspace selection, membership and client/initiative scope.
2. Add assignments and revision-specific review to the issue and brief journey.
3. Add branding, DOCX/PDF exports and restricted sharing with citation-preserving snapshots.
4. Extend Following with scheduled digests and administrator-configured Teams/Slack destinations.
5. Add enterprise provisioning, retention and contracted operations in response to scoped customer requirements.

For each shipped slice, exercise internal editor, reviewer, removed member and external recipient journeys. Verify
cross-client denial, ownership continuity, draft/approved separation, version and citation preservation, sharing
revocation, and duplicate-free authorized notification delivery. Render real exported files and inspect them. Run
browser acceptance at desktop/mobile sizes and the repository verification gates for implementation. No prose-specific
test suite is required for this planning document.

Measure account/organization costs for generation, ingestion allocation, storage, notifications and support; report
typical and expensive legitimate workloads by plan. Do not log private research text merely to measure consumption.
Use evidence to revisit flat prices; no usage quota or seat count is established here.

## Commercial scope

[ICPs](icp.md) owns buyer priority and economics; [Competitors](competitors.md) owns the current segment-specific comparison.
Association teams and boutiques are the primary shared-research hypothesis, not every organization with a policy budget.
Demonstrate research/reviewer effort, citation correctness, isolation and repeat use before claiming an advantage.
Regulatory coverage, enterprise service and broader operating-platform replacement remain separate delivery decisions.
