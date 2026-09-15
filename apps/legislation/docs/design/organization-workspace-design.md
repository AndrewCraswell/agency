# Organization and workspace design specification

## Scope and decision status

Designer handoff for Tabra's shared navigation and organization management. The agreed layout places the organization
switcher at the top of navigation and the workspace switcher at the bottom. Roles and lifecycle defaults below are
design proposals for review, not shipped functionality. Read alongside [organization behavior](../product/organization-features.md),
[information architecture](../product/information-architecture.md), [pricing](../product/pricing.md) and the [design source](../../legislation.pen).
This handoff specifies screens; it does not modify the `.pen` or claim browser acceptance.

Organization means the customer account. Workspace means a client or initiative area within that organization.
Issue means a research topic within a workspace. Personal remains a separate private context. Legislative committees
and agencies are civic records, not customer organizations.

## Navigation layout

```text
Meridian Public Affairs        [v]  Organization, fixed top

New conversation
Conversations
Updates
Issues
Following

Explore
  Bills
  Representatives
  Committees
  Meetings
                                   Navigation scrolls if needed
Workspace                          Fixed footer
Housing Coalition             [v]
Settings
```

Reuse the 264 px shared sidebar, tokens, menu components and typography in the current design. Separate fixed top,
scrollable middle and fixed footer regions. The workspace selector sits immediately above Settings. Keep the global
header's brand, search, help, bell and account responsibilities. Do not introduce another account menu in navigation.
Use a short organization name and workspace name, truncate long names with an accessible full label, and mark selection
with text/checkmark rather than color alone. Avoid fabricated member counts, quotas or connection statuses.

| User/context | Top control | Bottom control |
| --- | --- | --- |
| No active organization membership | Hide organization switcher; provide Create organization in Settings | Hide workspace switcher |
| Personal, with at least one organization membership | Show Personal; menu lists organizations | Hide workspace switcher |
| Organization with selected workspace | Show organization name | Show Workspace label and selected workspace name |
| Organization with multiple workspaces and no previous selection | Show organization name | Show Choose workspace; open the chooser |
| Organization with no accessible workspaces | Show organization name | Show No workspace access; provide permitted recovery action |
| Organization administrator without research access | Show organization name | Show No workspace access; organization settings remain available |

Pending invitations do not count as active membership. Surface an invitation in its acceptance flow and Account settings,
not as a selectable organization with access. A report-only external recipient uses the report view, not this sidebar.

## Organization switcher

### Menu anatomy

Open below the top control, aligned to the sidebar, and constrained to the viewport. Show Personal, followed by
Organizations with accessible organization names and optional avatars. Mark the current item. Add Find organization
when the list needs filtering. The footer contains Organization settings for the active organization when authorized,
and Create organization. The latter starts setup, never a purchase directly.

Organization rows switch context immediately after successful authorization. Selecting the current organization closes
the menu without navigation. Do not use hover to switch. If a membership list fails to load, retain the current context
and show Retry in the menu; do not interpret failure as having no organizations.

### Destination rules

1. Restore the last accessible, active workspace used in the selected organization.
2. Otherwise select its only accessible active workspace.
3. Otherwise present a workspace chooser, without choosing an arbitrary client.
4. With none, show No workspace access. Administrators can open organization settings or create a workspace; members
   see who can help only when that contact information is authorized. Keep Switch organization and Personal available.

Remember the last workspace per user and organization. A remembered value is a preference, never proof of authorization.
Switching organization updates the top label, workspace label, content and permissions together, without briefly showing
the old organization's content under the new name. Keep the prior selection if the switch fails.

## Workspace switcher

Open upward from the footer control on desktop. Show a searchable list of active workspaces the user can read in the
selected organization. Each row has name, optional description and a current-selection checkmark. A restricted marker
may explain access, but never list a restricted workspace to an ordinary nonmember. Do not show inaccessible counts.

Footer actions: Workspace settings for the selected workspace, Create workspace when permitted, and Archived workspaces
when the user has accessible archived work. A manager sees management controls in Workspace settings; other members
see a read-only name, audience and their effective role. Do not infer permission from a hidden button alone.

Selecting a workspace changes conversations, Issues, Following and Updates to that workspace. Preserve the current list
destination where possible; from a specific issue or conversation, return to the corresponding list in the new workspace.
From New conversation, open a new empty composer. Never automatically load an unrelated conversation. Canonical evidence
pages can remain open, but Follow and Add to issue use the new explicit context.

Settings pages behave differently: Account remains personal; Organization settings remains scoped to the selected
organization; Workspace settings changes to the newly selected workspace. Organization switching preserves a settings
section only if it exists and the user can access it, otherwise opens that organization's permitted landing view.

The All my workspaces option inside Issues is an organization-level overview, not an owning workspace and not a choice
in the bottom switcher. Show each issue's workspace there. Opening an issue selects its workspace. Creating from the
overview requires a destination. Assigned to me and Needs my review remain filters, not additional workspaces.

## Switching safeguards and shared context

- Save drafts under the original owner/workspace. Switching does not copy, move, send or discard them. If a draft cannot
  be saved, offer Stay and retry or explicitly discard before leaving; do not silently lose input.
- Keep tab-local context. Switching one browser tab must not retarget actions already started in another tab.
- Bind generation, exports and other jobs to their starting workspace. A result arriving after switching cannot appear
  in the new workspace. Notify completion with an authorized link to its original destination.
- Authorize direct issue/conversation links, then select their organization and workspace. For inaccessible links show
  a neutral unavailable state without the private title or client name. Sign-in preserves the intended destination.
- If access is revoked while open, remove protected content, disable mutations and select an accessible destination.
  Preserve unsaved content only under the original protected ownership; do not offer a copy into Personal.
- New organization conversations use the selected workspace and show Shared with Housing Coalition before composition.
  Personal conversations remain private. Selected personal findings can be copied through an explicit destination preview.
- Navigation changes do not alter subscriptions or mark all updates read. Unread/read state belongs to each recipient.
  The bell and Updates apply the same authorized current context; personal and other-workspace events are not silently mixed.

## Organization settings layout

Open from Settings or the organization menu. Retain the global sidebar and its selectors. Use a page-owned settings
navigation within the content region. Show the organization name above the sections so settings scope is unambiguous.
Do not make this a new primary destination or a separate full-screen administration application.

Sections: General, Members and access, Workspaces, Reports, Billing, Activity. Personal Account, Notifications and
Integrations retain their existing destinations. Organization integrations use an explicit organization heading.
Permission controls which sections are available. Direct routes enforce the same permission as navigation.

Proposed browser routes use `/settings/organization/{accountId}/{section}` and
`/settings/organization/{accountId}/workspaces/{workspaceId}`. These are design proposals, distinct from civic
`/organizations/{organizationId}` routes.

### General

Show editable name and logo, account identity, and ownership. Use a page-level Save changes action with unsaved-change
handling. Do not derive identity from the editable name. Changing the logo affects future report drafts, not issued
report revisions. Place Transfer ownership and organization closure in a clearly separated consequential-actions area.
Closure is an unavailable/deferred action until retention and billing policy are specified; do not design an immediate
Delete organization button with invented consequences.

### Members and access

Use Members and Invitations tabs, a member filter and Invite members primary action. The member table includes name,
email, organization role, billing permission and workspace access summary. A row opens member detail; its action menu
contains Edit access and Remove member when permitted. Do not display last-active timestamps without reliable data.
Do not mix external report recipients into the internal member count.

Member detail shows organization role separately from workspace grants. Each workspace grant shows name, effective role,
approval permission and access source: Explicit or Organization-wide. Explain that organization-wide access cannot be
removed from one person while that person remains an organization member. Show a readable summary of resulting access
before Save changes. Detect stale edits and reload current permissions rather than overwriting another administrator.

Invitations rows show email, intended role, workspaces, inviter, sent date, expiration and status. Actions are Resend and
Revoke for pending invitations, and Send new invitation for expired invitations. Retain accepted/revoked history in
Activity. Recommend seven-day expiration pending product agreement; do not present it as an existing provider behavior.

### Invite members dialog

1. Enter one or more email addresses. Validate format, duplicates and existing memberships inline.
2. Choose organization role, default Member. Only an owner can appoint an Administrator. Ownership transfer is separate.
3. Select authorized workspaces and roles. For mixed access requirements, edit per person or send separate batches.
4. Show organization-wide workspaces the recipient will inherit; do not imply that unchecking explicit grants removes them.
5. Preview each person's effective access, then Send invitations. Show per-recipient success/failure and retry only failures.

Adding a new internal member requires organization invitation authority. Workspace managers without that authority can
add existing members to their workspace, but cannot send organization invitations. Inviting a person does not assign
tasks, subscribe them to alerts or expose personal history. Billing consequences must follow the eventual seat policy;
do not invent an additional-seat price in the dialog.

Acceptance shows inviter, organization, intended workspace access and the signed-in identity before Accept invitation.
Wrong identity offers Sign in with another account. Expired/revoked invitations reveal no workspace contents. Acceptance
rechecks the invitation, organization state and inviter authority; repeated acceptance by the same person is harmless.

## Roles and effective permissions

The organization owns work. The creator is its author, not a personal owner who can take it away when leaving.
Use organization roles Owner, Administrator and Member. Billing is a separate permission. An Administrator can manage
Members but cannot promote someone to Administrator, alter an Owner, or increase their own authority. Owner appointment
and transfer require an existing Owner. No one may remove or demote the final Owner without a replacement.

| Organization capability | Owner | Administrator | Member |
| --- | --- | --- | --- |
| Edit organization name/logo | Yes | Yes | No |
| Invite/remove ordinary members | Yes | Yes | No |
| Appoint/demote administrators or transfer ownership | Yes | No | No |
| Create workspaces and inspect administrative inventory | Yes | Yes | No |
| Configure organization integrations | Yes | Yes | No |
| Read a restricted workspace automatically | No | No | No |
| Perform explicit workspace access recovery | Yes, audited | No | No |
| View invoices or manage subscription | With billing permission | With billing permission | With billing permission |

A Member who is also a workspace Manager can create a workspace under the workspace-role rule below; this does not
grant access to the organization-wide administrative inventory.

The first Owner receives billing permission at creation. Owners can grant/revoke billing permission; billing permission
alone never grants research access or membership management. Billing-only members see only the relevant settings.

For workspace grants, use a base access dropdown: Manager, Editor, Reviewer, Viewer. Reviewer reads/comments and may
approve an assigned revision. Editor and Manager can receive an additional Can approve reports permission. Keep this
explicit rather than assuming every manager approves reports. This implements the broader spec's combined capabilities.

| Workspace capability | Manager | Editor | Reviewer | Viewer |
| --- | --- | --- | --- | --- |
| Read internal issues and workspace conversations | Yes | Yes | Yes | Yes |
| Create/edit issues, commentary and assignments | Yes | Yes | No | No |
| Comment on report review | Yes | Yes | Yes | No |
| Approve assigned report revision | Only with approval permission | Only with approval permission | Yes | No |
| Change workspace membership/settings or archive | Yes | No | No | No |
| Share an approved revision externally | Yes, subject to organization policy | No | No | No |

For Organization-wide workspaces, all active organization members receive Viewer access as the baseline; explicit grants
can increase it. Restricted workspaces use explicit grants only. The effective-permission summary must explain both.
No per-issue overrides initially. A report-recipient grant is limited to the approved report revision, not its workspace.

Require sufficient authority on every save. Prevent self-promotion. After a role downgrade, update open menus and revoke
now-disallowed actions. Report approval still follows the proposed independent-review requirement: an author cannot
approve their own substantive revision simply because they hold the approval permission. Solo exceptions remain undecided.

## Workspaces and workspace settings

Organization Workspaces lists name, visibility, manager, member count and Active/Archived status. Administrators see
administrative metadata, not restricted issue titles or contents. Explain at workspace creation that its name is visible
to organization administrators. Ordinary members see only accessible workspaces through their switcher.

Create workspace collects name, optional description, visibility (Restricted by default), manager and initial members.
Show the audience before Create workspace. The creator becomes its first Manager. Organization administrators and
existing workspace Managers may create workspaces under this initial proposal. Creation grants access to the new
workspace only, not other restricted workspaces. Duplicate names prompt clarification but IDs remain the identity.

Workspace settings has General, Members and Activity sections. General contains name, description, visibility and archive.
Members shows direct grants and organization-wide baseline access separately. The access picker searches existing
organization members and excludes external report-only recipients. Preserve at least one active Manager; recovery of an
orphaned workspace uses the Owner's explicit recovery action rather than preventing urgent member removal.

Changing Restricted to Organization-wide previews that all active members can read every contained issue and conversation.
Changing back previews who loses inherited access; retain explicit grants. Save applies the audience change atomically
and rechecks queued notifications. Archive previews paused monitoring and read-only research; existing report grants
remain until revoked/expired. Restore does not automatically restart delivery.

### Removal, leaving and ownership transfer

Remove member shows the person's identity, affected workspace grants, unfinished assignments, pending reviews and
connection responsibilities. Confirm with Remove member, not a vague Continue. Removal revokes access immediately;
reassignment may follow and must not block urgent removal. Preserve organization work and historical attribution.
Display unassigned work as Needs owner. Reinvite starts a new access grant and does not restore all old permissions.

Leave organization is available from membership settings. Show the same personal-versus-organization ownership summary.
The last Owner must transfer first. Transfer ownership selects an active member, previews that person's new authority,
and explicitly selects the departing Owner's remaining role and billing permission. Require reauthentication and a
final confirmation. Do not silently remove the old Owner from the organization or transfer private personal work.

Owner recovery displays the workspace, proposed replacement Manager and required reason before granting access. Record
the action and notify existing managers. Ordinary Administrator status is insufficient. Stronger client ethical-wall
requirements remain a separate policy decision; the UI must not promise protection from every owner recovery action.

## Other organization management sections

| Section | Required content and interaction |
| --- | --- |
| Reports | Logo/name and permitted formatting defaults, sample preview, Save changes; label that issued revisions remain unchanged |
| Billing | Current plan, billing contact, billing permission holders, invoices and permitted subscription actions; loading/error states and no invented seats/quotas |
| Activity | Actor, action, object, time and outcome; filter by action/date/actor; retain membership, access, recovery and sharing events without unauthorized content snippets |
| Integrations | Organization-owned connections, health, allowed destinations and disconnect consequences; separate connection setup from workspace delivery authorization |
| Notifications | Personal delivery preferences versus organization/workspace schedules; stopping one's notifications never silently pauses everyone's follow |

Activity remains an administrative history, not another inbox. Do not expose credential values, private queries or report
contents in activity rows. Member removal and role-change results should link to the relevant recorded event.

## Responsive behavior, accessibility and copy

On mobile, keep the organization switcher at the top of the navigation drawer and the workspace switcher pinned above
Settings at its bottom. The center scrolls. Open large selection lists as a drawer-contained full-height selection view
with Back; keep search and the current organization visible. Close the navigation drawer after a successful switch.
Outside the drawer, show the workspace audience on shared resource pages and the organization composer. Preserve the
existing four primary bottom-navigation destinations.

Use single-selection list semantics for context choices, with accessible names such as Switch organization, Meridian
Public Affairs and Switch workspace, Housing Coalition. Support keyboard opening, arrows, selection, Escape and focus
return. Searchable lists need an accessible search label and empty-result announcement. Move focus to the destination
heading and announce a successful context change. Keep at least 44 px mobile touch targets. No hover-only actions.

Member tables become stacked rows on narrow screens, preserving name, role, access and labeled actions. Dialogs become
full-width sheets; long access lists scroll without hiding Save/Cancel. Use explicit audience and consequence text:
Private to you, Shared with Housing Coalition, Remove member, and Stop my notifications. These are proposed strings;
Fluent Agent MCP was unavailable for this handoff, so they are not Fluent-validated.

## .pen handoff and required prototype states

Extend shared components once and instantiate them across frames. Preserve existing typography and spacing variables;
do not rebuild the sidebar per screen. Existing frame IDs below are references, not new node IDs to fabricate.

| Existing anchor | Required design work |
| --- | --- |
| `x8pNV5`, shared sidebar; `ULB76`, shell rules | Top organization slot, scrolling navigation, fixed workspace/Settings footer; personal and organization variants |
| `fSLz1`, app header | Preserve current utilities and account control |
| `qFh3d`, Issues list; `SSExy`, create issue | Workspace-scoped list and explicit destination; optional organization overview |
| `ifkHQ`, issue record | Workspace audience and permissions; selected issue aligns both switchers |
| `X6Gf7`, Account settings | Link to organization creation/memberships without mixing personal deletion and shared work |
| `mzh4Z`, billing; `ZSccR`, integrations | Organization-scoped variants with permission states |
| `JkgLV`, mobile home; `drf0u`, mobile issue | Drawer positions, shared context and narrow management surfaces |

Add frames adjacent to existing Shell and Settings sections for: both switcher menus; personal/no-membership;
organization chooser/no access/loading failure; General; Members; member detail/edit access; invite/partial failure;
invitation acceptance/wrong identity/expired; workspace inventory/create/settings; removal/reassignment; transfer/recovery;
Billing-only access; Activity; mobile drawer and member management. Include a permission-denied direct link and access
revoked while a resource is open. Extend the design index with these connected frame names.

Prototype journeys:

1. Personal -> organization -> last workspace -> another workspace. Confirm the whole research context changes.
2. Owner invites a Member to one restricted workspace. Acceptance exposes that workspace and no unrelated client work.
3. Administrator opens workspace inventory but cannot open restricted research or grant themselves access.
4. Manager adds an existing member as Reviewer; reviewer approves assigned work but cannot edit research or invite staff.
5. Owner removes a member with open work; access ends, authorship remains and assignments need reassignment.
6. Billing-only member opens invoices without gaining research access. Final Owner attempts to leave and transfers first.
7. Open a direct issue link from another organization, then repeat after access is revoked. Include mobile/keyboard use.

Acceptance requires visible active context, no mixed-client content during switching, retained drafts, correct effective
permissions, working failed/empty states, and server-enforced denial on all related reads/writes. Actual implementation
requires integrated-browser desktop/mobile acceptance and repository verification. No prose-specific tests are required.
Unresolved commercial/retention terms, solo approval exceptions and stronger recovery restrictions remain explicit
product decisions; they do not block drawing the specified navigation and management flows.
