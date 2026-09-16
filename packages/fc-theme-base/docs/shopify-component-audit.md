# Shopify Component Audit

Scope: the complete snippet inventory and the UI-owning sections/controllers in `packages/fc-theme-base`. This is a
component and fixture audit, not approval of every inherited Dawn layout or a certification of live Shopify flows.
The component lab renders the approved production appearance directly. No comparison mode or store credentials are needed.

## Rendered Families

| Family | Production owners | Lab coverage |
| --- | --- | --- |
| Commands and focus | `ui-button`, `ui-link`, `ui-icon`, `fc-icon` | Button/link/icon variants; hover, press, keyboard focus, disabled, busy, success/failure |
| Options | `product-variant-options`, `swatch-input`, `swatch`, `ui-pill`, `ui-checkbox-field`, `quantity-input` | Pills, dropdowns, swatches, native checkboxes and grouped radios, unavailable values, hover/press/focus, quantity boundaries |
| Navigation | `ui-breadcrumbs`, `ui-pagination`, `journal-tag-filter` | Short/long trails, current page, previous/next, page selection, next-only pagination, tag selection |
| Catalog controls | `collection-filter-header`, `collection-facet-filters`, `ui-checkbox-field`, `price-facet`, `collection-toolbar`, `ui-sort-dropdown`, `ui-select`, `ui-select.js` | Aligned filter/results headers, shared checkbox/swatch inputs and dropdown popup, unavailable options, price limits, selected-filter removal, clear, mobile disclosure, local counts/results/pagination |
| Catalog feedback | `ui-product-card`, `ui-product-card-skeleton` | Matching products, no results, busy, failed request/retry; most recent local request wins |
| Search | `ui-search-form`, `predictive-search-idle`, `predictive-search-categories`, `predictive-search-list`, `predictive-search-skeleton`, `predictive-search` section, `search-form.js`, `predictive-search.js` | Empty input, local recent history, grouped suggestions/categories/products/guides, clear, loading, empty, failed/retry, arrow selection, Enter and Escape |
| Desktop menus | `header-mega-menu`, `mega-menu-body`, `mega-menu-columns`, `mega-menu-card`, `details-disclosure.js` | Default/inverted/transparent specimens, every configured menu family, pointer travel, sibling switching, keyboard, outgoing inert state |
| Mobile menus | `header-drawer`, `global.js` | Full-row parent disclosures, leaf navigation, redundant self-group flattening, Escape/focus return; uses a contained header fixture |
| Announcements | `announcement-bar`, `slideshow-component`, slider/slideshow CSS | Single message, four-message manual carousel, announcement/sale/event/vacation tones; copy explicitly identifies promotion-tone examples |
| Localization | `country-localization`, `language-localization`, `localization-form.js`, flag sprite | Country or region with currency code/symbol, language, selected item, keyboard arrows, Escape/focus return; no actual market or locale change |
| Contact fields | `ui-text-field`, `ui-select`, `ui-select.js`, `contact-form` | Shared dropdown popup, empty/filled/required/invalid, textarea, disabled, readonly, optional checkbox, busy, success/failure with retained input |
| Product pricing | `price`, `unit-price` when configured | Regular, comparison/sale, sold-out price and badges; fixture amounts, not offers |
| Cart details | `cart-item-contents`, `cart-note-editor`, `cart-discount` | Native bundle disclosure, note entry/save feedback, discount input/pending/invalid feedback; no cart mutation |
| Images and zoom | `product-media-gallery`, `product-thumbnail`, `product-media`, `product-media-modal`, `media-gallery.js`, `product-modal.js` | Image selection, thumbnails, modal zoom, dismissal/focus return; real local image assets |
| Sizing | `size-chart-content`, `size-chart-validity`, `measuring-tape-downloads`, `size-chart.js` | Actual approved chart data/illustration, cm/in, compared sizes, empty selection, measurement help, PDF links |
| Reading | `main-policy`, `policy-page.js` | Contents links, mobile contents disclosure, responsive semantic table, back to top; sample text is not a legal policy |
| Disclosures and overlays | `ui-faq-item`, `ui-drawer`, `ui-drawer.js` | Native expanded content, modal focus, backdrop/Escape, interruptible motion, reduced motion |
| Linked cards | `ui-product-card`, `ui-article-card`, `ui-category-link-card`, `ui-page-link-card`, `ui-contact-intent-card`, `ui-contact-quick-answer`, `ui-page-result-row`, `featured-pick-card` | Product/home/search, skeleton, article dates, category/page/contact cards, static quick answers, independent link actions |
| Sections | `best-sellers`, `category-grid`, `featured-picks`, `why-us`, `testimonials`, `journal-highlights`, `ui-support-band` | Image-led merchandise/editorial sections, testimonial navigation, inverted action states |
| Privacy | `cookie-consent`, `cookie-consent.js` | Banner, required/optional preferences, accept/reject/manage, saving/failure/retry/reopen using an in-memory API |
| Utilities | `social-icons`, `share-button`, `ui-kbd`, `ui-badge`, `loading-spinner` | Social accessible names, share/copy disclosure, keycaps, badges/spinners via consumers; OS share/clipboard remain browser capabilities |

## Remaining Source Dispositions

These files were included in the audit rather than silently omitted or represented by nonfunctional buttons.

| Sources | Disposition |
| --- | --- |
| `cart-lines`, `cart-subtotal`, `cart-checkout`, `cart-drawer`, `cart.js`, `cart-controls.js`, `cart-drawer.js` | Existing full cart implementation and separate regression tests. A component lab must not impersonate authoritative stock, totals, eligibility or checkout. Detail specimens are local; full cart acceptance stays on the development store. |
| `buy-buttons`, `gift-card-recipient-form`, pickup availability section/controller | Depend on native product form, Shopify endpoints and merchant configuration. Button/field states are represented, but purchase, gift-card delivery and pickup promises are not simulated as verified. |
| `quick-order-list`, `quick-order-list-row`, `quick-order-product-row`, `quick-order-list`/`bulk-quick-order-list` sections, quick-add/volume-pricing controllers | Optional bulk commerce surfaces. Reuse quantity, price, field and status contracts; require real variant/quantity-rule fixtures and a dedicated commerce harness before claiming working bulk orders. |
| `card-product`, `card-collection`, `article-card`, `pagination`, `facets` | Inherited Dawn alternatives used by configurable base sections. Custom Fencing Club equivalents are the review targets; do not create another competing component system. Native facet AJAX and show-more behavior are not covered by the local catalog adapter. |
| `header-dropdown-menu`, `header-search` | Alternate header composition and the outer search shell. The mega/mobile menus and the shared search internals have specimens; sticky-header/search-shell integration still belongs to storefront acceptance. |
| `product-variant-picker`, `size-chart-flyout`, `size-chart-directory`, `size-chart-directory-group` | Existing product/directory compositions around the represented option/chart/drawer primitives, with dedicated sizing tests. Do not duplicate their domain data or build a second chart implementation. |
| `product-disclosures`, `cart-disclosure-indicator`, disclosures section/controllers | Merchant/platform disclosure data and context-dependent modal/tooltip presentation. Reuse the native disclosure/focus contract; fixtures must not invent legal or safety claims. |
| `cart-notification`, notification product/button sections, cart icon/live-region sections | Alternate cart notification shell and section-rendering fragments. Not independent navigation or purchase workflows. |
| `icon-accordion`, `icon-with-text`, `shop-contact-details`, `shop-phone`, `progress-bar` | Small content/presentation compositions. Keep them noninteractive unless they contain real links or commands; progress must reflect actual work rather than decorative perpetual motion. |
| `collection-context-url`, `meta-tags`, `structured-data`, `theme-tokens` | Nonvisual helpers, metadata or shared environment. No artificial visible specimen is needed. Tokens are rendered by the lab itself. |
| Deferred video, external video, product model/XR, app blocks, accelerated checkout | Platform/media integrations requiring real assets or SDKs. Image-gallery coverage is not a claim that these work offline. |
| Image banner, hero, slideshow, collage, collection list, multicolumn/multirow, rich text, related/featured content, brand logos | Section compositions, not new primitive families. Existing cards, links, media and carousel specimens expose their reusable interaction contracts; page-specific editorial layout remains a separate review. |
| Newsletter/password/customer/account and checkout surfaces | Field/button patterns are represented. Real subscriptions, authentication and checkout require platform acceptance; Shopify customer accounts are not owned by this theme's Liquid component library. |

## Component Candidates

- Shared fields, enhanced dropdowns, product/chart choice pills and product/collection swatches are now implemented and
  adopted by the touched consumers. See [Shared Controls](shopify-interaction-states.md#shared-controls) for ownership
  and APIs. Search retains its specialized composite field. Newsletter/account forms are not yet migrated.
- One quantity primitive for PDP, cart and quick-order contexts. The circular hover treatment is shared; dimensions
  and commerce ownership are not yet consolidated. Do not describe that earlier proposal as implemented.
- A shared inline status/error wrapper, with polite status versus assertive error semantics and optional retry.
  Domain controllers still own pending state, retained input and errors.
- Collection selections are managed directly in the sidebar with native checkbox/swatches, price fields and Clear all;
  no additional active-filter chip row is needed.
- Shared menu/disclosure motion tokens and focus rules. Native details, listbox options and modal dialogs must keep
  their distinct keyboard contracts rather than being forced into one generic dropdown controller.

## Fixes Exposed By The Audit

- Collection filters originally used decorative boxes beside links. They now render shared native checkbox/swatch
  inputs with real checked/disabled semantics, consistent pointer/keyboard states and URL-based filtering. Enabled
  options retain links when JavaScript is unavailable.
- Sorting lacked arrow/Home/End navigation, focus return and synchronized accessible selection/expansion labels.
- Localization assumed a header and menu drawer always existed. Optional surrounding elements no longer cause throws.
- Search interpreted previous queries as regular expressions and assumed at least one visible option. Literal query
  handling and empty-option guards cover those cases.
- Search results now use named dialog popups with native result links, lists and headings. Keyboard navigation moves
  real focus, avoiding interactive links nested inside listbox options. Popup and heading IDs are scoped per input.
- Gallery thumbnails escaped the generated image element, exposing markup instead of rendering an image.
- Mobile navigation rewrote Mens/Womens to different labels. It now preserves the approved menu spelling.
- Mobile-menu lists now own their reset; price fields no longer depend on Dawn floating labels; cart and contact
  controls no longer override shared input/button styling. Sort rows have explicit gaps, and announcement arrows no
  longer inherit negative margins against zero-gutter edges.

## Boundaries

All catalog and search responses are loopback-only GET requests; POST requests remain rejected. Search transport and
recent history are locally adapted, localization replaces only fixture form submission, and form/cart feedback does
not leave the page. No orders, messages, discounts, consent writes, market changes or store configuration changes are
performed by these fixtures. Reset reloads the production examples and resets local specimen state.

Component tests cover rendering, deterministic fixture behavior and targeted controller contracts. Browser checks
must also cover actual pointer/keyboard behavior, desktop/mobile layout, accessible names and reduced motion.
Neither this inventory nor an automated accessibility scan establishes full WCAG or assistive-technology conformance.