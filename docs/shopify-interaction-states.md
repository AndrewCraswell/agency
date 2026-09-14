# Shopify Interaction States

The component lab is the review surface for the theme's interaction overhaul. It must render production Liquid
snippets and load production CSS/controllers; fixtures must not submit orders, change store data, or send messages.
The approved styling lives in production component stylesheets. There is one canonical appearance, with no
Current/Proposal switch or lab-only interaction layer. The lab is not a substitute for real-store acceptance.

## State Contract

Every interactive element needs distinct rest, hover (fine pointers), keyboard focus-visible, and pressed states.
Selection is persistent state, not hover. Add disabled/unavailable, busy, success, error, and open/closed states only
where meaningful. Disabled controls must not animate as actionable. Preserve readable labels, contrast, 44px touch
targets, focus return, and layout stability. Decorative badges, prices, skeletons, and progress labels are not buttons.

Disabled buttons and checkbox labels use `cursor: not-allowed`. `ui-button` supports native `disabled` and `busy`
states; disabled link-style buttons omit their destination and are excluded from the tab order. Quantity controls
use native disabled states at their minimum and maximum. Unavailable variant values are natively disabled in pills,
swatches, and dropdowns. Their labels use the disabled cursor, and they cannot be selected by pointer or keyboard.

Keyboard focus uses a two-tone ring: a 2px dark outline with a 3px white separation ring. This remains distinguishable
on light and dark surfaces and does not change layout. Forced-color mode uses the system highlight. Hover and selected
styles never substitute for focus. Native privacy dialogs retain focus containment and dismissal behavior.

The search input uses its rounded field boundary as the focus indicator, without an additional inner outline.
On desktop the enclosing field owns that indicator; on mobile the input owns it. Clear and Search buttons keep
their own keyboard focus rings without also highlighting the enclosing field. Component-specific focus rules take
precedence over the low-specificity shared focus treatment.

Standalone predictive search exposes named, nonmodal dialog popups containing native headings, lists and links,
not nested interactive listbox options. The combobox controls the active idle/results popup, with unique IDs per input.
The header already has a modal search dialog, so its native search input controls result regions without nested dialogs.
Arrow keys move real focus between results, Up from the first result returns to the input, and Enter follows the
focused link. Tab uses the native tab order. Escape dismisses the popup and returns focus to the input; the header
modal retains its outer dismissal/focus-return contract. Closing popup contents are inert.

Search panels use a 220ms fade/8px slide on entry and 160ms on exit, including the header scrim. CSS discrete
visibility transitions allow reversal without delayed close callbacks; browsers without that support dismiss
immediately. Closing contents are inert, while the header retains its last layout through the fade. Dismissed or
superseded requests cannot reopen the panel, and new result content does not replay its entrance. Reduced motion
disables the transitions. The anchored dropdown shares 20px/24px gutters across idle, loading, results and footer;
the full-bleed header's 96px desktop gutters are scoped to the header rather than leaking into wide dropdowns.

## Shared Controls

- `ui-text-field` owns single-line and multiline controls, labels, currency prefixes, validation associations and
  disabled/readonly states. Price ranges, contact fields and cart note/discount entry render it directly. Consumers
  provide layout and controller hooks, not another field border or focus treatment. `ui-button` supplies their actions.
  Multiline text padding is shared with a 3px inner gutter, placing the native resize grip 4px inside the outer edge
  so the rounded border does not clip it. The field's text inset and minimum height stay unchanged.
- `ui-checkbox-field` renders native checkbox and radio inputs using its `type` parameter. Filter checkboxes and input
  specimens share the .pen's 18px checkbox, 5px corners, 12px copy gap and 8px-radius row; radios have a 20px ring and
  10px selected dot. Whole rows are clickable with a 44px minimum height and 6px between adjacent rows so selected
  and hovered backgrounds do not touch when using `variant: 'filter'`. Only collection filters opt into the gray row
  background; default checkbox/radio fields and cookie preferences remain unfilled for selected, hover and pressed
  states. Their indicators retain border, selection, focus and pressed feedback. Selected, hover, pressed, keyboard focus and
  disabled states are distinct, with no transform under reduced motion. `name` and native `value` support form
  submission/radio grouping; existing `data-action`/`data-value` hooks continue to support cookie consent. Optional
  `count`, `required`, `described_by` and `invalid` preserve field semantics. Collection inputs retain native disabled
  states and Shopify add/remove URLs, while the lab uses its local catalog adapter.
- `ui-select` and `ui-select.js` own the dropdown trigger, popup, checkmark, 6px row gaps and inset 16px chevron for
  product variants, Topic/Size, the drawer example and sorting. `ui-sort-dropdown` only supplies sort options and its
  form wrapper. A native select remains the form-value/option-metadata source and the no-JavaScript control; enhancement
  replaces its visible popup with the shared listbox. Arrow/Home/End keys and typeahead highlight options, Enter/Space
  commit, and Escape/outside click cancel. Disabled options are skipped. Input/change events update existing consumers,
  reset restores the default selection, and required errors focus the visible trigger. The optional leading slot
  preserves product swatch previews. There is no separate sort controller or duplicate native popup after enhancement.
- `swatch-input` and `swatch` render both product color radios and collection filter checkboxes. Both share 28px swatches
  within 38px-wide, 44px-high targets: the visible circles have the .pen's 10px gap. Selection/focus/disabled styling is
  shared. Collection values navigate their Shopify filter URLs while
  preserving breadcrumb context; no-JavaScript links remain available. Collection Color/Colour filters are routed by
  parameter name and share the native-swatch-first renderer. Standard color names and recognized two-color pairs
  have representative swatches; unsupported unselected colors are omitted. Active unsupported colors remain labelled
  only so they can be deselected. Product selection behavior is unchanged.
- `ui-choice` renders product radio labels and size-chart toggle buttons using the same pill geometry. Product options
  remain single-select; chart comparison remains multi-select. Collection Size options use this same primitive as
  native multi-select checkboxes, with wrapping for long source labels. The label span uses cap-height text-box trimming to
  center visible letters/digits rather than the font's extra descender space. `ui-segmented-control` is a two-option native radio
  control with a sliding selected segment; sizing uses it for cm/in and honors reduced motion.
- The desktop filter sidebar is permanently open. Only the mobile filter panel has a disclosure. Mobile-menu list
  resets belong to `component-menu-drawer.css`, not the surrounding header; its accordion layout retains the design's
  32px/48px/64px nesting insets. Announcement arrows retain 44px targets inside the banner gutters.
  Expandable mobile categories are full-row disclosures, not links; only leaf items navigate. A child that repeats
  both its parent's name and URL is flattened into its children, avoiding redundant Weapons/Masks levels while
  preserving destinations. Mobile announcements use the design's 11px
  vertical padding and a separate CTA line, with no additional lab specimen padding. Longer copy may wrap and the
  carousel reserves the tallest slide's height to prevent layout jumps.
- `collection-filter-header` is rendered by both the storefront and lab. Filters and Clear all share one row; its
  69px minimum height and 12px vertical padding match the collection toolbar, align their bottom rules, and keep
  the sort control clear of the divider. The first facet group adds no
  duplicate top border. The mobile disclosure keeps its own Clear all action. Collections do not show a second row
  of active-filter pills: deselect checkboxes/swatches, clear the price fields, or use Clear all in the sidebar.
  Curated collections use full-page URL navigation, not Dawn's AJAX facet refresh (which requires different markup).
  Sorting retains active filters and breadcrumb context; price changes retain other filters and sorting. Both reset
  pagination. Clear all is a native link that removes filters and pagination while retaining sorting and breadcrumbs.
- Mega-menu triggers have no hover fill or underline. Text emphasis and caret rotation supply hover/open feedback;
  keyboard focus remains visible in the foreground color. The lab renders default, inverted and transparent examples
  from the same snippet with unique ID prefixes. The transparent specimen uses a local photo backdrop, and open panels
  retain their own readable surface colors in all three examples.
- Product galleries use the .pen Main Gallery component's 14px main-image corners and 10px thumbnail corners.
  The image clipping follows the local radius rather than the global zero-radius media setting. Zoom imagery uses
  the same 14px radius on desktop and mobile, while the fullscreen overlay stays square. No separate zoom-overlay
  design was found in the .pen; this is a consistent image treatment, not a claim of a pixel-identical zoom layout.
  The zoom button explicitly covers the image and is excluded from generic pressed translations. Transforming Dawn's
  former zero-size button changed the containing block of its pseudo-element hit area and discarded pointer clicks;
  acceptance must exercise an actual image click/tap as well as keyboard activation.

Field API: `id`, `name`, `label`, `value`, `type`, `placeholder`, `prefix`, `inputmode`, `autocomplete`, `autocapitalize`,
`form_id`, `described_by`, `required`, `invalid`, `disabled`, `readonly`, `hide_label`; multiline adds `multiline`,
`rows`, `maxlength`. Price fields also pass `range_min`/`range_max` as controller data. Selects accept captured trusted
`options` and optional `leading` markup. Choice/button `additional_props` and segmented `input_attributes` are trusted
template-owned hooks, never customer-supplied HTML. Callers must provide unique IDs and localized labels.

## Inventory

| Family | Production components | Additional states and transitions |
| --- | --- | --- |
| Commands | `ui-button`, Dawn `buy-buttons`, cart checkout, form submit, quick add | Disabled, busy, success, error; retain width while label/spinner changes |
| Icon actions | Header menu/search/account/cart, close, remove, share, copy, gallery controls, filter/reset | Tooltip/accessibility name, pressed, disabled; no hover-only meaning |
| Links | `ui-link`, breadcrumbs, footer/social/contact links, support-band links | Visited where appropriate, current, download feedback; underline/arrow movement without layout shift |
| Product options | `product-variant-picker`, `product-variant-options`, `swatch-input`, `swatch` | Selected, selected-hover, unavailable, unavailable-selected, focus, variant-loading; compare Dawn pills with a larger softened brand shape |
| Quantities | `quantity-input`, cart steppers, quick-order rows, volume-pricing controls | Min/max, blocked by inventory, busy, rejected/reset; announce accepted quantity and totals |
| Pills and tabs | `ui-pill`, journal filters, search category tabs, size-chart units/sizes | Selected/current, disabled, keyboard navigation appropriate to semantics; do not make static pills clickable |
| Checkboxes and fields | `ui-checkbox-field`, cookie preferences, gift-card recipient form | Checked, indeterminate where used, disabled, invalid, required, autofill, validation success |
| Text entry | Search, contact/newsletter, cart note/discount, price range, account forms | Empty, filled, focused, invalid, submitting, saved; errors next to the field, retain input on failure |
| Sort and filters | `ui-sort-dropdown`, collection toolbar/facets, price facet, show-more | Open/closed, selected, applying, cleared, no results; focus restoration and outside/Escape dismissal |
| Mega menu | `header-mega-menu`, `mega-menu-body`, columns/cards, weapon/kit panels | Trigger hover/focus/open/current; delayed pointer exit, diagonal travel, sibling switching, Escape, outside click, touch tap; panel fade/short translation and icon rotation |
| Mobile navigation | `header-drawer`, nested navigation, language/country selectors | Open/closed, nested/back, active route, scroll lock, focus containment/return; no desktop-hover dependency |
| Search overlays | `header-search`, `ui-search-form`, predictive idle/results/skeleton, `ui-page-result-row` | Open, typing, loading, grouped results, highlighted result, empty, error; cancel stale results |
| Drawers/dialogs | `ui-drawer`, cart panel, product/media/disclosure modal, pickup, cookie preferences | Enter/exit, interrupted transition, focus trap/return, backdrop, Escape, reduced motion; no stale close callback |
| Disclosures | `ui-faq-item`, product accordions, cart bundle/note, sizing groups/help/tape, quantity popover | Open/closed, expanded icon, keyboard activation; adjacent controlled region; avoid jumping scroll |
| Linked cards | `ui-product-card`, category/page/contact cards, article cards, featured picks, mega-menu cards | Card link hover/focus, independent action states, media treatment, sold out, selected where meaningful; no nested links |
| Pagination | `ui-pagination`, load-more, search pagination | Current, previous/next disabled, busy, error; preserve scroll and announce new results |
| Galleries/carousels | Product media/thumbnails/zoom/video/model, hero/testimonials, related products | Selected slide, previous/next boundaries, play/pause, loading/error; pause autoplay on interaction and reduced motion |
| Cart | Shared rows, bundle contents, discounts, notes, subtotal, checkout | Updating, stock limit, unavailable, failed/retry, empty, saved; serialize price-changing requests and preserve focus |
| Consent | Cookie banner, accept/reject/manage, preference switches/save | Open, changed, saving, persisted; no misleading selected/disabled state |
| Feedback | Alerts, toasts/status text, stock indicators, savings, progress/skeleton | Entry/exit, indeterminate/determinate, success/error; announcements without forced focus; no perpetual decorative motion |
| Planned commerce | Weapon/kit builders, gift selection, rewards | Selected parts, incompatible choice, incomplete/ready, threshold earned/lost; implement only with real domain rules |

## Motion And Geometry

- `ui-button` uses 15px text, a 6px radius and a 44px minimum height, including search and support-band actions.
  Icon buttons have 44px square targets. Disabled/busy semantics live in the shared snippet, and inverted support-band
  colors remain owned by that component.
- Production `--ui-motion-fast`, `--ui-motion-enter` and `--ui-motion-ease` tokens provide 120ms feedback,
  220ms entrance and `cubic-bezier(0.2, 0, 0, 1)` easing. Buttons press by 1px; link arrows move 2px while preserving
  their direction. FAQ answers enter with a 6px fade/slide. Localization and pagination targets are at least 44px high.
- The mega menu retains its 220ms pointer-close delay and diagonal-travel tolerance. It now has 220ms entry and
  160ms exit motion, with a 140ms cross-fade when switching siblings rather than repeating the slide-in. Outgoing
  content is inert during the cross-fade. Escape and interrupted closes preserve focus and state. Reduced motion
  closes immediately. List resets and inline chevrons no longer depend on the surrounding header template.

Animate transform and opacity where possible; avoid `transition: all`, layout-changing hover effects, large lifts
on utilitarian controls and repeated decorative animation. Component owners retain specialized focus/press rules
for search fields, dropdowns, menu triggers, choices and media hit targets.

Reduced motion removes translation, scaling, autoplay, and stagger, but must retain immediate state feedback.
Focus styling must remain visible regardless of motion preference. Never wait for an animation event to unlock input.

## Lab Coverage

Collection filters come from Shopify Search & Discovery, not the theme's catalog fixtures. Add the existing product
option Color as a filter under Apps > Search & Discovery > Filters for text-based color choices. For color swatches,
configure a supported category/product/variant metafield filter with visual swatch data; the theme renders Shopify's
`filter.presentation` and `value.swatch` without inventing colors. Only relevant configured filters appear per collection.
Shopify does not show the native price filter outside the shop's default currency. See
[Shopify's filter requirements](https://help.shopify.com/en/manual/online-store/search-and-discovery/filters).

Run `pnpm --filter @repo/fc-theme-base lab`. The loopback server prints its available local URL; optionally set
`COMPONENT_LAB_PORT` for a fixed port. It requires no Shopify login. Refresh after editing snippets, CSS, or fixture
files; restart after changing the server. Use the browser's responsive viewport tools for mobile/tablet comparisons.
The lab renders production styling directly, with default, inverted and transparent header examples retained.
The Reduce motion switch suppresses specimen transitions and makes drawer motion effectively immediate;
the operating-system preference is honored independently by production styles and controllers.
Reset examples reloads fixtures. Buttons simulate asynchronous success/failure; links never leave the fixture routes.

The utility chrome is separate from the white, brand-font specimen surfaces. No lab assets are placed in the theme's
deployable assets, snippets, sections, or templates. POST requests are rejected. Asset serving is confined to approved
folders, and fixtures load no remote scripts or live cart endpoints.

The lab and storefront share `theme-tokens.liquid`; the lab resolves values from the actual settings schema and
current preset. Matching storefront font files are served locally. Each specimen loads its production stylesheet,
including the contact-card and search-result styles, rather than inheriting generic lab card rules.

The lab covers buttons, text links, pills, checkbox fields, Dawn variant-style controls, quantity controls, FAQ,
the shared drawer, all mega-menu families, and custom product/search/skeleton/article/category/page/contact cards.
Full section specimens include featured products, category grid, featured picks, editorial/trust content,
testimonials, journal highlights, and the support band. Card and section copy is fixture content, not customer claims.

Privacy uses the production banner, dialog, required/optional categories, and controller with an in-memory API.
Show cookie banner resets the fixture to undecided; acceptance, rejection, preferences, busy and failed saves can be
tested without writing consent to Shopify. Required cookies remain checked and disabled. Reset clears all fixture
state. The lab never loads the live Customer Privacy API.

The expanded lab also includes breadcrumbs, Journal filters, pagination, collection checkbox/swatch filters, price
limits, sorting, sidebar filter deselection, search idle/results/skeleton/empty/error states, announcement tones and
carousel controls, country/currency and language selectors, contact-field patterns, price/swatch/dropdown variants,
cart bundle/note/discount details, mobile nested navigation, product thumbnails/zoom, source-backed sizing controls,
downloads, policy contents/responsive tables, and footer utilities.

The local search fixture supplies a popular-categories menu through the same `linklists` setting lookup used by the
storefront. Idle and no-results states share five local shortcuts from the existing catalog navigation; these are
fixture categories, not measured popularity rankings or changes to the store's configured menu.

Catalog filtering uses a deterministic local response adapter, not Shopify's facet request lifecycle. Predictive
search retains the production presentation and keyboard controller with a local transport/recent-history adapter.
Localization uses production dropdown behavior but replaces each fixture form's submission with local selection.
Cart details and contact submissions simulate feedback only; no real discount is accepted and no message is sent.
Full cart/checkout integration, pickup, gift-card recipients, quick-order commerce, video/3D, and app blocks still
require store-specific acceptance. The inventory does not claim those integrations are verified.
Automated accessibility scans are paired with keyboard, motion, and mobile checks; they do not establish complete
WCAG conformance or replace assistive-technology testing.