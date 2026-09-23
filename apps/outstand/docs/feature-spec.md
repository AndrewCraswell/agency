# Outstand feature spec

Part of the [product overview](product-overview.md). This page lists what the design must cover at release.
Access rules are in [plans and access](plans-and-access.md), and vendor responsibilities are in
[integrations](integrations.md).

## Brand kit

Each workspace has a brand kit that AI and the Img.ly editor use.

- Brand name and website
- Brand voice description
- Writing style guide for AI prompts (optional)
- Logos, brand colors, and fonts
- Saved hashtag sets
- Saved locations, such as stores and venues, for location tagging
- Post templates
- **Start from a website:** enter a URL, and Firecrawl detects the colors, logo, and voice to fill in a first
  draft of the brand kit for review

## Media library

- One media library per workspace, with folders and tags.
- Upload files, or import them from Google Drive, Google Photos, OneDrive, Canva, or Figma.
- Imported files are copied into the library and remember their source, so they can be re-imported when the
  source changes.
- Frequently used brand media can be pinned.

## Composer

### Canvas and editing

- The composer is an Img.ly canvas for editing images and videos in the post.
- Img.ly AI editing tools, such as background removal and smart crop, are included.
- Img.ly design templates use the brand kit's colors, fonts, and logo, with brand elements locked.

### Preview tab

- A Preview tab shows a mock of the post as it will appear on each selected platform.
- The design covers every platform Zernio supports, including Reddit, Bluesky, Snapchat, and Telegram.
- Previews flag anything that breaks a platform's rules, such as text length, aspect ratio, video length, or an
  unsupported post type.

### Caption editor

Captions, first comments, auto-reply text, templates, and inbox replies use a TipTap rich text editor.

- Formatting that platforms support: bold and italic where allowed, lists, line breaks, emoji, hashtags,
  mentions, placeholders, and links. Formatting a platform can't show is converted in the preview.
- Select text to open a menu with **Improve** actions: rephrase, change tone, make longer, make shorter, fix
  spelling and grammar, translate, or tell AI what to change.
- Tone options start with the brand voice, then friendlier, more professional, playful, confident, and calmer.
- AI changes can be undone like any other edit.

### Content across platforms

- One post has shared caption and media.
- Optional overrides for each platform change the text, media, or settings for that platform only.
- Platform-specific settings include post type, such as Reel, Story, Short, carousel, or document.

### Location tagging

- Add a location to a post from **Post details**. Search places, or pick a saved location.
- Saved locations live in the brand kit, such as each store or venue, so the team reuses the exact same place.
- The shared location applies to every platform that supports it. Each platform can override it, for example a
  city on Threads and a store on Instagram.
- Platforms that don't support locations show "Not supported" in their settings and skip the location. The
  Preview tab shows the location where the platform displays it.
- Support follows Zernio for each platform, such as Instagram, Facebook, Threads, and TikTok.

### First comment

- Turn on a first comment for a post.
- Write a separate first comment for each platform.

### Auto-replies

Auto-replies are set per post. They send targeted replies when conditions are met, not replies to everything.

- Conditions: sentiment, keywords, or both
- Reply: fixed text, or AI-written text from a prompt so replies sound natural instead of identical
- Optional approval before AI-written replies are sent, recorded in the audit trail

### Templates

A template is a saved post:

- Caption with placeholders
- Target platforms
- Hashtag set
- First comment
- Optional Img.ly design template with locked brand elements

Start a post from a template, or save any post as a template.

### Labels

Labels group posts, for example by content pillar or product launch. Views filter by label.

## Scheduling

- **Best predicted time:** schedule automatically for the time predicted to get the most engagement.
- **Fixed time:** choose a time while viewing a chart of expected engagement for each time block.
- **Saved schedules:** a workspace can save posting schedules per account. When a post uses a schedule, choose
  the next available time, or choose a fixed or best predicted time in the same way.
- Scheduling uses the workspace time zone.

## Approvals

Velt powers comments, approvals, and the audit trail.

- Each workspace chooses: no approvals, one step, or several ordered steps.
- When approvals are on, posts cannot be scheduled until every required step is approved.
- Approvers can approve or request changes, with comments.
- Approvals can also be turned on separately for boosts and, after release, ad campaigns.
- Approvals can be turned on for AI-written auto-replies.

### Approval steps

A workflow is a list of ordered steps. Each step has:

- **Name**, such as Internal review or Client sign-off.
- **Approvers:** one or more people, chosen by name or by role, such as every Workspace Admin. People
  outside the workspace can approve through a review link.
- **Rule:** any one approver, every approver, or a minimum number, such as 2 of 3.
- **Applies to:** every post, or only posts for chosen accounts or labels. A step that doesn't apply is
  skipped.
- **Due time (optional):** a reminder is sent when a step is still waiting after a set number of hours.

Steps run in order. A step starts only when the previous step is approved. When anyone requests changes, the
post returns to its author, and the workflow restarts from the first step after the next edit. Admins can
choose to restart only the step that requested changes instead.

Workspace Admins can skip a step for an urgent post. Skips are recorded in the audit trail with a reason.

## Publishing

- Zernio publishes to each account separately, so each platform has its own result.
- If one platform fails, the others still publish.
- The author and admins are notified with a plain-language reason, such as an expired connection or a video
  that is too long.
- Failed platforms offer **Retry** and **Edit and retry**.

## Boosts

- Boost a new post from the composer, or boost a published post.
- Choose a connected ad account, budget, duration, and audience.
- Boosts follow the workspace boost approval setting.
- Paid and boosted results appear in analytics.
- Full ad campaign management is out of scope for release.

## Views

| View | Purpose |
| --- | --- |
| Calendar | Month and week views, with drag to reschedule and day notes |
| List | Scan and act on many posts at once |
| Feed | Review posts as they will appear |

All views filter by account, status, and label. Reviewers get the simplified calendar described in
[plans and access](plans-and-access.md#reviewer-view).

### Calendar notes

- Add a note to any day, such as a holiday, a launch, or a reminder to avoid posting.
- A note has a short title, optional details, and a color.
- Notes show at the top of the day in month and week views and don't count as posts.
- Notes are visible to the workspace. Mark a note Internal to hide it from Reviewers.

## App shell and search

- The app shell has a sidebar for navigation and a top bar with the workspace name, search, and
  notifications.
- **Search (Ctrl K or Cmd K):** find posts, media, conversations, accounts, and people in the current
  workspace, switch workspaces, and run common actions such as Create post.
- Recent items show before anything is typed.

## Shared inbox

- Comments and direct messages from every connected account, wherever Zernio supports them.
- The design shows which accounts support comments, messages, or both.
- Statuses: Open, Later, and Done.
- Internal notes on conversations, hidden from the customer.
- AI reply drafts written in the brand voice.
- Sentiment tags to help decide what to answer first.
- No assignment to teammates at release.

## Analytics

- **Workspace overview:** results across every connected account.
- **Account pages:** followers, reach, engagement, and top posts for each account.
- **Post results:** when a post goes to several accounts, Outstand knows they belong together. It shows the
  combined results for the post, plus a breakdown for each account.
- Paid and boosted results are shown separately from organic results.
- Filter by date range and account.
- Export as CSV or PDF.
- Reviewers can see a read-only summary unless a workspace Admin turns it off.
- Custom reports come later.

## AI

Every AI action uses the brand kit and the workspace's past posts as grounding. AI writing and Img.ly AI editing
are unlimited in the current release. A workspace can use its own AI provider key when preferred. Image generation
is deferred; when it is introduced, it will have separate usage limits. See [plans and access](plans-and-access.md#ai-usage).

- Caption writing
- Rewrites that adapt a caption for each platform
- Hashtag suggestions, using saved hashtag sets
- First comments
- Auto-replies
- Inbox reply drafts
- Alt text
- Post ideas
- Img.ly AI image editing

Image generation is planned after GA. The design should leave room for it in the canvas.

### AI feedback

- Every piece of AI-written text has thumbs up and thumbs down, copy, and try again.
- Thumbs down asks for an optional reason, such as off brand, too long, not accurate, or wrong tone, and an
  optional note.
- Feedback is stored with the prompt, the output, and the workspace, so the team can improve prompts. It is not
  shared with other workspaces.

### Bring your own key

- In **Settings, AI and credits**, choose Outstand AI or your own key.
- OpenRouter is the suggested source, because one key covers Claude, GPT, Gemini, and other models. Show a
  **Get a key** link to OpenRouter. OpenAI, Anthropic, and Google keys are also accepted.
- Test the key before saving, and choose the writing model.
- Img.ly image editing keeps using Outstand AI.

## History and audit trail

- Each post has a History panel showing edits with version restore, comments, approvals, boosts, AI-written
  replies, and publishing results.
- Workspace Admins get an audit log with filters and CSV export.

## Notifications

Novu delivers notifications.

- Channels: in-app notification inbox and email for everyone.
- Slack, Discord, and Teams can be connected per workspace to post to a channel.
- Each person chooses which events they receive and where.
- Email: right away, a daily digest, a weekly digest, or off. Turning email off keeps in-app notifications.
- A notification popover opens from the bell in the app shell, and a full notifications page shows history.

Events:

- Approval requested, approved, or changes requested
- Comment or mention
- Post published or failed
- Account disconnected
- New inbox messages

## Integrations

Workspace Admins connect integrations in **Settings, Integrations**.

| Integration | Purpose |
| --- | --- |
| MCP server | Let AI tools such as Claude, ChatGPT, and Cursor read the calendar and draft, schedule, and report on posts, within the connected person's role |
| Zapier | Triggers and actions for posts, approvals, publishing results, and inbox events |
| Make | The same triggers and actions as Zapier, as Make modules |
| n8n | An Outstand node for n8n cloud and self-hosted n8n |
| Slack, Discord, Teams | Post notifications to a channel |
| API keys | Keys for MCP, n8n, and custom scripts, with create, revoke, and last used date |

Actions taken through integrations follow approval settings and are recorded in the audit trail.

## Feedback and bug reports

- A **Feedback** button in the app shell opens a dialog to report a bug, suggest an idea, or send other
  feedback.
- Bug reports can include a screenshot of the current page, the page address, and browser details.
- The person can allow the team to contact them.

## Theme

- The design uses shadcn variable names, such as `--background`, `--primary`, `--border`, `--ring`,
  `--chart-1`, and `--sidebar`, with light and dark values.
- Four brand tokens, `--brand`, `--brand-strong`, `--brand-subtle`, and `--brand-foreground`, drive primary,
  focus, chart, and sidebar colors, so a rebrand changes only those.
- The theme board in the design file lists colors, type ramp, radius, spacing, elevation, and how each
  shadcn component maps to tokens.

## Onboarding

1. Create the organization on Basic.
2. Enter a website so Firecrawl can draft the brand kit.
3. Connect accounts, or send an account connect link to the client.
4. Create a first post.

## Design coverage

- Desktop-first.
- Responsive mobile designs for the Reviewer approval flow, notifications, and the inbox.
- Guest pages that open from a link, with no workspace membership: the review link and the account connect
  link. Both are designed for desktop and mobile.
- Use the Shadcn library in [Outstand.pen](../Outstand.pen) with a calm, neutral palette and one accent color, so
  social previews and media stand out.
- Stay distinct from Planable's layouts. The [Planable captures](../prior-art/planable/) are reference only.
