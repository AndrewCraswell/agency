# Outstand plans and access

Part of the [product overview](product-overview.md).

## Plans

Every social media feature is included on every plan. Plans differ only by capacity. There are no seat limits
and no per-account charges.

| Plan | Price | Workspaces | Connected accounts | Extras |
| --- | --- | --- | --- | --- |
| Starter | $19 per month | 1 | Up to 3 | Everything else included |
| Pro | $39 per workspace per month | Any number | Unlimited | Everything else included |
| Enterprise | Custom | Volume pricing per workspace | Unlimited | SSO, onboarding, and support with an SLA |

- New customers start on Starter. There is no free trial.
- Starter is for a small business getting started. Once a customer posts often, they move to Pro for a full
  workspace. Creating a second workspace, or connecting a fourth account on Starter, prompts an upgrade to Pro.
- Detailed pricing lives on the marketing site. In the product, the upgrade prompt shows the new monthly price
  and the prorated amount due today.
- SSO is Enterprise-only because it needs manual setup, onboarding, and a paid WorkOS connection.
- Stripe manages subscriptions, invoices, payment methods, and the upgrade flow.

### AI usage

- AI writing and Img.ly AI editing are unlimited in the current release.
- A workspace can add its own AI provider key (bring your own key) in settings when it wants to use its own
  provider account.
- Image generation is planned for a later release. When it is introduced, image generation will have its own
  usage limits; that change does not apply to the current AI features.

## Organizations and workspaces

- A WorkOS organization is the customer account. It owns billing, members, and workspaces.
- A workspace is one brand. It owns connected accounts, posts, media, the brand kit, approval settings,
  notification channels, and analytics.
- Everyone sees workspaces, including single-brand customers, who start with one default workspace.

## Roles

Roles are about permission level, not about who the person works for. A client's employee can be an Editor,
and an agency teammate can be a Reviewer.

| Role | Level | Can do |
| --- | --- | --- |
| Owner | Organization | Everything, including billing, plan changes, and deleting the organization |
| Admin | Organization | Manage members, workspaces, and integrations across the organization |
| Admin | Workspace | Manage workspace settings, accounts, approvals, brand kit, and members |
| Editor | Workspace | Create, edit, schedule, publish, boost, and reply, subject to approval settings |
| Contributor | Workspace | Create and edit drafts, and request approval. Cannot schedule or publish |
| Reviewer | Workspace | View shared posts and previews, comment, and approve or request changes |

### Reviewer view

Reviewers get a simplified view:

- A calendar of scheduled posts and posts waiting for approval
- Post previews for every selected platform
- Comments and approval actions
- A read-only analytics summary, which a workspace Admin can turn off

Reviewers do not see Team only comments, workspace settings, or the inbox.

### Team only comments

- Comments are visible to everyone in the workspace, including Reviewers and guests, by default.
- The comment box has two options: **Everyone** and **Team only**. Reviewers and guests only see Everyone.
- Team only comments have a yellow background and a lock with "Team only", so it's never unclear who can
  read them. The same pattern is used for team only inbox notes and calendar notes.
- AI drafts can use team only notes as context, but never quote or reveal them in public replies.

## Members

Organization Owners and Admins manage members in **Settings, Members**. Workspace Admins manage members of
their own workspace.

- A list of every member with name, email, organization role, workspace access, and last active date.
- Change a member's organization role, or their role in each workspace.
- Remove a member from a workspace or from the organization. The Owner role can only be transferred, not
  removed.
- Filter by workspace and role, and search by name or email.

### Invitations

- Invite one or more people by email, with an organization role and a role for each workspace.
- Invitations show a status: **Pending**, **Accepted**, or **Expired**. Invitations expire after 7 days.
- Pending and expired invitations can be resent or revoked.

## Billing

Organization Owners manage billing in **Settings, Plan and billing**. Stripe handles payment.

- The plan card shows the plan, the price, the renewal date, and usage against limits for accounts and
  workspaces. Members are unlimited on every plan.
- **Upgrade:** compare Starter and Pro, see the prorated amount due today, and confirm. Upgrades start right
  away.
- **Downgrade:** choose the one workspace and three accounts to keep. Other workspaces become read-only and
  other accounts pause. Scheduled posts for paused accounts move to drafts. Nothing is deleted, and upgrading
  again switches everything back on. Downgrades take effect at the end of the billing period.
- **Cancel:** an optional reason, an offer to pause billing for up to three months, then a confirmation that
  explains what happens and offers a data download. Access continues to the end of the period. After that, the
  workspace is read-only for 90 days and then deleted. A banner offers **Resume plan** until then.
- Payment method, billing email, billing details, and invoices with download are on the same page.

## Invites and access

- Invite people by email with a role, using WorkOS invitations.
- Share a private review link so someone can view and comment on posts without a full workspace membership.
- Send an **account connect link** when creating a client workspace. The client signs in to their own social
  accounts and connects them, so they never share passwords with the agency.
- Enterprise customers can require SSO for their organization.

### Review links

- A review link opens a branded page with the workspace logo, not the agency's app.
- The guest confirms their email with a one-time code before viewing. The link can be limited to named
  emails.
- The guest sees only the posts shared with them, the Preview tab for each platform, comments, and approve or
  request changes when they are an approver for the current step.
- Links expire after a chosen time and can be revoked. Every guest action is recorded in the audit trail.

### Account connect links

- The client opens the link, sees which workspace is asking and which platforms are requested, and signs in
  to each platform directly through Zernio.
- Outstand never sees the client's passwords. The client can connect some platforms now and the rest later.
- The agency sees each platform's status on the Accounts page as the client connects.
- Links expire after 7 days by default and can be revoked.
