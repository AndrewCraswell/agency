import type { ArtifactStore } from "../documents/artifact-store.js"
import { readBounded } from "../http-client.js"
import { peopleRoleReviewDigest } from "./people-role-review.js"
import { scraperBillProfiles, type ScraperBillState } from "./scraper-bill-profiles.js"
import {
  retainWashingtonCommitteeInventory,
  washingtonCommitteeInventoryUrl
} from "./washington-committee-inventory.js"

/** Acquire supplementary identities before deciding whether a repository revision is unchanged. */
export async function acquireFoundationCommitteeInventory(
  state: ScraperBillState,
  store: ArtifactStore,
  fetcher: typeof fetch = fetch
) {
  if (state !== "wa") return undefined
  const biennium = scraperBillProfiles.wa.biennium
  const response = await fetcher(washingtonCommitteeInventoryUrl(biennium), {
    signal: AbortSignal.timeout(30_000),
    redirect: "error"
  })
  if (!response.ok) throw new Error(`Washington committee inventory HTTP ${response.status}`)
  const xml = new TextDecoder().decode(await readBounded(response, 2 * 1024 * 1024))
  return retainWashingtonCommitteeInventory(store, xml, biennium)
}

export function foundationSourcesUnchanged(
  state: ScraperBillState,
  revision: string,
  peopleCursor: Record<string, unknown> | undefined,
  committeeCursor: Record<string, unknown> | undefined,
  inventory: Awaited<ReturnType<typeof acquireFoundationCommitteeInventory>>
) {
  if (peopleCursor?.revision !== revision || committeeCursor?.revision !== revision) return false
  if (peopleCursor.reviewDigest !== peopleRoleReviewDigest(state, revision)) return false
  if (!inventory) return true
  const previous = committeeCursor.officialInventory
  return (
    typeof previous === "object" &&
    previous !== null &&
    "sha256" in previous &&
    previous.sha256 === inventory.inventory.sha256
  )
}
