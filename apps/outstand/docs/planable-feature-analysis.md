# Planable feature analysis

Research snapshot: **September 22, 2026, Pacific time** (September 23 UTC).

## Summary

Planable is a **collaborative content operation**, not just a social scheduler. Its central workflow is:

**Organize a brand workspace -> plan campaigns -> draft channel-specific content -> collect feedback ->
approve -> publish -> manage responses -> measure results.**

The workspace is the primary organizational and billing unit. A company contains workspaces; workspaces
contain social pages, collaborators, campaigns, assets, and approval rules. Unlimited users reduce the
friction of bringing clients and reviewers into that workflow.

Below is a broad inventory of the features found in the current official product, pricing, and help pages,
supplemented by the authenticated evaluation workspace. Each explanation is a summary, not copied product
documentation. It is not a claim that every feature was exercised end to end.

**Evidence labels:** **Observed** means the screen or control appeared in the evaluation workspace, not that
its backend behavior was tested. **Documented** means an official source describes the capability.
**Advertised** means a product/pricing page lists it, without a detailed workflow being verified.

See [coverage and plans](planable-coverage-and-plans.md) for platform differences, paid gates, source
conflicts, and the limits of the earlier 24-screen walkthrough. The
[reference board](../Outstand.pen) is visual evidence, not an exhaustive feature specification.

## 1. Companies, workspaces, channels, and access

Sources: [company accounts][company], [permissions][permissions], [product overview][product],
[pricing][pricing], and the dashboard/workspace-settings captures.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Company accounts | Group multiple workspaces under one organization, with shared administration and consolidated billing. | Documented |
| Brand/client workspaces | Separate a brand's channels, content, assets, people, and workflow from other clients. The dashboard switches between workspaces. | Observed + documented |
| Company-level collaborators | Invite an internal teammate at company level rather than repeating invitations for every new workspace. Company roles include administration and billing responsibilities. | Documented |
| Channel connections | Authorize social accounts as pages within a workspace. Publishing and reporting capabilities depend on the network and account type. | Observed + documented |
| Mockup pages | Draft and preview content before connecting a real social account. The evaluation workspace's mockup page offered a later connection step. | Observed |
| Workspace roles and permissions | Assign a role, then control capabilities such as viewing, editing, approving, publishing, analytics, and administration per workspace. | Observed + documented |
| Team/client membership | Distinguish internal teammates from external collaborators so drafts and discussion can have different visibility. | Observed + documented |
| Invitations | Invite collaborators by email or link. Access is scoped to the company/workspace and assigned role rather than sharing social-account passwords. | Documented |
| Workspace defaults | Configure name, website, time zone, internal-post defaults, client email visibility, and automatic image cropping. | Observed |
| Unlimited users | Paid plans charge for workspaces rather than each reviewer or teammate. Page, post, storage, and feature limits still apply. | Documented |

**Analysis:** The important product boundary is not the calendar: it is the workspace with its own permission,
visibility, and approval policies. Outstand would need that boundary to serve agencies safely.

## 2. Content creation, AI, and assets

Sources: [product overview][product], [templates][templates], [brand context][brand-context],
[importing posts][imports], [exporting posts][exports], and the composer/settings captures.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Social post composer | Combine copy, media, selected destinations, labels, campaign, and date/time in a draft. Channel-specific controls appear for supported formats. | Observed + documented |
| Platform-style previews | Review content in a feed-like presentation before publication, keeping discussion next to the draft. A preview is not a guarantee of identical native rendering. | Observed + documented |
| Grouped multi-channel posts | Start one post for several platforms. Keep content synchronized, or turn synchronization off to make platform-specific edits. | Documented |
| Rich social formats | Prepare supported text, image, multi-image, carousel, video, Story, Reel, and document posts. Not every format works on every network. | Observed + documented |
| Platform-specific metadata | Where supported, add first comments, alt text, locations, tags, audiences, video titles/thumbnails, Instagram collaborators/products, or LinkedIn mentions. | Documented |
| Universal Content | Plan non-social content such as blogs, newsletters, briefs, scripts, and ads using rich text and embedded media. Review it in the same workflow; manually mark it published rather than assuming direct CMS/email delivery. | Documented |
| Reusable post templates | Save text, images, hashtags, and target platforms as a named template, or create one from an existing post. Load and modify it in the composer. | Observed + documented |
| Media library | Keep workspace assets in one place and reuse them across posts; campaign media can be managed in campaign context. Storage is plan-limited. | Observed entry point + documented |
| Built-in media editing | Adjust images and videos from the content workflow instead of exporting to a separate editor for every change. | Documented |
| Canva integration | Bring assets created in Canva into Planable's publishing workflow. It complements rather than replaces the built-in editor. | Observed + documented |
| AI post generation | Generate draft copy from a prompt, images/videos, or previous posts, then review and edit before publishing. | Observed + documented |
| AI rewriting and continuation | Rewrite copy, continue a draft, or shorten it for platform constraints. These are authoring aids, not approvals. | Documented |
| AI hashtags | Suggest hashtags for a draft; the user retains control of the final caption. | Observed + documented |
| Brand context | Store workspace-specific brand description, voice, terminology, values, and audience guidance. Relevant AI actions apply it automatically; it is not a retroactive rewrite of existing posts. | Observed + documented |
| Drafts and post reuse | Save unpublished ideas and duplicate content to another page or workspace, adapting it for the destination. | Observed + documented |
| Version history | Inspect who changed a post and restore an earlier state. The retained history window depends on the plan. | Documented |
| CSV import | Bulk-import copy, media URLs, and scheduling data using a prescribed CSV format. Assets enter the media library; multiple selected pages can produce grouped posts. | Documented |
| Content export | Export selected/filtered posts to CSV; supported networks also offer PDF previews. CSV contains structured post data and media links, not a complete asset backup. | Documented |
| Archive, delete, restore | Manage content lifecycle separately from publishing. Retention windows mean archived/history data is not necessarily permanent. | Documented in help index + pricing |

**Analysis:** Planable competes on the complete draft-to-review experience. AI copy alone is not a strong
differentiator; brand-aware generation, channel adaptation, reliable previews, and reusable assets fit into
the larger workflow.

## 3. Planning, views, calendars, and campaigns

Sources: [product overview][product], [campaigns][campaigns], [calendar notes][calendar-notes],
[external calendars][external-calendars], [previous content sync][content-sync], and the calendar/feed captures.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Calendar view | See scheduled content together and drag posts to adjust the plan. Week/month organization supports spotting gaps and clashes. | Observed + documented |
| Feed view | Inspect posts in a channel-style feed with content and collaboration context. | Observed + documented |
| Instagram grid view | Arrange the visual sequence of Instagram posts and inspect how future posts fit with existing content. This is not a general-purpose board view. | Observed menu + documented |
| List view | Present content in a compact operational list, useful for reviewing and applying bulk actions. Enterprise-gated in current pricing. | Observed menu + documented |
| Custom views | Save a chosen view type and filters for repeated use; share views with a team, client, or public-link audience where configured. | Observed menu + documented |
| Filters and labels | Classify posts by campaign/content pillar and narrow the working set by labels, status, and other criteria. Label allowances vary by plan. | Observed + documented |
| Calendar notes | Add short, colored, date-specific notes with private/team/all-member visibility. A note can seed a new post when ready. | Documented |
| External calendar overlays | Add a public iCal feed so business events appear alongside planned content. Set visibility and color; refresh daily or manually. It is an inbound overlay, not verified two-way editing. | Documented |
| Scheduling timetable | Store preferred time slots to speed up repeated scheduling rather than selecting a new time for every post. | Observed + documented |
| Campaign records | Group content around a named initiative with dates, description, links, icon/color, and Planning/Active/Completed status. | Observed + documented |
| Campaign briefs and tasks | Keep campaign goals, supporting information, and to-dos in the campaign rather than scattering them across separate documents. | Documented |
| Campaign assets and results | Inspect campaign-associated media and performance of its posts; campaign dates also appear in the calendar. | Documented |
| Sync previously published content | Import recent native-platform posts into the workspace for a fuller calendar/grid and, with Analytics, performance context. Some account types are excluded. | Documented |
| Bulk operations | Work on selected posts together: request approval, approve, schedule, delete, or duplicate as supported by the view and plan. | Documented + advertised |
| Cross-workspace operations | Product marketing advertises bulk duplication and operations across workspaces for multi-brand/location teams. Exact scope and entitlements were not tested. | Advertised |
| Search | A search entry point appears in the global/workspace shell. Its complete indexing scope and search operators were not investigated. | Observed |

**Analysis:** Multiple views are different working perspectives over the same content, not independent copies.
Campaigns and calendar overlays expand the product from social scheduling toward general marketing planning.

## 4. Feedback, client review, and approvals

Sources: [product overview][product], [approval workflows][approvals], [multi-level approvals][multi-approval],
[approval reminders][reminders], [review links][review-links], and the approval-settings captures.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Post-level discussion | Keep feedback threads beside the content being reviewed, with replies and reactions rather than disconnected email exchanges. | Documented |
| Annotations | Attach feedback to a specific part of the content, making the requested change less ambiguous. | Documented |
| Suggested edits | Propose text changes for the author to review instead of silently replacing the draft. | Documented |
| Resolve feedback | Mark addressed comments resolved so open discussion can function as a remaining-work list. | Documented |
| Internal drafts and notes | Keep work-in-progress posts and team-only discussion hidden from external/client members until ready to share. Plan restrictions apply. | Observed settings + documented |
| External review links | Let occasional reviewers view content and comment without creating a Planable account; ask for an identifying name/email when commenting. This does not establish anonymous approval rights. | Documented |
| No approval | Turn off the approval step for workflows where review is unnecessary. | Observed + documented |
| Optional approval | Request approval without making it a prerequisite to scheduling or publishing. | Observed + documented |
| Required approval | Block scheduling/publication until at least one authorized approver approves the post. | Observed + documented |
| Multi-level approval | Route content through named levels with assigned approvers. The help page specifies one approval can satisfy each level; this is not necessarily unanimous sign-off by every participant. | Documented |
| Approver permissions | Restrict who can sign off rather than granting approval rights to everyone who can edit or comment. | Observed + documented |
| My approvals | Collect review work in a dedicated workspace destination instead of finding every pending post manually. | Observed |
| Bulk approval requests and decisions | Ask for sign-off or approve multiple selected posts together; available on higher tiers. | Documented |
| Lock after approval | Prevent changes to approved copy, media, links, or timing until approval is removed or the setting is disabled. | Observed + documented |
| Auto-schedule after approval | Schedule an approved post automatically when it already has a date and time. Approval does not invent a missing schedule. | Observed + documented |
| Automated reminders | Opt in to pending-approval emails after 48 hours and before the intended publication date, subject to scheduling lead-time rules. | Documented |

**Analysis:** This is Planable's most important differentiator: visibility, feedback, permissions, approval,
and scheduling are connected. For Outstand, correct state transitions matter more than duplicating the
appearance of an approval badge.

## 5. Publishing and delivery

Sources: [product overview][product], [best time to post][best-time], [pricing][pricing],
and the [publishing help collection][creation-help].

| Feature | How it works | Evidence |
| --- | --- | --- |
| Scheduled publishing | Select destinations and a date/time, then deliver through supported social-platform integrations once permissions and approval requirements are satisfied. | Documented |
| Immediate publishing | Publish approved/eligible content without waiting for a future slot, where the network and account support it. | Documented |
| Recurring posts | Schedule repeated publication for evergreen material instead of manually rebuilding every occurrence. | Advertised |
| Best-time recommendations | Surface recommended times in the date picker using selected-page engagement/benchmark data. Grouped posts combine signals across selected pages; times follow the workspace time zone. | Documented |
| First-comment scheduling | Prepare a first comment to accompany supported posts rather than returning to the native platform after publication. | Documented |
| Mobile-assisted publishing | Use the mobile app to finish supported notification-based workflows when direct publishing is not available for that account or format. | Documented |
| Post status tracking | Distinguish draft, approval, scheduled, and publication states so teams can see what still needs action. Exact error/retry UX was not exercised. | Observed + documented |
| Connection maintenance | Reconnect accounts when platform permissions expire or change. A draft preview is not evidence that the destination is authorized to publish. | Documented |

**Analysis:** Channel adapters and format restrictions are a major implementation cost. "Supports Instagram"
is too broad a contract: account type, format, permissions, and direct-versus-assisted delivery all matter.

## 6. Social Inbox and community management

Sources: [Social Inbox][inbox], [DMs][dms], [product overview][product], and the inbox add-on screen.
Live conversations were not tested.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Unified comments inbox | Aggregate supported channels' post comments into one workspace interface with the originating post as context. | Documented |
| Comment threads and replies | Read conversations and respond from Planable instead of switching between native social apps. | Documented |
| React/delete actions | React to or remove comments where the underlying network permits those actions. Support is not uniform across networks. | Documented |
| Open/Later/Done workflow | Triage new conversations, defer those needing follow-up, and mark handled conversations complete. | Documented |
| AI-assisted replies | Generate a response draft, then adapt it before sending. It is not evidence of unattended customer-service automation. | Documented |
| Sentiment prioritization | Classify comments as positive, negative, neutral, or questions to help prioritize replies; the help page notes a minimum comment count. | Documented |
| Facebook and Instagram DMs | Receive and reply to supported Page/professional-account messages, including supported image/video attachments. Personal Facebook messages are excluded. | Documented |
| Ad-comment management | Connect Meta ad accounts to bring paid Facebook/Instagram comments into the inbox as well as organic comments. | Documented |
| Inbox permissions | Administrators control who may use response features instead of allowing every workspace viewer to speak publicly for the brand. | Documented |

**Analysis:** This adds an ongoing operational workflow after publishing. It should not be confused with
social listening: the inbox handles conversations on connected accounts; listening finds public mentions.

## 7. Analytics, reports, and competitive intelligence

Sources: [Analytics help][analytics], [Analytics product page][analytics-product],
[product overview][product], and [pricing][pricing]. Only the empty/connection state was observed in-app.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Cross-channel reporting | Aggregate selected pages' followers, impressions, engagement, and posting activity, with totals and platform breakdowns. Some platforms are single-channel only. | Documented |
| Page-level analytics | Inspect an individual page's metrics and changes over a selected period using the metrics its network exposes. | Documented |
| Post-level analytics | Drill into content performance, compare formats, and identify posts generating strong reach or engagement. | Documented |
| Top-performing content | Rank/highlight successful posts to guide future content decisions. | Documented |
| Audience insights | Inspect supported demographic and location breakdowns, rather than treating follower count as the entire audience picture. | Documented |
| Organic versus paid | On supported single-channel views, separate organic, boosted, and advertised results after connecting an ad account. Cross-channel totals remain blended. | Documented |
| Ad spend and efficiency | Inspect supported spend, CPM, CPC, CPE, and CTR metrics alongside content results. Metrics depend on platform and account connections. | Documented |
| Ad-account selection | Switch between connected ad accounts where supported; currency and aggregation rules prevent misleading combined totals. | Documented |
| Competitor analytics | Track supported competitor profiles, compare followers/activity/engagement, examine trends and top posts, and export results. This differs from keyword-based competitor listening. | Documented |
| AI visibility snapshot | Use the workspace website domain to show an SE Ranking-powered summary of AI mentions, citations, and related traffic indicators for the preceding month. Not a complete standalone SEO product. | Documented |
| Custom reports | Choose logo, channels, dates, metrics, order, and supported organic/paid breakdown; preview before sharing. | Documented |
| PDF/CSV and public reports | Download reporting data or share a public report link. Public links can expose the selected paid-data breakdown, so audience selection matters. | Documented |
| Automatic monthly reports | Product marketing offers recurring monthly reporting so teams do not rebuild every client update manually. | Advertised |
| Personalized posting recommendations | Analytics can inform timing advice from account performance rather than only broad benchmarks. | Documented + advertised |

**Analysis:** Normalizing data honestly is part of the product. Platform-specific gaps, collection delays,
blended metrics, and currency differences should remain visible rather than disappear behind a single total.

## 8. Social listening

Source: [Social listening help][listening]. The evaluation workspace showed the promotional/upgrade screen,
not a populated listening dashboard.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Brand monitoring | Add a brand keyword and collect public mentions from supported social networks and websites on a periodic scan. | Documented |
| Topic monitoring | Track campaign or industry keywords independently of the brand name. | Documented |
| Competitor monitoring | Follow public keyword mentions of competitors; this is separate from Analytics' profile-performance comparisons. | Documented |
| Mention feed | Review source, available engagement, sentiment, and media previews; sort by recency or engagement and open the original post. | Documented |
| Volume and sentiment trends | Summarize mention counts, engagement, and positive/neutral/negative sentiment over time with period comparisons. | Documented |
| Correct sentiment | Override an incorrect AI label; the corrected classification updates sentiment summaries. | Documented |
| Hide/restore mentions | Remove irrelevant individual results from the working feed without permanently deleting them. | Documented |
| Source exclusions | Exclude supported handles, channels, users, or domains per keyword. Exclusions affect the feed and CSV but still count in aggregate metrics. | Documented |
| Alerts | Configure notifications for mention spikes or sentiment shifts, then pause, edit, or delete alert rules. | Documented |
| Data export and automation | Export CSV and access listening data through supported automation interfaces; exact API endpoint parity should be checked separately. | Documented + advertised |

**Analysis:** This is batch-based public monitoring, not a real-time firehose or an inbox. The documented
scan cadence, keyword quotas, and 30-day maximum date range materially constrain its use for crisis response.

## 9. Integrations, notifications, mobile, and administration

Sources: [API][api], [MCP][mcp], [account-settings help][account-help], [company accounts][company],
[product overview][product], [pricing][pricing], and the account-settings captures.

| Feature | How it works | Evidence |
| --- | --- | --- |
| Public API | Connect custom tools to workspace, page, post, media, label, and analytics operations. Company owners/admins manage tokens, scopes, workspace restrictions, expiry, and revocation. | Observed entry + documented |
| MCP connector | Authorize an AI assistant to work with content, campaigns, views, approvals, analytics, and listening. Existing user permissions, quotas, and add-on entitlements still apply. | Observed entry + documented |
| Zapier integration | Build no-code triggers/actions between Planable and other tools instead of writing a custom API integration. | Observed + documented |
| viaSocket integration | An integration card was present in the account. Available triggers, actions, and plan requirements were not verified. | Observed only |
| Slack integration | Receive workflow updates in the team's existing communication channel. The exact interactive-action set was not tested. | Observed + documented |
| In-app notifications | Collect approval requests, feedback, and other workspace activity in one notification destination. | Observed + documented |
| Notification preferences | Configure relevant events and delivery through supported email, desktop/push, and Slack channels; account settings include workspace preferences. | Observed + documented |
| Mobile apps | Create/review content, leave feedback, approve, schedule, and receive publishing/activity notifications away from desktop. | Documented |
| Connected devices | Account settings expose mobile-device connection status and app acquisition when no device is connected. Remote-session controls were not verified. | Observed |
| Profile and locale preferences | Manage profile information, password options, time zone, hour format, week-start preference, and email updates. | Observed |
| Two-factor authentication | Provide account-security configuration; the Google-authenticated evaluation account directed security setup to the Google account. | Observed + documented |
| Enterprise SSO | Centralize organizational authentication through the Enterprise SSO offering. Provider details and provisioning behavior were not tested. | Documented |
| Billing and add-ons | Manage company subscriptions, billing details, payment methods, invoices, workspace usage, and separately enabled add-ons. | Documented |
| Data export and account removal | Account settings offer a personal-data download and account deletion. Neither action was executed during research. | Observed |
| Enterprise service | Higher-tier packaging includes onboarding, priority support, a dedicated account manager, and bank/wire payment options. | Documented |
| Adjacent products | SE Ranking and SE Visible appear as related products/integrations; do not count their full feature sets as native Planable capabilities. | Observed + documented |

## Implications for Outstand

These are **product hypotheses**, not findings that Planable lacks a feature.

1. **Baseline competitive workflow:** brand workspaces, connections, grouped drafts, media, calendar/feed,
   client-safe review, enforced approvals, and reliable publication form one coherent core.
2. **High-value differentiator to investigate:** make client review and pending-work ownership especially
   clear. Measure reviewer completion time and missed publication windows rather than just feature count.
3. **AI opportunity:** use brand context and explicit approval boundaries for end-to-end assistance. Planable
   already has generation, MCP, and an API, so merely adding an AI button would not distinguish Outstand.
4. **Trust opportunity:** make platform limitations, permission expiry, data freshness, report visibility,
   and extra costs understandable at the moment they affect the user.
5. **Sequence deliberately:** inbox, analytics, competitor tracking, and listening each require different
   integrations and operational guarantees. They are expansion products, not small calendar add-ons.
6. **Validate before prioritizing:** test actual buyer demand, review-team size, connected platforms, and
   willingness to pay before adopting Planable's entire feature set or workspace-based pricing.

## Sources

Official sources were accessed on the snapshot date. Help articles describe behavior; pricing sources describe
commercial entitlements. Where they conflict, the [coverage and plans](planable-coverage-and-plans.md#source-conflicts-and-open-questions)
page records the discrepancy rather than silently resolving it.

[product]: https://planable.io/product/
[pricing]: https://planable.io/pricing/
[company]: https://help.planable.io/hc/en-us/articles/21715404034204
[permissions]: https://help.planable.io/hc/en-us/articles/22072063868444
[templates]: https://help.planable.io/hc/en-us/articles/21715225240092
[brand-context]: https://help.planable.io/hc/en-us/articles/27960528842396
[imports]: https://help.planable.io/hc/en-us/articles/21715324907804
[exports]: https://help.planable.io/hc/en-us/articles/21715418572828
[campaigns]: https://help.planable.io/hc/en-us/articles/21715321168796
[calendar-notes]: https://help.planable.io/hc/en-us/articles/27387403778716
[external-calendars]: https://help.planable.io/hc/en-us/articles/25699758971548
[content-sync]: https://help.planable.io/hc/en-us/articles/21715490797084
[approvals]: https://help.planable.io/hc/en-us/articles/21715462785180
[multi-approval]: https://help.planable.io/hc/en-us/articles/21715417710876
[reminders]: https://help.planable.io/hc/en-us/articles/27486527769500
[review-links]: https://help.planable.io/hc/en-us/articles/21715470688284
[best-time]: https://help.planable.io/hc/en-us/articles/25399883866268
[creation-help]: https://help.planable.io/hc/en-us/categories/21714193012252-Creating-scheduling
[inbox]: https://help.planable.io/hc/en-us/articles/21715283422236
[dms]: https://help.planable.io/hc/en-us/articles/24314965272860
[analytics]: https://help.planable.io/hc/en-us/articles/21715231495196
[analytics-product]: https://planable.io/analytics/
[listening]: https://help.planable.io/hc/en-us/articles/29421245139356
[api]: https://help.planable.io/hc/en-us/articles/27638359236508
[mcp]: https://help.planable.io/hc/en-us/articles/27538577098780
[account-help]: https://help.planable.io/hc/en-us/categories/21349436387996-Account-settings
