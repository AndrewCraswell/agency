import { parseSynchronizationEnvironment, type SynchronizationEnvironment } from "./identities.js"
import type { ManagedScheduleManifestEntry } from "./reconciliation.js"

export const scheduledScraperJurisdictions = ["ak", "nc"] as const
export type ScheduledScraperJurisdiction = (typeof scheduledScraperJurisdictions)[number]

export type ScraperScheduleManifestOptions = Readonly<{
  active?: boolean
  enabledJurisdictions?: readonly ScheduledScraperJurisdiction[]
  environment?: SynchronizationEnvironment
}>

export function parseScheduledScraperJurisdictions(value: string | undefined): ScheduledScraperJurisdiction[] {
  const states = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  if (new Set(states).size !== states.length) {
    throw new Error("OPENSTATES_SCRAPER_ENABLED_STATES contains duplicate jurisdictions")
  }
  for (const state of states) {
    if (!scheduledScraperJurisdictions.includes(state as ScheduledScraperJurisdiction)) {
      throw new Error(`OPENSTATES_SCRAPER_ENABLED_STATES contains unsupported jurisdiction: ${state}`)
    }
  }
  return states as ScheduledScraperJurisdiction[]
}

export function createScraperScheduleManifest(
  options: ScraperScheduleManifestOptions = {}
): readonly ManagedScheduleManifestEntry[] {
  const environment = parseSynchronizationEnvironment(options.environment ?? "development")
  const enabled = new Set(options.active === true ? (options.enabledJurisdictions ?? []) : [])
  return [
    schedule(
      environment,
      enabled.has("ak"),
      "bills:ak",
      "openstates-scraper:bills:ak:34",
      "7 5 * * *",
      "openstates-bill-scraper-schedule"
    ),
    schedule(
      environment,
      enabled.has("nc"),
      "bills:nc",
      "openstates-scraper:bills:nc:2025",
      "27 5 * * *",
      "openstates-bill-scraper-schedule"
    ),
    schedule(
      environment,
      enabled.has("ak"),
      "events:ak",
      "openstates-scraper:events:ak:34",
      "12 * * * *",
      "openstates-alaska-events-schedule"
    ),
    schedule(
      environment,
      enabled.has("nc"),
      "events:nc",
      "openstates-scraper:events:nc:current",
      "42 * * * *",
      "openstates-north-carolina-events-schedule"
    ),
    schedule(environment, enabled.has("ak"), "content:ak", "ak:34", "52 */4 * * *", "openstates-content-schedule"),
    schedule(environment, enabled.has("nc"), "content:nc", "nc:2025", "2 1-23/4 * * *", "openstates-content-schedule"),
    schedule(
      environment,
      enabled.size > 0,
      "foundation:enabled",
      "openstates-scraper:foundation:enabled",
      "17 6 * * *",
      "openstates-foundation-schedule"
    )
  ]
}

function schedule(
  environment: SynchronizationEnvironment,
  active: boolean,
  identity: string,
  externalId: string,
  cron: string,
  taskIdentifier: string
): ManagedScheduleManifestEntry {
  return {
    active,
    cron,
    deduplicationKey: `${environment}:openstates-scraper:${identity}`,
    externalId,
    taskIdentifier,
    timezone: "UTC"
  }
}
