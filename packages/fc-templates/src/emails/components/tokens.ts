/*
 * The email half of the Fencing Club design system, transcribed from the `.pen` variables so a
 * colour or size is changed in one place rather than in fifty templates.
 *
 * Email clients do not read CSS custom properties, so these are values rather than `var()` and the
 * components spread them into inline styles.
 */

import { binding, liquidValue, type PathRef } from "@repo/shopify-emails"

export const color = {
  accent: "#101012",
  accentInk: "#ffffff",
  bg: "#ffffff",
  focus: "#a6192e",
  focusSoft: "#f7e8ea",
  ink: "#101012",
  inkSoft: "#5a5a60",
  line: "#e3e3e0",
  onDark: "#f7f7f5",
  onDarkSoft: "#a0a0a6",
  paid: "#1e7a46",
  paidLine: "#bfe3cc",
  paidSoft: "#e7f4ea",
  /* Shop's own brand purple, which the Shop app button has to keep to stay recognisable. */
  shop: "#5433eb",
  surface: "#f4f4f2",
  surfaceDark: "#0b0b0c"
} as const

/*
 * What each surface becomes when the client reports a dark scheme. Named against its light
 * counterpart rather than left as loose hex in the stylesheet, so the pair moves together.
 */
export const darkColor = {
  bg: "#141416",
  band: "#08080a",
  surface: "#1c1c1f",
  line: "#2e2e33",
  icon: "#2a2a2e"
} as const

/** The web font loads where it can; the rest of each stack is what the client falls back to. */
export const font = {
  body: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  display: 'Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"Geist Mono", "SF Mono", Consolas, monospace'
} as const

export const radius = 14

/** The gutter every band shares, so bands line up down the length of the email. */
export const gutter = 32

/*
 * The gap between two stacked white sections. It always belongs to the section below: nothing adds
 * bottom padding to open a gap, so a section's own top padding is the whole distance.
 */
export const sectionGap = 36

/*
 * The white gap above a full-bleed band. A tinted table cannot hold white space of its own, so a
 * band carries this in a wrapper above itself rather than as its own padding.
 */
export const bandGap = 32

/*
 * Storefront destinations Liquid has no drop for. Policy links are not here: those come off the
 * shop drop, so the merchant can retitle or move one without a redeploy.
 */
export const shopLinks = {
  contact: "https://fencing.club/pages/contact",
  facebook: "https://www.facebook.com/fencingclubstore",
  faq: "https://fencing.club/pages/faq",
  /* The blog is where the buying guides live; there is no separate guides page. */
  guides: "https://fencing.club/blogs/blog",
  instagram: "https://www.instagram.com/fencingclub.shop",
  preferences: "https://account.fencing.club/",
  reviews: "https://fencing.club/pages/reviews",
  shop: "https://fencing.club/collections/all",
  starterKits: "https://fencing.club/collections/starter-kits",
  trackOrder: "https://account.fencing.club/"
} as const

export const logoUrl = "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/email-logo-white.png?v=1784929023"

/*
 * The branding the merchant owns, set under Customize email templates in the admin. Shopify offers
 * one accent colour and no second one, so the rest of the palette above stays fixed.
 */
export const brand: {
  readonly accentColor: PathRef<string>
  readonly logoUrl: PathRef<string>
  readonly logoWidth: PathRef<number>
} = {
  accentColor: binding<string>("shop.email_accent_color"),
  logoUrl: binding<string>("shop.email_logo_url"),
  logoWidth: binding<number>("shop.email_logo_width")
}

/*
 * The accent as a colour a style attribute can carry. The fallback is double-quoted because the
 * font stack forces these attributes to be delimited with single quotes.
 */
export const accentFill = () => liquidValue(brand.accentColor, [`default: "${color.accent}"`])
