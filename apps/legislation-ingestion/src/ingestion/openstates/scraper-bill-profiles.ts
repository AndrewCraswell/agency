/** Reviewed bill-source capabilities. Presence here does not authorize hosted activation or scheduling. */
export const scraperBillProfiles = {
  nc: { session: "2025", identifier: /^[HS][1-9][0-9]{0,4}$/ },
  ak: { session: "34", identifier: /^[HS](?:B|R|JR|J|CR|SC|SCR)[1-9][0-9]{0,4}$/ },
  wa: { session: "2025-2026", identifier: /^[HS](?:B|CR|JM|JR|R) [1-9][0-9]{0,4}$/ }
} as const
