# Organization features

## Purpose and status

Documented September 14, 2026 for companies, lobbying firms, unions and law firms using Tabra for shared legislative
research. This is the proposed organization layer over the existing personal experience, not an implementation or
release claim. The [personal product backlog](backlog.md) remains unchanged in scope; these additions require
their own delivery work and acceptance.

WorkOS already handles login. API, webhooks and MCP already belong in Settings, Integrations. Reuse those foundations;
neither a new login system nor a new integration destination is required. Organization membership, resource ownership
and permissions still need to be connected to the application. Reuse existing WorkOS capabilities where configured,
without treating successful login as proof of workspace authorization or automated provisioning.

The [pricing and offerings](pricing.md) page owns the flat-pricing proposal, Free boundaries and unresolved seat/enterprise decisions.

## Placement in the existing design

Extend the [information architecture](information-architecture.md) and [Tabra mockups](../../legislationpen.pen). The issue
frames `k2G9w` (issue detail), `wO1CP` (comparison) and `Jiz5O` (brief preview) anchor the research-to-report journey.
Navigation names below describe proposed placement, not implemented routes or finalized interface copy.

| Feature | Existing surface | Addition |
| --- | --- | --- |
| Workspace selection | Sidebar, personal workspace identity | Switch between personal work and authorized organizations; make current ownership visible |
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

An organization owns its shared issues, follows, assignments and reports. A client or initiative space groups issues
inside that organization. Personal conversations remain private unless an explicit action copies selected material into
shared work. Joining an organization must not silently expose or transfer personal history.

Start with organization administrators, workspace editors and reviewers, plus separate billing permission and restricted
external report recipients. Administrators manage membership and policy; editors maintain authorized research;
reviewers inspect and approve assigned material. Specify whether administrators can access restricted client content
instead of assuming administration grants universal reading access.

Assignments identify an authorized member, a resource and its issue context, a status and an optional due date. They
must not alter the official legislative record. Positions, priorities and internal assessments are organization-entered
judgments, visibly separate from source facts. Removing a member revokes access and leaves organization work intact;
unresolved assignments can be reassigned. A user cannot gain access by knowing a record, report or workspace URL.

The initial external audience sees approved reports or explicitly selected findings, not the underlying client
workspace. Clients cannot browse internal conversations, draft commentary, assignments or unrelated issues by default.
A full collaborative client portal is a later decision.

## Briefs, exports and sharing

Support two initial outputs from the same selected research:

| Output | Contents |
| --- | --- |
| Issue update | Audience, reporting period, jurisdictions, important developments, reviewed commentary, next actions, cited evidence and open questions |
| Tracked legislation report | One row per selected bill: identity, jurisdiction, version/status date, recent change, position, responsible member and source link |

Separate source text, generated explanations and human commentary. Retain exact version references, passage citations,
as-of dates and known coverage gaps. Excluded records and unselected query matches must not enter a report implicitly.
Do not describe a legislative comparison as a complete survey of current law or infer legal applicability.

Approval applies to a specific report revision. Changing substantive content creates a new draft requiring review;
previously issued content remains an identifiable dated snapshot. Exported Word and PDF files preserve the selected
content and citations. Word edits outside Tabra are not automatically an approved Tabra revision. A future live tracking
page must be labeled as updating rather than silently changing an issued brief.

Sharing requires an explicit recipient selection and preview of the approved revision. Restricted links enforce recipient
identity and current permission on access, support revocation, and exclude private context from URLs. Revocation stops
future hosted access; it cannot recall downloaded files or previously delivered email. No automatic sending follows
from generating, approving or exporting a report. Initially share through a restricted link or download; automated
client report distribution requires a separate recipient and approval workflow.

## Digests and Teams/Slack delivery

An automated digest collects followed changes. A client brief contains deliberately selected and reviewed findings.
Keep their scheduling and approval semantics separate. Extend the [notification experience](notification-experience.md)
and existing application-owned matching, batching, preferences and delivery records rather than creating a second inbox.

Digest configuration names the contributing follows/issues, event categories, reporting window, send time, timezone and
recipients. Offer daily and weekly scheduling as documented additions; define schedule edits and missed-run behavior.
Deduplicate the same canonical event across matching follows, explain why it appears, and retain corrections. A missing
source or failed collection must not be presented as no changes. Sending a digest does not mark its contents reviewed.

Teams and Slack setup belongs to an authorized organization administrator. Following selects from allowed destinations;
it does not accept arbitrary destinations that bypass workspace restrictions. Verify connection and destination access,
show disabled/revoked connections, and retain per-destination delivery history. Disconnecting stops future delivery.
Choose provider details during implementation; the existing Novu decision for in-app/email does not automatically
choose or configure Teams/Slack transport.

Default channel messages contain minimal source-backed event information and a permission-checked Tabra link, not client
notes or private conversations. Channel membership can exceed Tabra membership, including guests, so clearly disclose
what is visible outside Tabra and require an authorized destination choice. Recheck authorization before dispatch;
retries must not duplicate messages. Distinguish queued, accepted, failed and unknown delivery from human receipt.

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

## Competitive position if delivered

The [regulatory ingestion proposal](../regulations/README.md) records the future federal and state data foundation,
including source overlap, bulk imports, synchronization, rate limits and coverage gates. It remains separate from
delivery of these organization features.

Assessment dated September 14, 2026, conditional on completing the core research experience and proving coverage and
monitoring reliability. Vendor pages establish advertised features, not independently tested quality. The proposed
organization layer would make Tabra a credible candidate for shared legislative research and reporting; it would not
establish full parity with broader policy platforms.

| Comparison | Where Tabra would compete | Material remaining difference |
| --- | --- | --- |
| [Plural Professional](https://pluralpolicy.com/pricing) | Shared issue work, assignments, AI-supported comparison and report output | Plural also advertises regulatory analysis and staff contacts; its Enterprise adds international coverage and service |
| [BillTrack50](https://www.billtrack50.com/info/pricing) | Team tracking, reports, permissioned sharing and integrations | Existing offer includes regulation tracking options, public widgets and scorecards; equivalent operational breadth is not established |
| [FastDemocracy](https://fastdemocracy.com/) | Collaborative legislative monitoring, reporting and AI-assisted research | Transcripts, regulatory coverage, mobile tooling and advocacy workflows remain outside this scope |
| [State Net](https://www.lexisnexis.com/en-us/products/state-net.page) | Legislative comparisons, alerts and stakeholder reports | Regulations, code navigation, expert screening and additional content remain significant differences for legal/compliance buyers |
| [Quorum](https://www.quorum.us/pricing/) | A focused legislative research, coordination and reporting workflow | Stakeholder CRM, advocacy/PAC tools, broader geography and policy/dialogue monitoring make it a wider operating platform |

The opportunity is the quality of the complete path from a question to inspected evidence to an approved report.
Chat, citations, comparisons and sharing individually are not unique. Comparative superiority requires side-by-side
customer tasks, measuring research and review effort, relevant changes missed, citation correctness and delivery results.

Law-firm practice groups and lobbying teams with recurring legislative reporting would be plausible initial buyers.
Companies and unions could use the same workflow for legislative affairs. Buyers needing comprehensive regulatory
compliance, member mobilization, stakeholder relationship management or complete legal research still need additional
products. Corporate-scale readiness also requires proven administration, recovery, security documentation and support;
email/Slack/export buttons alone do not establish it.
