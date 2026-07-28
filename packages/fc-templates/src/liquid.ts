import { Liquid } from "liquidjs"

/*
 * The Liquid engine every template renders through. Shopify's own runtime supplies a large set of
 * filters that liquidjs does not, so they are shimmed here closely enough for a faithful preview.
 * The .liquid sources are verbatim copies of what Shopify ships and are never modified on disk;
 * the handful of preview-only quirks are patched in memory by `sanitizeForPreview`.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/* --------------------------- Liquid filter shims --------------------------- */

function amountInCents(value: unknown): number {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function formatMoney(value: unknown, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountInCents(value) / 100)
}

const VISA_ICON_URL =
  "https://cdn.shopify.com/shopifycloud/shopify/assets/themes_support/notifications/visa-e96781bbd9d5a604ec37ca3959c7200b62b58790536de883a9f29852191da219.png"

const NOTIFICATION_ASSETS: Record<string, string> = {
  "notifications/discounttag.png":
    "https://cdn.shopify.com/shopifycloud/shopify/assets/themes_support/notifications/discounttag-23d3dd52a101179fb1461daaba6b77388b99b6154de85840a5245b8d3930a68e.png",
  "notifications/no-image.png":
    "https://cdn.shopify.com/shopifycloud/shopify/assets/themes_support/notifications/no-image-f4b31b80de3984c0c3892c3c35d946963547e11331187e92cfb4e95de761b69b.png",
  "notifications/shop-pay.svg": "https://cdn.shopify.com/shopifycloud/checkout-web/assets/c1.en.shop-pay-logo.svg",
  "mailer/shop_logo.png":
    "https://cdn.shopify.com/shopifycloud/shopify/assets/mailer/shop_logo-12af59b3a0fd7907df134f6385a95b0cc7334fd7323f245fc6d77c3445395d0d.png",
  "gift-card/card.jpg":
    "https://cdn.shopify.com/shopifycloud/shopify/assets/themes_support/gift_card/card-default-6c2b0f3f0b9b7cc3.jpg",
  "gift-card/add-to-apple-wallet.png":
    "https://cdn.shopify.com/shopifycloud/shopify/assets/themes_support/gift_card/add-to-apple-wallet.png"
}

function assetUrl(value: unknown): string {
  const path = String(value ?? "").replace(/^\/+/, "")
  const known = NOTIFICATION_ASSETS[path]
  if (known) {
    return known
  }
  return path.startsWith("http") ? path : `https://cdn.shopify.com/${path}`
}

function paymentIconUrl(value: unknown): string {
  if (String(value).toLowerCase() === "visa") {
    return VISA_ICON_URL
  }
  return assetUrl(`payments/${String(value)}.png`)
}

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  if (value === "now" || value === "today") {
    return new Date()
  }
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]

/** Minimal strftime covering the directives the Shopify notification sources actually use. */
function strftime(date: Date, format: string): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const h12 = date.getHours() % 12 || 12
  const map: Record<string, string> = {
    "%Y": String(date.getFullYear()),
    "%m": pad(date.getMonth() + 1),
    "%b": MONTHS[date.getMonth()].slice(0, 3),
    "%B": MONTHS[date.getMonth()],
    "%d": pad(date.getDate()),
    "%e": String(date.getDate()).padStart(2, " "),
    "%H": pad(date.getHours()),
    "%I": pad(h12),
    "%M": pad(date.getMinutes()),
    "%p": date.getHours() < 12 ? "AM" : "PM"
  }
  return format.replace(/%[YmbBdeHIMp%]/g, (token) => (token === "%%" ? "%" : (map[token] ?? token)))
}

function formatAddress(address: unknown): string {
  if (!isRecord(address)) {
    return ""
  }
  return [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company,
    address.address1,
    address.address2,
    [address.city, address.province_code, address.zip].filter(Boolean).join(", "),
    address.country
  ]
    .filter(Boolean)
    .join("<br>")
}

function formatDate(value: unknown, ...args: unknown[]): string {
  const date = toDate(value)
  if (!date) {
    return ""
  }
  let format: string | undefined
  for (const arg of args) {
    if (isRecord(arg) && typeof arg.format === "string") {
      format = arg.format
    } else if (typeof arg === "string") {
      format = arg
    }
  }
  if (!format || format === "date") {
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }
  if (format === "date_at_time") {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })
  }
  return strftime(date, format)
}

export const engine = new Liquid({
  strictFilters: false,
  strictVariables: false,
  lenientIf: true
})

engine.registerFilter("money", (value: unknown) => formatMoney(value))
engine.registerFilter("money_with_currency", (value: unknown) => `${formatMoney(value)} USD`)
engine.registerFilter("money_without_trailing_zeros", (value: unknown) => formatMoney(value).replace(/\.00$/, ""))
/* Shopify resizes the CDN asset; in a preview the fixture URL is already the right thing to load. */
engine.registerFilter("img_url", (value: unknown) => {
  if (isRecord(value)) {
    const image = value.image
    const nested = isRecord(image) ? image.src : image
    return value.src ?? value.url ?? nested ?? value.featured_image ?? ""
  }
  return String(value ?? "")
})
engine.registerFilter("cdn_asset_url", assetUrl)
engine.registerFilter("shopify_asset_url", assetUrl)
engine.registerFilter("payment_icon_png_url", paymentIconUrl)
engine.registerFilter("payment_type_img_url", paymentIconUrl)
engine.registerFilter("attach_as_pdf", () => "")
engine.registerFilter("t", (value: unknown) => String(value ?? ""))
engine.registerFilter("format_code", (value: unknown) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim()
)
engine.registerFilter("format_address", formatAddress)
engine.registerFilter("unit_price_with_measurement", (value: unknown) => formatMoney(value))
engine.registerFilter("date", formatDate)

/*
 * Preview-only shim: Shopify's Liquid accepts a few constructs that liquidjs rejects. We rewrite
 * them just before parsing so the canonical on-disk Shopify source is never modified.
 */
export function sanitizeForPreview(source: string): string {
  return source
    .replace(/\[\s*([^[\]]+?)\s*\]\.compact\.join\(\s*'[^']*'\s*\)/g, (_match, items: string) => {
      const first = items.split(",")[0].trim()
      return first || "''"
    })
    .replace(/\.tracking_url\)\s*\}\}/g, ".tracking_url }}")
    .replace(/\.tracking_number\)\s*\}\}/g, ".tracking_number }}")
}
