# Outstand product overview

Outstand is a working title. It is a direct competitor to Planable for social media teams that create, review,
publish, and measure content for one or more brands.

Status: agreed scope for design. The first deliverable is a high-fidelity design in
[Outstand.pen](../Outstand.pen). No code is planned until the design is reviewed.

## Customers

| Customer | Typical shape | What they need most |
| --- | --- | --- |
| Agencies | Small to medium, managing 3 to 10 client brands | Client-safe review, approvals, switching between brands, and results they can share |
| Individuals and small businesses | One brand, one workspace | Fast posting, good AI help, and one place to reply and see results |

Both customers use the same product. Everyone works in workspaces, and new customers start with one default
workspace. See [plans and access](plans-and-access.md).

## Core workflow

Create, preview, review, schedule, publish, reply, and measure.

1. Set up a workspace brand kit, often by entering a website.
2. Connect social accounts, or send the client a link to connect their own.
3. Create a post in the Img.ly canvas and check it in the Preview tab for every selected platform.
4. Collect comments and approvals when the workspace requires them.
5. Schedule at the best predicted time, a fixed time, or the next open slot.
6. Publish through Zernio, with a result for each platform.
7. Reply to comments and messages in the shared inbox.
8. Review results for each post, each account, and the whole workspace.

## Product principles

- **No feature paywalls.** Every social media feature is on every plan. Plans differ by capacity, and Enterprise
  adds SSO, volume pricing, and support with an SLA.
- **Previews people can trust.** The Preview tab shows how each post will look on each platform and flags anything
  that breaks a platform's rules before it is scheduled.
- **Review without friction.** Reviewers get a simplified view focused on what needs their attention.
- **AI that sounds like the brand.** AI uses the workspace brand kit and the workspace's past posts.
- **Clear outcomes.** Publishing, approvals, boosts, and automatic replies all leave an audit trail.

## In scope for release

- Workspaces, roles, invites, and account connect links: [plans and access](plans-and-access.md)
- Composer, previews, scheduling, approvals, inbox, analytics, AI, and notifications:
  [feature spec](feature-spec.md)
- Vendor responsibilities and storage and design imports: [integrations](integrations.md)

## Out of scope for release

These are planned for later or covered another way. Planable features that Outstand won't build are listed in
[Planable features left out on purpose](#planable-features-left-out-on-purpose).

| Excluded | Notes |
| --- | --- |
| Full ad campaign management | Boosting new and published posts is in scope. Approval settings are designed to cover ad campaigns later |
| Post import and export | Planned after launch in Settings, Import and export. Analytics and audit log exports are included at launch |
| AI image generation | Planned after GA. Img.ly AI editing tools are included |
| Custom reports | The analytics pages and read-only Reviewer summary cover release |
| Inbox assignment | Planned after launch. Conversations use statuses and team only notes at launch |
| Free trial | Customers start on Starter |

## Planable features left out on purpose

Outstand competes with Planable, but it doesn't copy every feature. These Planable features are left out on
purpose and aren't planned. See the [Planable feature analysis](planable-feature-analysis.md) for how each one
works in Planable.

| Planable feature | What it does in Planable | What Outstand does instead |
| --- | --- | --- |
| External calendars | Shows events from a public iCal feed in the month and week views, refreshed daily | Day notes mark holidays, launches, and days to avoid posting |
| Campaigns | Groups posts under a named initiative with dates, a brief, tasks, assets, and results | Labels group posts, and every view filters by label. Imports from other tools turn campaigns into labels |
| Social listening | Tracks public mentions of a brand, topics, and competitors, with sentiment and alerts. Planable sells it as a separate add-on | The shared inbox covers comments and messages on connected accounts |
| SEO tracking | Shows how often a website is mentioned or cited by AI tools and search, powered by SE Ranking | Not covered. Outstand stays focused on social content |

## Related research

- [Planable feature analysis](planable-feature-analysis.md)
- [Planable coverage and plans](planable-coverage-and-plans.md)
