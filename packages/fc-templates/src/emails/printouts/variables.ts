/*
 * What both printouts need: the store they are printed by, and the trick for filling a second page.
 * Anything only one of them uses belongs in that printout's own folder.
 */

export const printoutShop = {
  name: "Fencing Club",
  email: "support@fencing.club",
  phone: "(425) 312-3746",
  url: "https://fencing.club",
  domain: "fencing.club",
  address: {
    address1: "17190 128th Pl NE",
    city: "Woodinville",
    province: "Washington",
    province_code: "WA",
    zip: "98072",
    country: "United States"
  },
  email_accent_color: "#101012",
  refund_policy: {
    body: "Returns are accepted according to the Fencing Club return policy."
  }
}

/** Repeat the line items to push a printout past one page, so the repeated footer is exercised. */
export function repeatLineItems<T>(items: readonly T[], times: number): T[] {
  return Array.from({ length: times }, () => items).flat()
}
