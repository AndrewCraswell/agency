import { createHash, createHmac } from "node:crypto"

/*
 * Local stand-ins for the filters Shopify's own Liquid runtime provides and liquidjs does not.
 *
 * Nothing here runs in production: a compiled template names the filter and Shopify applies the
 * real one. These exist so a preview shows "$214.00" where the email will, and so the shape of a
 * date or an address in the preview is the shape a customer sees.
 */

export type ShimOptions = {
  /** ISO 4217 code the store prices in. */
  readonly currency: string
  readonly locale: string
  /** IANA zone the store's dates are read in. Falls back to the host's zone. */
  readonly timeZone?: string
}

export type FilterImplementation = (value: unknown, ...args: readonly unknown[]) => unknown

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value))

/* ------------------------------------ money ------------------------------------ */

/** Shopify holds money as an integer number of the currency's smallest unit. */
const cents = (value: unknown): number => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount / 100 : 0
}

const moneyShims = ({ currency, locale }: ShimOptions): Record<string, FilterImplementation> => {
  const withSymbol = new Intl.NumberFormat(locale, { currency, style: "currency" })
  const bare = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  const rounded = new Intl.NumberFormat(locale, { currency, maximumFractionDigits: 0, style: "currency" })
  return {
    money: (value) => withSymbol.format(cents(value)),
    money_amount: (value) => bare.format(cents(value)),
    money_with_currency: (value) => `${withSymbol.format(cents(value))} ${currency}`,
    money_without_currency: (value) => bare.format(cents(value)),
    money_without_trailing_zeros: (value) => {
      const amount = cents(value)
      return Number.isInteger(amount) ? rounded.format(amount) : withSymbol.format(amount)
    },
    unit_price_with_measurement: (value, measurement) => {
      const price = withSymbol.format(cents(value))
      if (!isRecord(measurement)) {
        return price
      }
      const amount = Number(measurement.reference_value ?? 1)
      const unit = text(measurement.reference_unit)
      return unit === "" ? price : `${price}/${amount === 1 ? "" : amount}${unit}`
    }
  }
}

/* ------------------------------------ dates ------------------------------------ */

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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const toDate = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === "") {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  if (value === "now" || value === "today") {
    return new Date()
  }
  const source = text(value)
  /* A bare date carries no zone, and reading it as UTC would move it back a day west of Greenwich. */
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source)
  if (bare) {
    return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]))
  }
  const parsed = new Date(source)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Covers the strftime directives Shopify's own notification sources use. */
const strftime = (date: Date, format: string): string => {
  const pad = (value: number) => String(value).padStart(2, "0")
  const hour12 = date.getHours() % 12 || 12
  const directives: Record<string, string> = {
    "%A": DAYS[date.getDay()],
    "%B": MONTHS[date.getMonth()],
    "%H": pad(date.getHours()),
    "%I": pad(hour12),
    "%M": pad(date.getMinutes()),
    "%S": pad(date.getSeconds()),
    "%Y": String(date.getFullYear()),
    "%a": DAYS[date.getDay()].slice(0, 3),
    "%b": MONTHS[date.getMonth()].slice(0, 3),
    "%d": pad(date.getDate()),
    "%e": String(date.getDate()).padStart(2, " "),
    "%j": String(date.getDate()),
    "%l": String(hour12),
    "%m": pad(date.getMonth() + 1),
    "%p": date.getHours() < 12 ? "AM" : "PM",
    "%y": pad(date.getFullYear() % 100)
  }
  return format.replace(/%[A-Za-z%]/g, (token) => {
    if (token === "%%") {
      return "%"
    }
    return directives[token] ?? token
  })
}

const dateShims = ({ locale, timeZone }: ShimOptions): Record<string, FilterImplementation> => {
  /* Shopify names a few formats in the shop's date settings rather than spelling out directives. */
  const short: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone, year: "numeric" }
  const withTime: Intl.DateTimeFormatOptions = { ...short, hour: "numeric", minute: "2-digit" }
  /* Built once: an Intl formatter costs far more to construct than to use, and receipts hold many. */
  const named = new Map<string, Intl.DateTimeFormat>([
    ["date", new Intl.DateTimeFormat(locale, short)],
    ["date_at_time", new Intl.DateTimeFormat(locale, withTime)],
    ["default", new Intl.DateTimeFormat(locale, withTime)],
    ["month_day_year", new Intl.DateTimeFormat(locale, { ...short, month: "long" })]
  ])
  const format = (value: unknown, args: readonly unknown[]) => {
    const date = toDate(value)
    if (!date) {
      return ""
    }
    const requested = args.reduce<string | undefined>((found, arg) => {
      if (typeof arg === "string") {
        return arg
      }
      if (isRecord(arg) && typeof arg.format === "string") {
        return arg.format
      }
      return found
    }, undefined)
    const preset = named.get(requested ?? "date")
    return preset ? preset.format(date) : strftime(date, requested ?? "")
  }
  return {
    date: (value, ...args) => format(value, args),
    time_tag: (value, ...args) => {
      const date = toDate(value)
      return date ? `<time datetime="${date.toISOString()}">${format(value, args)}</time>` : ""
    }
  }
}

/* ------------------------------------ urls ------------------------------------ */

const CDN = "https://cdn.shopify.com"

/* Shopify serves the notification chrome from fixed, fingerprinted CDN paths. */
const NOTIFICATION_ASSETS: Record<string, string> = {
  "gift-card/add-to-apple-wallet.png": `${CDN}/shopifycloud/shopify/assets/themes_support/gift_card/add-to-apple-wallet.png`,
  "gift-card/card.jpg": `${CDN}/shopifycloud/shopify/assets/themes_support/gift_card/card-default-6c2b0f3f0b9b7cc3.jpg`,
  "mailer/shop_logo.png": `${CDN}/shopifycloud/shopify/assets/mailer/shop_logo-12af59b3a0fd7907df134f6385a95b0cc7334fd7323f245fc6d77c3445395d0d.png`,
  "notifications/discounttag.png": `${CDN}/shopifycloud/shopify/assets/themes_support/notifications/discounttag-23d3dd52a101179fb1461daaba6b77388b99b6154de85840a5245b8d3930a68e.png`,
  "notifications/no-image.png": `${CDN}/shopifycloud/shopify/assets/themes_support/notifications/no-image-f4b31b80de3984c0c3892c3c35d946963547e11331187e92cfb4e95de761b69b.png`,
  "notifications/shop-pay.svg": `${CDN}/shopifycloud/checkout-web/assets/c1.en.shop-pay-logo.svg`
}

const VISA_ICON = `${CDN}/shopifycloud/shopify/assets/themes_support/notifications/visa-e96781bbd9d5a604ec37ca3959c7200b62b58790536de883a9f29852191da219.png`

const assetUrl = (value: unknown): string => {
  const path = text(value).replace(/^\/+/, "")
  const known = NOTIFICATION_ASSETS[path]
  if (known) {
    return known
  }
  return path.startsWith("http") ? path : `${CDN}/${path}`
}

const paymentIcon = (value: unknown): string =>
  text(value).toLowerCase() === "visa" ? VISA_ICON : assetUrl(`payments/${text(value)}.png`)

/* An image drop can arrive as a URL, as an image, or as the product that owns one. */
const imageSource = (value: unknown): string => {
  if (!isRecord(value)) {
    return text(value)
  }
  const nested = value.image
  const fromNested = isRecord(nested) ? nested.src : nested
  return text(value.src ?? value.url ?? fromNested ?? value.featured_image)
}

const sized = (value: unknown, ...args: readonly unknown[]): string => {
  const source = imageSource(value)
  const width = args.reduce<string | undefined>((found, arg) => {
    if (typeof arg === "string" && /^\d+x\d*$/.test(arg)) {
      return arg.split("x")[0]
    }
    if (isRecord(arg) && arg.width !== undefined) {
      return text(arg.width)
    }
    return found
  }, undefined)
  if (source === "" || width === undefined) {
    return source
  }
  return `${source}${source.includes("?") ? "&" : "?"}width=${width}`
}

/* ------------------------------------ strings ------------------------------------ */

const digest = (algorithm: string) => (value: unknown) => createHash(algorithm).update(text(value)).digest("hex")

const formatAddress = (address: unknown): string => {
  if (!isRecord(address)) {
    return ""
  }
  const lines = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company,
    address.address1,
    address.address2,
    [address.city, address.province_code, address.zip].filter(Boolean).join(", "),
    address.country
  ]
  return lines.filter(Boolean).join("<br>")
}

/* ------------------------------------ weights ------------------------------------ */

const GRAMS_PER_UNIT: Record<string, number> = { g: 1, kg: 1000, lb: 453.592, oz: 28.3495 }

/* -------------------------------------------------------------------------------- */

export const shopifyFilterShims = (options: ShimOptions): Readonly<Record<string, FilterImplementation>> => ({
  ...moneyShims(options),
  ...dateShims(options),
  article_img_url: sized,
  /* Shopify replaces the drop with an attachment, so there is nothing to show in its place. */
  attach_as_pdf: () => "",
  base64_url_safe_decode: (value) =>
    Buffer.from(text(value).replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"),
  base64_url_safe_encode: (value) =>
    Buffer.from(text(value), "utf8").toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""),
  blake3: () => {
    throw new Error("blake3 has no Node equivalent, so a preview cannot reproduce it")
  },
  camelize: (value) =>
    text(value)
      .split(/[\s_-]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(""),
  collection_img_url: sized,
  file_img_url: (value, ...args) => sized(`${CDN}/s/files/1/files/${text(value)}`, ...args),
  file_url: (value) => `${CDN}/s/files/1/files/${text(value)}`,
  format_address: formatAddress,
  /* Notification-only: gift card codes are read aloud in groups of four. */
  format_code: (value) =>
    text(value)
      .toUpperCase()
      .replace(/(.{4})/g, "$1 ")
      .trim(),
  handleize: (value) =>
    text(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  hmac_sha1: (value, key) => createHmac("sha1", text(key)).update(text(value)).digest("hex"),
  image_url: sized,
  img_url: sized,
  md5: digest("md5"),
  metafield_text: (value) => (isRecord(value) ? text(value.value) : text(value)),
  payment_icon_png_url: paymentIcon,
  payment_type_img_url: paymentIcon,
  pluralize: (value, singular, plural) => (Number(value) === 1 ? text(singular) : text(plural)),
  product_img_url: sized,
  sha1: digest("sha1"),
  shopify_asset_url: assetUrl,
  /* Without the shop's translation table the key's own fallback is the closest honest answer. */
  t: (value, ...args) => {
    const fallback = args.find((arg) => isRecord(arg) && typeof arg.default === "string")
    return isRecord(fallback) ? text(fallback.default) : text(value)
  },
  url_escape: (value) => encodeURI(text(value)).replaceAll("&", "%26"),
  url_param_escape: (value) => encodeURIComponent(text(value)),
  weight_with_unit: (value, unit) => {
    const target = text(unit) === "" ? "g" : text(unit)
    const grams = Number(value ?? 0) / (GRAMS_PER_UNIT[target] ?? 1)
    return `${Number.isInteger(grams) ? grams : grams.toFixed(1)} ${target}`
  }
})
