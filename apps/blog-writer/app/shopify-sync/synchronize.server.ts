import { resolveKeywordMarket } from "../keywords/market"
import type { ShopifySyncRepository } from "../persistence/shopify-sync-repository.server"
import { scanShopifyResources } from "./scan.server"
import type { ScannedShopifyResource } from "./scan.server"

type ShopifySnapshot = {
  tenantId: string
  shop: {
    name: string
    primaryLocale: string
    myshopifyDomain: string
    domains: { host: string }[]
    billingAddress: { countryCodeV2: string | null } | null
  }
  resources: ScannedShopifyResource[]
}

type Dependencies = {
  repository: ShopifySyncRepository
  scan: typeof scanShopifyResources
  now: () => Date
}

const defaultDependencies: Dependencies = {
  repository: {
    async begin(shopDomain) {
      const { shopifySyncRepository } = await import("../persistence/shopify-sync-repository.server")
      return shopifySyncRepository.begin(shopDomain)
    },
    async applySnapshot(snapshot) {
      const { shopifySyncRepository } = await import("../persistence/shopify-sync-repository.server")
      return shopifySyncRepository.applySnapshot(snapshot)
    },
    async recordFailure(identity, error) {
      const { shopifySyncRepository } = await import("../persistence/shopify-sync-repository.server")
      return shopifySyncRepository.recordFailure(identity, error)
    }
  },
  scan: scanShopifyResources,
  now: () => new Date()
}

/**
 * Copies a store's catalogue across and reports the tenant it landed in.
 *
 * Embedding deliberately is not started here. The workflow that asks for the sync goes on to ask for the indexing, so
 * the order of the two steps is visible and retryable in one place instead of being buried where only a stack trace
 * would show it.
 */
export async function synchronizeShopifyStore(
  shopDomain: string,
  graphql: Parameters<typeof scanShopifyResources>[1],
  dependencies: Dependencies = defaultDependencies
): Promise<ShopifySnapshot> {
  const identity = await dependencies.repository.begin(shopDomain)
  try {
    const snapshot = await dependencies.scan(shopDomain, graphql)
    await dependencies.repository.applySnapshot({
      ...identity,
      shopName: snapshot.shop.name,
      ownedDomains: [snapshot.shop.myshopifyDomain, ...snapshot.shop.domains.map(({ host }) => host)],
      // A market the store already corrected by hand outranks whatever Shopify reports, so the repository decides
      // whether to take this rather than the scan overwriting a merchant's answer on every sync.
      keywordMarket: resolveKeywordMarket(
        snapshot.shop.billingAddress?.countryCodeV2 ?? null,
        snapshot.shop.primaryLocale
      ),
      resources: snapshot.resources,
      synchronizedAt: dependencies.now()
    })
    return { ...snapshot, tenantId: identity.tenantId }
  } catch (error) {
    await dependencies.repository.recordFailure(identity, error)
    throw error
  }
}
