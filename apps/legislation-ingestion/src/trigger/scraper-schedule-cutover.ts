import type { RemoteSynchronizationSchedule } from "./reconciliation.js"

const legacyIdentities = new Set([
  "openstates:bills:ak",
  "openstates:entities:ak",
  "openstates:events:ak",
  "openstates:bills:nc",
  "openstates:entities:nc",
  "openstates:events:nc"
])

export function isLegacyAlaskaOrNorthCarolinaApiSchedule(schedule: RemoteSynchronizationSchedule): boolean {
  if (schedule.externalId !== null && schedule.externalId !== undefined && legacyIdentities.has(schedule.externalId)) {
    return true
  }
  const deduplicationKey = schedule.deduplicationKey
  if (deduplicationKey === null || deduplicationKey === undefined) return false
  return [...legacyIdentities].some((identity) => deduplicationKey.endsWith(`:${identity}`))
}

export function isManagedScraperSchedule(schedule: RemoteSynchronizationSchedule, environment: "production"): boolean {
  return schedule.deduplicationKey?.startsWith(`${environment}:openstates-scraper:`) === true
}
