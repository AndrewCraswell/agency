import { describe, expect, it, vi } from "vitest"
import type { ShopifySyncRepository } from "../persistence/shopify-sync-repository.server"
import { synchronizeShopifyStore } from "./synchronize.server"

type SynchronizeDependencies = NonNullable<Parameters<typeof synchronizeShopifyStore>[2]>

const identity = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  jobId: "20000000-0000-4000-8000-000000000001"
}

function repository(): ShopifySyncRepository {
  return {
    begin: vi.fn<ShopifySyncRepository["begin"]>(async () => identity),
    applySnapshot: vi.fn<ShopifySyncRepository["applySnapshot"]>(async () => undefined),
    recordFailure: vi.fn<ShopifySyncRepository["recordFailure"]>(async () => undefined)
  }
}

describe("synchronizeShopifyStore", () => {
  it("applies a complete scan to the authenticated shop tenant", async () => {
    const syncRepository = repository()
    const now = new Date("2026-02-01T00:00:00Z")
    const snapshot = {
      shop: {
        name: "Contoso Camp",
        primaryLocale: "en",
        billingAddress: { countryCodeV2: "US" },
        myshopifyDomain: "contosocamp.myshopify.com",
        domains: [{ host: "contosocamp.myshopify.com" }, { host: "contosocamp.com" }]
      },
      resources: []
    }
    const scan = vi.fn<SynchronizeDependencies["scan"]>(async () => snapshot)

    await expect(
      synchronizeShopifyStore("contosocamp.myshopify.com", vi.fn(), {
        repository: syncRepository,
        scan,
        now: () => now
      })
    ).resolves.toEqual({ ...snapshot, tenantId: identity.tenantId })

    expect(syncRepository.begin).toHaveBeenCalledWith("contosocamp.myshopify.com")
    expect(syncRepository.applySnapshot).toHaveBeenCalledWith({
      ...identity,
      shopName: "Contoso Camp",
      ownedDomains: ["contosocamp.myshopify.com", "contosocamp.myshopify.com", "contosocamp.com"],
      keywordMarket: { countryCode: "US", languageCode: "en", locationName: "United States" },
      resources: [],
      synchronizedAt: now
    })
    expect(syncRepository.recordFailure).not.toHaveBeenCalled()
  })

  it("records a failed job without applying a partial snapshot", async () => {
    const syncRepository = repository()
    const scanError = new Error("Shopify cursor failed")
    const scan = vi.fn<SynchronizeDependencies["scan"]>(async () => {
      throw scanError
    })

    await expect(
      synchronizeShopifyStore("contosocamp.myshopify.com", vi.fn(), {
        repository: syncRepository,
        scan,
        now: () => new Date()
      })
    ).rejects.toBe(scanError)

    expect(syncRepository.applySnapshot).not.toHaveBeenCalled()
    expect(syncRepository.recordFailure).toHaveBeenCalledWith(identity, scanError)
  })
})
