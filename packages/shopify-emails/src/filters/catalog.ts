/*
 * Which Liquid filters a notification template may use.
 *
 * Shopify documents 154 filters, but the reference covers themes: notification templates are a
 * narrower, undocumented surface that has no cart, no theme settings and no asset pipeline. Naming
 * a filter that surface lacks produces no error on Shopify, only a blank space in a customer's
 * inbox, so the catalog is what turns that into a build failure instead.
 *
 * The list is checked against Shopify's own published data in `catalog.test.ts`, so a filter added
 * upstream shows up as a failing test rather than as a gap nobody noticed.
 */

export type FilterStatus =
  /** Available in a notification, and the preview reproduces it. */
  | "supported"
  /** Documented by Shopify, but not reachable from a notification template. */
  | "unavailable"
  /** Believed available, unproven on a real store, or previewed only approximately. */
  | "unverified"

export type FilterEntry = {
  readonly status: FilterStatus
  /** Why it is not available, or what remains unproven about it. */
  readonly note?: string
}

const supported = [
  "abs",
  "append",
  "article_img_url",
  "at_least",
  "at_most",
  "base64_decode",
  "base64_encode",
  "base64_url_safe_decode",
  "base64_url_safe_encode",
  "camelize",
  "capitalize",
  "cdn_asset_url",
  "ceil",
  "collection_img_url",
  "compact",
  "concat",
  "date",
  "default",
  "divided_by",
  "downcase",
  "escape",
  "escape_once",
  "first",
  "floor",
  "format_address",
  "handleize",
  "hmac_sha1",
  "hmac_sha256",
  "image_url",
  "img_url",
  "join",
  "json",
  "last",
  "lstrip",
  "map",
  "md5",
  "minus",
  "modulo",
  "money",
  "money_amount",
  "money_with_currency",
  "money_without_currency",
  "money_without_trailing_zeros",
  "newline_to_br",
  "payment_type_img_url",
  "pluralize",
  "plus",
  "prepend",
  "product_img_url",
  "remove",
  "remove_first",
  "remove_last",
  "replace",
  "replace_first",
  "replace_last",
  "reverse",
  "round",
  "rstrip",
  "sha1",
  "sha256",
  "shopify_asset_url",
  "size",
  "slice",
  "sort",
  "sort_natural",
  "split",
  "strip",
  "strip_html",
  "strip_newlines",
  "sum",
  "times",
  "translate",
  "truncate",
  "truncatewords",
  "unit_price_with_measurement",
  "uniq",
  "upcase",
  "url_decode",
  "url_encode",
  "url_escape",
  "url_param_escape",
  "weight_with_unit"
] as const

const unverified: readonly (readonly [note: string, names: readonly string[]])[] = [
  ["predates the theme-only array filters, but its reach into notifications is unconfirmed", ["where"]],
  ["Shopify's blake3 has no Node equivalent, so a preview cannot reproduce the digest", ["blake3"]],
  ["reads the store's Files, which a notification may not expose", ["file_img_url", "file_url"]],
  ["emits a <time> element that most email clients strip", ["time_tag"]],
  ["reads a metafield, which only some notification drops carry", ["metafield_text"]]
]

const unavailable: readonly (readonly [note: string, names: readonly string[]])[] = [
  ["was added for themes and is not part of the Liquid a notification runs", ["find", "find_index", "has", "reject"]],
  ["reads the cart, which exists only on the storefront", ["item_count_for_variant", "line_items_for"]],
  [
    "builds a storefront collection link",
    ["highlight_active_tag", "link_to_type", "link_to_vendor", "sort_by", "url_for_type", "url_for_vendor", "within"]
  ],
  [
    "operates on theme colour settings, which a notification cannot read",
    [
      "brightness_difference",
      "color_brightness",
      "color_contrast",
      "color_darken",
      "color_desaturate",
      "color_difference",
      "color_extract",
      "color_lighten",
      "color_mix",
      "color_modify",
      "color_saturate",
      "color_to_hex",
      "color_to_hsl",
      "color_to_oklch",
      "color_to_rgb",
      "hex_to_rgba"
    ]
  ],
  [
    "builds a storefront account link",
    ["avatar", "customer_login_link", "customer_logout_link", "customer_register_link", "login_button"]
  ],
  ["formats a storefront form or paginate object", ["default_errors", "default_pagination"]],
  ["reads theme font settings", ["font_face", "font_modify", "font_url"]],
  ["emits storefront tracking or schema markup", ["standard_event_data", "structured_data"]],
  ["reads the theme asset pipeline", ["asset_img_url", "asset_url", "global_asset_url", "inline_asset_content"]],
  [
    "emits theme markup that an email client cannot render",
    [
      "external_video_tag",
      "external_video_url",
      "highlight",
      "image_tag",
      "img_tag",
      "link_to",
      "media_tag",
      "metafield_tag",
      "model_viewer_tag",
      "placeholder_svg_tag",
      "preload_tag",
      "script_tag",
      "stylesheet_tag",
      "video_tag"
    ]
  ],
  ["renders storefront checkout markup", ["payment_button", "payment_terms", "payment_type_svg_tag"]],
  ["builds a storefront tag link", ["link_to_add_tag", "link_to_remove_tag", "link_to_tag"]],
  ["selects a currency on the storefront", ["currency_selector"]]
]

/*
 * Filters Shopify's reference omits because they exist only in notifications. They are as real as
 * the documented ones; the conformance test allows for them rather than treating them as strays.
 */
const notificationOnly: Readonly<Record<string, FilterEntry>> = {
  attach_as_pdf: {
    note: "Shopify swaps it for an attachment, so a preview shows nothing in its place",
    status: "unverified"
  },
  format_code: { status: "supported" },
  payment_icon_png_url: { note: "seen in older notification sources but never documented", status: "unverified" },
  t: { note: "how notification templates spell `translate`", status: "supported" }
}

const entries = new Map<string, FilterEntry>()
for (const name of supported) {
  entries.set(name, { status: "supported" })
}
for (const [note, names] of unverified) {
  for (const name of names) {
    entries.set(name, { note, status: "unverified" })
  }
}
for (const [note, names] of unavailable) {
  for (const name of names) {
    entries.set(name, { note, status: "unavailable" })
  }
}
for (const [name, entry] of Object.entries(notificationOnly)) {
  entries.set(name, entry)
}

export const filterCatalog: ReadonlyMap<string, FilterEntry> = entries

export const filterNames = (status: FilterStatus): readonly string[] =>
  [...entries].filter(([, entry]) => entry.status === status).map(([name]) => name)

/** The reason a filter cannot be used, or `undefined` when it can. */
export const filterRefusal = (name: string): string | undefined => {
  const entry = entries.get(name)
  if (entry === undefined) {
    return `"${name}" is not a Shopify Liquid filter`
  }
  if (entry.status === "unavailable") {
    return `"${name}" ${entry.note}, so it cannot be used in a notification template`
  }
  return undefined
}
