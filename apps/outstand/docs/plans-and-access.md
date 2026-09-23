# Outstand plans and access

Part of the [product overview](product-overview.md).

## Plans

Every social media feature is included on every plan. Plans differ only by capacity. There are no seat limits
and no per-account charges.

| Plan | Price | Workspaces | Connected accounts | Extras |
| --- | --- | --- | --- | --- |
| Basic | $19 per month | 1 | Up to 3 | Everything else included |
| Pro | $39 per workspace per month | Any number | Unlimited | Everything else included |
| Enterprise | Custom | Volume pricing per workspace | Unlimited | SSO, onboarding, and support with an SLA |

- New customers start on Basic. There is no free trial.
- Creating a second workspace, or connecting a fourth account on Basic, prompts an upgrade to Pro.
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

Reviewers do not see Internal comments, workspace settings, or the inbox.

### Internal comments

Comments are visible to everyone in the workspace by default. Anyone except a Reviewer can mark a comment
Internal, which hides it from Reviewers.

## Invites and access

- Invite people by email with a role, using WorkOS invitations.
- Share a private review link so someone can view and comment on posts without a full workspace membership.
- Send an **account connect link** when creating a client workspace. The client signs in to their own social
  accounts and connects them, so they never share passwords with the agency.
- Enterprise customers can require SSO for their organization.
