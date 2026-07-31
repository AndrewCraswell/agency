/*
 * The email half of the Fencing Club design system, transcribed from the `.pen` variables so a
 * colour or size is changed in one place rather than in fifty templates.
 *
 * Email clients do not read CSS custom properties, so these are values rather than `var()` and the
 * components spread them into inline styles.
 */

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

export const shopLinks = {
  contact: "https://fencing.club/pages/contact",
  facebook: "https://facebook.com/fencingclub",
  faq: "https://fencing.club/pages/faq",
  guides: "https://fencing.club/pages/buying-guides",
  instagram: "https://instagram.com/fencingclub",
  preferences: "https://fencing.club/account",
  privacy: "https://fencing.club/policies/privacy-policy",
  returns: "https://fencing.club/pages/returns",
  reviews: "https://fencing.club/pages/reviews",
  shipping: "https://fencing.club/pages/shipping",
  shop: "https://fencing.club/collections/all",
  starterKits: "https://fencing.club/collections/starter-kits",
  terms: "https://fencing.club/policies/terms-of-service",
  trackOrder: "https://fencing.club/account"
} as const

export const logoUrl = "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/email-logo-white.png?v=1784929023"
