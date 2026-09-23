# Outstand integrations

Part of the [product overview](product-overview.md). This page records which service provides each capability
and what Outstand must build itself.

## Platform services

| Service | Provides | Outstand builds |
| --- | --- | --- |
| [WorkOS](https://workos.com/) | Organizations, sign-in, invitations, roles, and Enterprise SSO | Workspace membership and role rules, Reviewer view, and connect links |
| [Stripe](https://stripe.com/) | Subscriptions, invoices, payment methods, and upgrades | Plan limits for workspaces and accounts, and upgrade prompts |
| [Velt](https://velt.dev/) | Comments, staged approvals, and audit trail | Approval settings per workspace, Internal comments, and the History panel |
| [Zernio](https://zernio.com/) | Social connections, publishing, scheduling, recommended times, comments, messages, boosts, and analytics | Preview mocks, rule checks for each platform, combined post results, and the inbox experience |
| [Novu](https://novu.co/) | In-app, email, and chat notifications, preferences, and digests | Event definitions and the notification settings screens |
| [IMG.LY](https://img.ly/) | Image and video editing, design templates, and AI editing tools | Brand locking from the brand kit and the composer layout |
| [Firecrawl](https://www.firecrawl.dev/) | Reading a website to find brand details | Brand kit draft and review screen |

The Preview tab is Outstand's own work. Zernio publishes and Img.ly edits, but neither provides previews for every
platform.

## Supported social platforms

Outstand supports every platform Zernio supports, including Instagram, Facebook, LinkedIn, TikTok, YouTube,
X, Threads, Pinterest, Reddit, Bluesky, Google Business Profile, Snapchat, Telegram, WhatsApp, Discord, and Slack.
Each platform needs its own preview mock, post types, and settings in the design.

Comment, message, analytics, and boost support differs by platform. The design should show what each connected
account supports instead of assuming every feature works everywhere.

## Storage and design imports

| Source | How it works |
| --- | --- |
| Google Drive | Pick files and copy them into the media library |
| Google Photos | Pick photos and videos with the Google Photos Picker. Google no longer allows apps to browse a full library |
| OneDrive | Pick files and copy them into the media library |
| Canva | Export a design and copy it into the media library |
| Figma | Export frames and copy them into the media library |

Imported files remember their source so they can be re-imported.

## Notification channels

Slack, Discord, and Teams can be connected per workspace through Novu to post notifications to a channel.

## AI providers

AI writing and Img.ly AI editing use Outstand's provider and are unlimited in the current release. A workspace can
add its own provider key when preferred. Image generation is deferred and will have separate usage limits when it is
introduced.
