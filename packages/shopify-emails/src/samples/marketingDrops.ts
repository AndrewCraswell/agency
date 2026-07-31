/*
 * What a Shopify Email marketing message might hand a custom-code section.
 *
 * This is a weaker claim than `observedNotificationDrops`. There, 46 stock templates written by
 * Shopify are the evidence: a name they read is a name Shopify populates. Shopify Email ships no
 * comparable body of source, and its Liquid support is documented only as a short allow-list in
 * help articles, so nothing here is evidence of anything. It is a list of questions.
 *
 * The questions come from four places, and the probe's answer is what settles each one.
 *
 * Read by this store's 17 marketing templates. If any of these come back `null` the templates are
 * broken in production and nothing in the preview would ever have said so:
 *   customer, shop, unsubscribe_url
 *
 * Names notifications use for the same idea. Shopify Email and notifications are different
 * products, and `unsubscribe_link` versus `unsubscribe_url` is exactly the kind of drift that only
 * a live render catches:
 *   email, line_items, open_tracking_block, order, order_status_url, shop_link, shop_name,
 *   unsubscribe_link
 *
 * Things a campaign plausibly knows about itself. A discount code drop in particular would let the
 * welcome and win-back emails stop hardcoding one:
 *   abandoned_checkout_url, activation_url, campaign, checkout_url, discount_code, preview_text,
 *   subject
 *
 * Storefront drops. None of these should exist, and asking is cheap: if any of them answer, a
 * campaign is theme-shaped rather than notification-shaped and the whole component kit could read
 * live catalogue data instead of literals:
 *   all_products, articles, blogs, cart, collections, linklists, product, request, routes,
 *   settings, template
 */
export const candidateMarketingDrops = [
  "abandoned_checkout_url",
  "activation_url",
  "all_products",
  "articles",
  "blogs",
  "campaign",
  "cart",
  "checkout_url",
  "collections",
  "customer",
  "discount_code",
  "email",
  "line_items",
  "linklists",
  "open_tracking_block",
  "order",
  "order_status_url",
  "preview_text",
  "product",
  "request",
  "routes",
  "settings",
  "shop",
  "shop_link",
  "shop_name",
  "subject",
  "template",
  "unsubscribe_link",
  "unsubscribe_url"
] as const satisfies readonly string[]
