import { describe, expect, it } from "vitest"
import { snapshotCatalog } from "./catalog-snapshot.ts"

const store = "source.myshopify.com"
const connection = { nodes: [], pageInfo: { hasNextPage: false } }
const product = {
  id: "product",
  handle: "jacket",
  title: "Mens jacket",
  variants: connection,
  media: connection,
  metafields: connection,
  collections: connection
}
const response = {
  shop: {
    id: "shop",
    name: "Source",
    myshopifyDomain: store,
    primaryDomain: { host: "source.test" },
    currencyCode: "USD"
  },
  products: { nodes: [product], pageInfo: { hasNextPage: false, endCursor: null } }
}

describe("catalog snapshot", () => {
  it("reads each page without granting mutation access and preserves source fields", async () => {
    let calls = 0
    const result = await snapshotCatalog(async (query, variables, mutation) => {
      expect(query).toMatch(/^query /)
      expect(mutation).toBeUndefined()
      calls++
      if (calls === 1) {
        return { ...response, products: { ...response.products, pageInfo: { hasNextPage: true, endCursor: "next" } } }
      }
      expect(variables?.after).toBe("next")
      return {
        ...response,
        products: { ...response.products, nodes: [{ ...product, id: "other", handle: "pants", tags: ["original"] }] }
      }
    }, store)
    expect(result.products).toHaveLength(2)
    expect(result.products[1]?.tags).toEqual(["original"])
    expect(calls).toBe(2)
  })

  it("rejects a different source store", async () => {
    await expect(snapshotCatalog(async () => response, "other.myshopify.com")).rejects.toThrow("identity changed")
  })

  it("refuses truncated nested data", async () => {
    await expect(
      snapshotCatalog(
        async () => ({
          ...response,
          products: {
            ...response.products,
            nodes: [{ ...product, variants: { ...connection, pageInfo: { hasNextPage: true } } }]
          }
        }),
        store
      )
    ).rejects.toThrow("Invalid input")
  })

  it("rejects repeated products instead of producing an incomplete export", async () => {
    await expect(
      snapshotCatalog(
        async () => ({
          ...response,
          products: { ...response.products, pageInfo: { hasNextPage: true, endCursor: "same" } }
        }),
        store
      )
    ).rejects.toThrow("Duplicate source product")
  })

  it("rejects pagination that cannot advance", async () => {
    await expect(
      snapshotCatalog(
        async () => ({ ...response, products: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } }),
        store
      )
    ).rejects.toThrow("pagination did not advance")
  })
})
