# Shopify Cart

The cart panel and cart page retain Shopify's section-rendering, line-item instructions, quantity rules, product
disclosures, presentment-currency money filters, and native checkout forms. `cart-lines.liquid` owns the shared
image-led product rows in both views; prices sit with product details and quantity/removal commands sit below.
Shared snippets render bundle contents, discount entry, order notes, and merchandise/shipping breakdowns.
`cart-experience.css` follows the approved cart compositions: a 560px panel, 80px product images, 44px controls,
and a desktop page with a 1248px content area and 360px summary column. Mobile uses a compact fixed checkout bar;
discounts, notes, and the detailed summary remain in the scrollable content. The cart page has a compact site header.

## Behavior

- Bundle disclosures use `line_item.item_components`. Component quantities come from Shopify and have no separate
  purchase controls. Changing a parent quantity updates the whole bundle.
- Quantity edits use the current line key with `/cart/change.js`, not `/cart/update.js`, so inventory is validated.
  Loading, inline errors, focus, and quantity resets belong to the initiating view. The other cart view refreshes too.
- Product adds, quantity changes, discount changes, and note saves share a request queue. Checkout is disabled during
  mutations and the quantity debounce interval. Failed requests restore controls and expose retryable feedback.
- Order notes use an explicit Save note action. Unsaved text survives cart refreshes and blocks checkout until saved.
  Successful saves synchronize non-dirty note editors. The existing `show_cart_note` setting controls availability.
- Discounts use Shopify's Ajax cart `discount` field, preserve other applicable codes, and confirm eligibility from
  `discount_codes`. Invalid codes do not produce invented savings. Automatic discounts remain Shopify-managed.
- The header cart link supports keyboard access, Escape, focus return, and modified-link navigation. Reduced motion
  does not depend on a transition event to establish focus containment. View cart links the panel to the full page.

## Boundaries

Shipping prices and eligibility are confirmed at checkout. The cart does not invent a free-shipping threshold,
rewards balance, gift eligibility, or editable weapon-builder contract. Rewards require a real integration. Line
properties and selected variants remain visible; product links provide the existing product-selection workflow.
The cart retains its commerce controller rather than migrating the unrelated sizing drawer lifecycle.

## Verification

Run the theme Vitest suite and Shopify Theme Check, then `pnpm verify`. Browser acceptance covers a regular product
and native bundle, panel/page synchronization, note persistence, invalid discounts, quantity request failure/retry,
empty recovery, keyboard focus, reduced motion, and desktop/mobile layouts. A valid discount must also be checked
against a configured Shopify code; mocked apply/remove tests do not establish real-store eligibility.