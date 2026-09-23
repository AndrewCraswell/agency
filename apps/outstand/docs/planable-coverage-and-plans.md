# Planable coverage and plans

Research snapshot: **September 22, 2026, Pacific time** (September 23 UTC).
Companion to the [feature analysis](planable-feature-analysis.md).

## Platform coverage

The same network does not necessarily support publishing, analytics, inbox, and listening equally.
This is a documented capability summary, not a tested account/format compatibility matrix.

| Network | Content planning/publishing | Analytics | Social Inbox | Listening |
| --- | --- | --- | --- | --- |
| Facebook | Supported; formats and account permissions apply | Pages; supported organic/paid breakdown | Comments, Page DMs, supported ad comments | Public mentions |
| Instagram | Supported; professional-account and direct/mobile restrictions vary by format | Professional accounts; supported organic/paid breakdown | Comments, supported professional-account DMs and ad comments | Public mentions |
| LinkedIn | Supported; page/profile and format restrictions apply | Company pages and personal profiles; paid analytics for company pages only | Comments; do not assume DMs | Public mentions |
| TikTok | Supported; direct/mobile workflow depends on account/format | Business accounts; supported organic/paid breakdown | Business-account comments; do not assume DMs | Public mentions |
| YouTube | Supported video publishing | Channels; organic metrics | Not listed in current inbox support | Public mentions |
| Google Business Profile | Supported profile posts | Profiles; single-channel only | Not listed | Not separately listed |
| X | Supported; plan-specific posting limits | Help article lists accounts, single-channel only; marketing page omits X | Not listed | Public mentions |
| Pinterest | Supported | Not listed in the main Analytics support table | Not listed | Not listed |
| Threads | Supported | Not listed in the main Analytics support table | Not listed | Not listed |
| Reddit | Not among the nine publishing networks | Not listed | Not listed | Public mentions |
| Websites, blogs, news, forums | Universal Content can plan material; no general direct publishing integration verified | Not general website analytics; a separate AI-visibility snapshot exists | Not listed | Public web mentions |

Sources: [product](https://planable.io/product/),
[Analytics help](https://help.planable.io/hc/en-us/articles/21715231495196),
[Social Inbox](https://help.planable.io/hc/en-us/articles/21715283422236),
[DMs](https://help.planable.io/hc/en-us/articles/24314965272860), and
[listening](https://help.planable.io/hc/en-us/articles/29421245139356).
Absence from these sources is not proof that an unlisted capability will never be offered.

## Commercial packaging

Primary sources: [pricing page](https://planable.io/pricing/) and its linked
[machine-readable pricing summary](https://planable.io/wp-content/uploads/downloads/planable-pricing.md).
All amounts below are USD per workspace, excluding tax. Recheck checkout before treating them as a quote.

| Capability | Basic | Pro | Enterprise |
| --- | --- | --- | --- |
| Monthly-billed base price | $39/month | $59/month | Custom |
| Approximate annual-billed monthly equivalent | $32.50; page displays $33 | $49.17; page displays $49 | Custom |
| Users | Unlimited | Unlimited | Unlimited |
| Social pages | 4 | 10 | 50 |
| Posts/month | 60 | 150 | Unlimited |
| Views | Feed, Calendar | Feed, Calendar, Grid | Feed, Calendar, Grid, List |
| Approval workflows | None, Optional | Adds Required | Adds Multi-level |
| Campaigns | 3 | 10 | Unlimited according to pricing; help conflict below |
| Labels | 5 | 10 | Unlimited |
| Media storage | 10 GB | 50 GB | Custom |
| Version history | 1 week | 30 days | Unlimited |
| Published content retention | 13 months | 13 months | 24 months |
| Archived content retention | 30 days | 30 days | 1 year |
| Previous-content sync | Not included | Included | Included |
| Team-only drafts/notes | Not included per pricing summary | Included | Included |
| Bulk approval/request | Not included per pricing summary | Included | Included |
| MCP | Included | Included | Included |
| Public API | Not included | Included | Included |
| SSO | Not included | Not included | Included |
| Support packaging | Self-service knowledge base | Adds chat | Adds priority support, onboarding, account manager |

The free evaluation offers **50 posts total**, not 50 every month, with no stated time limit or card
requirement. The pricing summary lists four pages, unlimited users, Feed/Calendar, three campaigns, and MCP.
It excludes X publishing during the trial. Do not infer that every feature visible in a trial navigation menu
can be used without upgrading.

### Separately billed add-ons

| Add-on | Monthly billing | Annual total | What the purchase adds |
| --- | --- | --- | --- |
| Analytics | $14/workspace/month | $140/workspace/year | Performance data, reports, and documented organic/paid analysis; ad-account permissions still required |
| Social Inbox | $9/workspace/month | $90/workspace/year | Supported comments and Facebook/Instagram messaging |
| Social listening | $99/workspace/month | $990/workspace/year | Keyword monitoring, mention/sentiment analysis, and alerts |

Help pages describe a **30-day trial** for each add-on on paid plans. Listening's help page explicitly warns
that its trial converts to a paid subscription unless canceled. Do not start a trial merely to inspect
additional screens. The annual-equivalent numbers displayed in the pricing cards are not monthly-billing
quotes. An **Extra posts** add-on is mentioned in current listening checkout documentation, but its quantities
and pricing were not verified.

Sources: [Analytics](https://help.planable.io/hc/en-us/articles/21715231495196),
[Social Inbox/DMs](https://help.planable.io/hc/en-us/articles/24314965272860),
and [Social listening](https://help.planable.io/hc/en-us/articles/29421245139356).

## Important operational limits

- **Listening is periodic:** the brand keyword refreshes every 24 hours; topics and competitors every seven
  days. The documented allowance is one brand keyword, three topics, and three competitors per workspace,
  with a maximum 30-day date range. It collects public content, not private messages, and replying happens
  on the original platform.
- **Competitor analytics is different:** the Analytics help page describes up to five competitor profiles per
  page, daily sync, and support for Facebook Pages, Instagram professional accounts, YouTube, TikTok, and
  LinkedIn company pages. Those quotas are not listening quotas.
- **Paid data needs separate access:** connecting a page alone is insufficient for ads metrics.
  Cross-channel reports remain blended; organic/paid splitting is single-channel. Recent ad metrics can lag.
- **DM coverage is narrower than comment coverage:** current Instagram documentation excludes voice
  messages, reactions, and group chats, and states initial limits of 15 conversations and 20 messages per
  conversation load. Facebook support is for Page inboxes, not personal accounts.
- **CSV import is constrained:** less than 1 MB, at most 400 rows, prescribed columns/date format, and
  supported text/single-image/link-thumbnail/video content. Imported asset URLs must be directly accessible.
- **Content export is not universal PDF support:** CSV is documented for all pages; PDF previews are listed
  for Facebook, Instagram, LinkedIn, and X.
- **Previous-content sync is not an unlimited archive:** the help page describes the last 30 posts and
  excludes LinkedIn personal profiles, Pinterest, and X.
- **Calendar overlays are not two-way sync:** public iCal feeds refresh daily or manually; documented
  windows are one year back, six months forward for non-recurring events, and three months for recurring ones.
- **AI context has a budget:** relevant authoring actions use up to 4,000 characters of brand context.
  Shortening and hashtag generation do not use it according to the help page.
- **Reminder rules matter:** approval reminders are off by default, require a non-None approval workflow,
  and have lead-time conditions; posts scheduled tomorrow or sooner do not get the documented advance reminders.

Sources for these limits are linked in the corresponding sections of the
[feature analysis](planable-feature-analysis.md).

## Source conflicts and open questions

| Question | Evidence difference | Treatment in this research |
| --- | --- | --- |
| Enterprise campaign allowance | Live pricing and its summary say unlimited; the campaign help article says 100. | Report both; confirm contract/checkout rather than assuming either is definitive. |
| X analytics | Current Analytics help explicitly includes X; the Analytics marketing FAQ lists six networks without X. | Describe X as help-documented, not account-tested; verify eligibility before procurement. |
| Role names | Permissions help uses Guest/Writer/Contributor, while newer brand-context help uses Editor/Approver/Publisher terminology. | Describe capabilities rather than assert one canonical role taxonomy. |
| Multi-level approval rule | Help explicitly says one approval per level suffices, but also uses broad wording about all members approving. | Record the explicit per-level rule; verify exact sequential behavior in an Enterprise workspace. |
| Pricing-summary completeness | The linked machine-readable summary discusses only two add-ons; live pricing and newer help include Social listening. | Do not rely on the summary as the complete feature inventory. |
| Listening source completeness | The help article advertises eight sources, but its source-exclusion examples only describe four. | Do not assume every exclusion/action works on every source. |
| Best-time access | Help says all plans; pricing places personalized recommendations under Analytics. | Distinguish general benchmark advice from analytics-powered personalization; exact gating remains untested. |
| Basic visibility features | Trial screens expose internal controls; pricing reserves team-only drafts/notes for higher tiers. | Seeing a control is not evidence of a Basic-plan entitlement. |
| viaSocket capabilities | Present in the observed integrations screen without detailed behavior reviewed. | Inventory the integration, but leave trigger/action and plan claims unverified. |

Other still-unverified details include a complete format-by-account publishing matrix, failed-post retry
behavior, public-link access controls, SSO provisioning, mobile parity, API rate limits/webhook coverage,
and contractual enterprise guarantees. These are follow-up research topics, not confirmed missing features.

## What was actually observed

The [24 desktop captures](../prior-art/planable/) cover the dashboard; Calendar and Feed; the view menu;
Campaigns; My approvals; inbox/listening upgrade surfaces; Analytics' empty state; composer; profile menu;
profile, notification, integration, device, and security settings; workspace menu; and general, brand,
team/client, approval, template, label, and timetable settings.

This corrects the earlier walkthrough's overly broad completion claim: **24 representative captures are not
all pages or states of Planable.** Grid/List, populated analytics/listening/inbox, billing, detailed campaign
workflows, nested composer controls, external review, mobile, and live publication were not comprehensively
captured. The later official-source research is what expands this analysis beyond those screenshots.

No paid trials, purchases, channel connections, invitations, live posts, or destructive account actions were
initiated for this analysis. Do not treat promotional screenshots or help examples as data from the user's
workspace. Personal account details and workspace-specific URLs are intentionally omitted from these docs.
