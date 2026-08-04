/*
 * The Fencing Club email signature — the one person it names and the two logo files it swaps
 * between light and dark. Kept apart from the markup so a title or a phone number is edited in one
 * place and both signatures move together.
 */

import { logoUrl } from "../components/tokens.ts"

/*
 * Both shields are already on the shop's CDN, so the signature needs no new upload:
 *   - the black shield is the one the printout mastheads print,
 *   - the white shield is the one the email header shows on its dark band.
 * The source PNGs live beside this file in `assets/`, which is what `pnpm cli upload` re-hosts if a
 * crisper export is ever wanted.
 */
export const logo = {
  /** Black shield, shown on the light background. */
  light: "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/Fencing_Club-05.png",
  /** White shield, shown once a client reports a dark scheme. */
  dark: logoUrl
} as const

export const signatory = {
  name: "Andrew Craswell",
  title: "Owner, Fencing Club",
  email: "andrew@fencing.club",
  website: { label: "https://fencing.club", href: "https://fencing.club" },
  phone: { label: "(425) 312-3746", href: "tel:+14253123746" },
  location: "Woodinville, WA"
} as const
