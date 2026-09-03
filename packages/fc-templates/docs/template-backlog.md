# Template backlog

Findings from a review of all 53 React templates and the 33 shared components on 2026-07-30. Nothing here is a
regression; it is the work between a design that renders correctly in a preview and a library that survives a real
inbox. Ordered worst-first within each group.

## Deliverability and rendering

### Emails are at the Gmail clip limit

`marketing_novus_launch` compiles to 102.6 KB. Gmail truncates a message past roughly 102 KB and replaces the tail with
a "View entire message" link, which drops the closing call to action **and** the open-tracking pixel, since
`open_tracking_block` is the last child of `EmailDocument`. `marketing_season_kickoff` (97.5 KB),
`marketing_tournament_prep` (85.8 KB) and `marketing_choose_your_weapon` (85 KB) are close behind.

Target is under 80 KB. Hosting the icons and extracting the repeated type styles get most of the way there on their own.
A size assertion over `allTemplates` should keep it there.

### Icons are base64 data URIs

`src/emails/components/lineIcons.ts` is 38 KB of base64 and `socialIcons.ts` another 8.6 KB. Gmail, Outlook.com and
Yahoo all refuse `data:` image sources, so every `IconChip` and every footer social icon renders as an empty box for the
majority of readers. It is also the main reason for the size problem above.

The fix is to upload the 21 PNGs to Shopify files and reference them through `file_url`. That needs admin access, and it
needs the CLI `assets` command and the preview shim described under `## Planned` in `@repo/shopify-emails`.

### `object-fit` does nothing in Outlook

Eight components set `objectFit: "cover"` on an `Img`. Outlook on Windows renders through Word, which ignores it, so
heroes and product shots stretch to the declared `width` and `height` instead of cropping.

Crop in the URL instead — `fit=crop` today, Shopify's `image_url: width:, height:, crop:` once the photos move — and
treat `objectFit` as a progressive nicety rather than the mechanism.

### `rgba()` chrome disappears in Outlook

`rgba(255, 255, 255, 0.1)` backs the `CtaBand` chip and code pill, the `OfferBand` code pill, the `translucent`
`MarketingChip` and the dark `SpecStrip` divider. Outlook 2016 through 2021 ignores `rgba` and renders those elements
transparent, so the pills vanish into the black band behind them.

Use a solid hex blend instead and name it in `tokens.ts` beside the other colours.

### Photos hotlink Unsplash

Every photograph points at `images.unsplash.com` with tracking parameters. There is no SLA, no cache control, and
Unsplash can retire a photo out from under a sent campaign. Move them to Shopify files before launch and keep Unsplash
for preview samples only.

## Content and data

### `vacationDelay` hardcodes an order

`marketing_vacation_delay` writes "Order #FC-1042", "3 items / $214.00" and the away dates as literal text. It is
transactional in substance but sits in the marketing scope, so it cannot be sent for a real order. Either move it under
`notifications/` and read the `order` drops, or lift the dates into one exported constant a store owner can edit.

### No subject line personalises

All 17 marketing subjects are static strings. Shopify accepts Liquid in a subject. `winBack`, `backInStock`,
`reviewRequest` and `coachDiscount` each address one reader about one thing and should say their name.

### Two templates name data they never read

`backInStock` and `reviewRequest` name a specific product and order in their copy but read nothing from the scope, so
neither can actually be sent per-customer as written. Thread a `product` and an `order` drop through their samples, the
way `coachDiscount` already uses `customer.email`.

### Product URLs are hardcoded

Eight templates spell out `https://fencing.club/products/…` inline, next to a `shopLinks` map in `tokens.ts` that exists
for exactly this. Add `productLinks` and `collectionLinks` beside it so a domain change is one edit.

## Code structure

| What | Where | Change |
| ---- | ----- | ------ |
| A `shot()` photo-URL builder redeclared with three different signatures | 8 marketing templates | One `photo(id, { w, h })` helper |
| `contentWidth`, `cardGap` and the `Math.floor` width split | `ProductCards`, `ArticleCards` | Extract `columnWidths(count)` |
| 2×N grids built by stacking two or three `ProductCards` calls with hand-tuned `spacing` | `newArrivals`, `winBack`, `tournamentPrep` | A `columns` prop that chunks internally |
| The same `bg + 1px line + radius + padding` card chrome with `dk-card dk-border` | `OptionCards`, `IconCards`, `ArticleCards`, `Testimonials`, `ProductFeature`, `HelpCard` | A `Card` primitive taking `tone` and `padding` |
| Four text styles (kicker, title, muted body, tag) respelled as inline objects about 40 times | Everywhere | `text.kicker`, `text.title`, `text.body`, `text.tag` in `tokens.ts` |
| A 60-line order-recap card built inline from `Section`/`Row`/`Column` | `vacationDelay` | Leave it until a second email needs it |

## Tests

### No `.tsx` file is testable or measured

`vitest.config.ts` sets `include: ["src/**/*.test.ts"]` and `coverage.include: ["src/**/*.ts"]`. Both exclude `.tsx`, so
the 80% coverage threshold is measured against the Liquid engine alone; all 33 components and 53 templates sit outside
it, and a component test could not run even if somebody wrote one. Add `*.test.tsx` to `include` and `src/**/*.tsx` to
the coverage `include`.

### Snapshots assert shape, not meaning

Whole-document snapshots are the only coverage templates have, so a token tweak rewrites 53 files and nothing catches a
missing unsubscribe link, an empty `href` or a dropped `alt`. Add invariants over `allTemplates`: every template renders,
every anchor has a non-empty `href`, every image has `alt` and `width`, every marketing email contains
`unsubscribe_url`, and every rendered document is under 100 KB.

## Dark mode and accessibility

- `StatusStrip` and `NoticeBox` carry no `dk-` class, so Outlook.com's `[data-ogsc]` inversion recolours their text
  without recolouring the tinted background behind it.
- `IconChip` always renders `alt=""`. That is correct everywhere it is used today, because a label always follows it.
  Worth a comment on the component so nobody "fixes" it.
