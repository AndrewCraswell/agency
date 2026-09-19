import { objectKeys } from "ts-extras"
import { z } from "zod"

/** Reviewed bill-source capabilities. Presence here does not authorize hosted activation or scheduling. */
export const scraperBillProfiles = {
  nc: { session: "2025", identifier: /^[HS][1-9][0-9]{0,4}$/ },
  ak: { session: "34", identifier: /^[HS](?:B|R|JR|J|CR|SC|SCR)[1-9][0-9]{0,4}$/ },
  wa: { session: "2025-2026", identifier: /^[HS](?:B|CR|JM|JR|R) [1-9][0-9]{0,4}$/ }
} as const

export const scraperBillState = z.enum(objectKeys(scraperBillProfiles))
export type ScraperBillState = z.infer<typeof scraperBillState>

export const scraperBillPlanPath = z
  .string()
  .regex(/^openstates\/scraper-plans\/[a-z]{2}\/[A-Za-z0-9-]+\/[A-Za-z0-9][A-Za-z0-9-]{0,100}\/plan\.json$/)
  .refine((path) => {
    const [, , state, session] = path.split("/")
    const parsed = scraperBillState.safeParse(state)
    return parsed.success && scraperBillProfiles[parsed.data].session === session
  }, "Unreviewed scraper bill plan session")
