import { z } from "zod"

const jurisdiction = z.string().regex(/^[a-z]{2}$/)
const queue = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const routes = z.record(jurisdiction, queue)

/** An explicit routing table must cover the requested state; never silently cross worker builds. */
export function scraperQueueFor(
  state: string,
  environment: { OPENSTATES_SCRAPER_QUEUE?: string; OPENSTATES_SCRAPER_QUEUE_ROUTES?: string } = process.env
) {
  const key = jurisdiction.parse(state)
  if (environment.OPENSTATES_SCRAPER_QUEUE_ROUTES === undefined) {
    return queue.parse(environment.OPENSTATES_SCRAPER_QUEUE)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(environment.OPENSTATES_SCRAPER_QUEUE_ROUTES)
  } catch {
    throw new Error("Invalid Open States scraper queue routing JSON")
  }
  const result = routes.parse(parsed)[key]
  if (!result) throw new Error(`Missing Open States scraper queue route for ${key}`)
  return result
}
