import { z } from "zod"
import { scraperBillProfiles } from "./scraper-bill-profiles.js"

/** Content capability is separate from hosted activation; no schedule is implied by admission here. */
export const stateContentScope = z.enum(["nc", "ak", "wa"])

export function stateContentSession(state: string, session?: string) {
  const jurisdiction = stateContentScope.parse(state)
  return z
    .string()
    .regex(/^[A-Za-z0-9-]+$/)
    .parse(session ?? scraperBillProfiles[jurisdiction].session)
    .toLowerCase()
}
