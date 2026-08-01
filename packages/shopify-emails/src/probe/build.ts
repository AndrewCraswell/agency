import { deprecatedNotificationDrops, documentedNotificationDrops } from "../samples/documentedDrops.ts"
import { candidateMarketingDrops } from "../samples/marketingDrops.ts"
import { observedNotificationDrops } from "../samples/observedDrops.ts"

/** Everything worth asking a live notification about: read by a template, or documented, or both. */
export const candidateNotificationDrops: readonly string[] = [
  ...new Set([...observedNotificationDrops, ...documentedNotificationDrops, ...deprecatedNotificationDrops])
].toSorted()

/*
 * Drops that answer `json` with `{"error":"json not allowed for this object"}`, and the properties
 * to ask for instead. `json` serialises a drop's backing hash, and these have none, so the dump
 * fails even though every property below resolves. Reaching for them one at a time is the only way
 * to see inside.
 */
const opaqueDropFields: Readonly<Record<string, readonly string[]>> = {
  customer: [
    "accepts_marketing",
    "addresses",
    "b2b?",
    "created_at",
    "currency",
    "default_address",
    "email",
    "first_name",
    "has_account",
    "id",
    "last_name",
    "last_order",
    "metafields",
    "name",
    "note",
    "orders_count",
    "phone",
    "state",
    "tags",
    "tax_exempt",
    "total_spent",
    "verified_email"
  ],
  shop: [
    "address",
    "contact_email",
    "currency",
    "customer_accounts_enabled",
    "description",
    "domain",
    "email",
    "email_accent_color",
    "email_logo_url",
    "email_logo_width",
    "id",
    "locale",
    "metafields",
    "money_format",
    "money_with_currency_format",
    "name",
    "permanent_domain",
    "phone",
    "policies",
    "privacy_policy",
    "refund_policy",
    "secure_url",
    "shipping_policy",
    "terms_of_service",
    "url"
  ]
}

export type ProbeQuestions = {
  /** Every drop the probe asks about. One key comes back per name, whatever the answer. */
  readonly names: readonly string[]
  /** Drops `json` refuses, and the properties to ask for one at a time instead. */
  readonly opaque: Readonly<Record<string, readonly string[]>>
  /** Liquid expressions, for values a filter computes at render time rather than a drop holding them. */
  readonly expressions: Readonly<Record<string, string>>
}

export const notificationQuestions: ProbeQuestions = {
  expressions: {},
  names: candidateNotificationDrops,
  opaque: opaqueDropFields
}

/*
 * Shopify Email is a different product from notifications, so none of the notification evidence
 * carries over. `customer` and `shop` are expanded the same way on the assumption they are the same
 * drop classes; if they answer `json` here, that assumption was the thing worth testing.
 */
export const marketingQuestions: ProbeQuestions = {
  expressions: {},
  names: candidateMarketingDrops,
  opaque: opaqueDropFields
}

/* How `credit_card_company` reads once downcased and underscored, which is how Shopify names the icon. */
const cardBrands: readonly string[] = [
  "american_express",
  "bogus",
  "diners_club",
  "discover",
  "elo",
  "jcb",
  "maestro",
  "mastercard",
  "unionpay",
  "visa"
]

/** The chrome the templates reach for by fixed path. */
const chromeAssets: readonly string[] = [
  "gift-card/add-to-apple-wallet.png",
  "gift-card/card.jpg",
  "mailer/shop_logo.png",
  "notifications/discounttag.png",
  "notifications/no-image.png",
  "notifications/shop-pay.svg"
]

const assetExpressions = (): Record<string, string> => {
  const asked: Record<string, string> = {}
  for (const path of [...chromeAssets, ...cardBrands.map((brand) => `notifications/${brand}.png`)]) {
    asked[path] = `'${path}' | shopify_asset_url`
  }
  /* Both filters are shimmed from guesswork, and only a live render can say which one Shopify honours. */
  for (const brand of cardBrands) {
    asked[`payment_type_img_url: ${brand}`] = `'${brand}' | payment_type_img_url`
    asked[`payment_icon_png_url: ${brand}`] = `'${brand}' | payment_icon_png_url`
  }
  return asked
}

/*
 * The CDN paths a filter computes at render time. Nothing in the Admin API exposes them: the
 * fingerprint in `visa-e96781bb….png` is an artifact of Shopify's asset pipeline, so a live render
 * is the only authority on what the URL actually is.
 */
export const assetQuestions: ProbeQuestions = { expressions: assetExpressions(), names: [], opaque: {} }

const probeLine = (name: string, opaque: ProbeQuestions["opaque"]): string => {
  const fields = opaque[name]
  if (fields === undefined) {
    return `  ${JSON.stringify(name)}: {{ ${name} | json | escape | default: "null" }}`
  }
  const inner = fields
    .map((field) => `    ${JSON.stringify(field)}: {{ ${name}.${field} | json | escape | default: "null" }}`)
    .join(",\n")
  return `  ${JSON.stringify(name)}: {\n${inner}\n  }`
}

/*
 * A throwaway template whose only job is to describe the variables it was rendered with.
 *
 * Nothing else here can settle what Shopify passes to a notification. Static reading of existing
 * templates only shows drops somebody already used, and the public Liquid reference documents a
 * different dialect. A live render is the sole authority, so this builds the smallest template that
 * makes one answer the question: paste it into a notification in the admin, preview or send it, and
 * what comes back is the contract.
 *
 * The output is one JSON object rather than a list of lines, so the answer can be pasted straight
 * into a type generator instead of read by eye. Every candidate is a key, so the result has the
 * same shape for every notification and two of them can be diffed.
 *
 * Read a value three ways. `null` means the drop's backing hash held nothing under that name.
 * `""` or `[]` means it exists and is empty for the order you tested, which is why the probe wants
 * an order with every field populated. Anything else is the drop's shape, keys and all.
 *
 * `null` is a floor rather than a verdict. `json` dumps the hash a drop wraps, not the methods it
 * computes, so `line_items` comes back without the `image` and `original_line_price` the stock
 * templates read, and `open_tracking_block` comes back empty though Shopify substitutes it at send
 * time. Absence here is a reason to check a name, not a reason to drop it.
 *
 * `default` is what keeps the document parseable: a drop that was never supplied renders as nothing at
 * all rather than as `null`, which would leave a dangling key and cost the whole run.
 *
 * Two things can spoil a run. If a value comes back unquoted where a string was expected, this
 * dialect has no `json` filter and the probe cannot tell missing from blank — compare two orders
 * instead. And a full `line_items` dump is large, so a mail client may clip the message: the probe
 * ends with a closing brace, and if one never arrives, narrow `names` and go a few drops at a time.
 */
export const buildProbe = ({ expressions, names, opaque }: ProbeQuestions = notificationQuestions): string =>
  [
    "{% comment %}Variable probe. Preview or send this notification, then copy the JSON below.{% endcomment %}",
    `<pre style="font: 12px/1.5 monospace; white-space: pre-wrap; word-break: break-all">{`,
    [
      ...names.map((name) => probeLine(name, opaque)),
      ...Object.entries(expressions).map(
        ([label, expression]) => `  ${JSON.stringify(label)}: {{ ${expression} | json | escape | default: "null" }}`
      )
    ].join(",\n"),
    "}</pre>"
  ].join("\n")
