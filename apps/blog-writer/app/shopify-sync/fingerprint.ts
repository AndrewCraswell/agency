/**
 * The five kinds of store content the sync copies across, named the way the resource table names them.
 */
export const FINGERPRINTED_RESOURCE_TYPES = ["product", "collection", "blog", "article", "page"] as const

export type FingerprintedResourceType = (typeof FINGERPRINTED_RESOURCE_TYPES)[number]

/**
 * The cheapest description of a body of content that still notices when it changes.
 *
 * A count moves when something is added or removed and the newest timestamp moves when anything is edited, so the two
 * together catch every edit a merchant can make, including adding one item and deleting another in the same breath.
 * Either half may be missing, because Shopify does not count articles and reports very large counts as approximate.
 */
export type ResourceFingerprint = {
  count: number | null
  latestUpdate: Date | null
}

export type StoreFingerprint = Record<FingerprintedResourceType, ResourceFingerprint>

/**
 * Whether the store still matches what was last copied across, or whether the app is in no position to say.
 */
export type ContentDrift = "current" | "changed" | "unknown"

/**
 * Timestamps agree when they land in the same second.
 *
 * Shopify reports milliseconds and Postgres keeps microseconds, and the two survive a round trip through the column
 * differently often enough that comparing them exactly would report a change on a store where nothing had happened.
 */
function sameMoment(live: Date, stored: Date) {
  return Math.floor(live.getTime() / 1000) === Math.floor(stored.getTime() / 1000)
}

/**
 * Whether the store still looks the way it did when it was last copied across.
 *
 * Only halves that both sides can speak to are compared. A missing count on one side is silence rather than
 * disagreement, because reporting a change the app cannot actually name would send a merchant to press a button that
 * changes nothing.
 */
export function compareFingerprints(live: StoreFingerprint, stored: StoreFingerprint): ContentDrift {
  for (const resourceType of FINGERPRINTED_RESOURCE_TYPES) {
    const here = live[resourceType]
    const there = stored[resourceType]
    if (here.count !== null && there.count !== null && here.count !== there.count) {
      return "changed"
    }
    if (
      here.latestUpdate !== null &&
      there.latestUpdate !== null &&
      !sameMoment(here.latestUpdate, there.latestUpdate)
    ) {
      return "changed"
    }
  }
  return "current"
}
