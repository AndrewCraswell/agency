import { describe, expect, it } from "vitest"
import { storefrontAdapters } from "./storefront-resources.ts"

const collection = {
  handle: "jackets",
  title: "Jackets",
  descriptionHtml: "",
  sortOrder: "ALPHA_ASC",
  productHandles: ["jacket"],
  image: null
}
const blog = { handle: "journal", title: "Journal", articles: [] }

describe("portable storefront resources", () => {
  it("creates an empty collection without an invalid empty source", async () => {
    const requests: unknown[] = []
    const adapters = storefrontAdapters(async (_query, variables) => {
      requests.push(variables)
      return { collectionCreate: { collection: { id: "collection", handle: "jackets" }, userErrors: [] } }
    })
    await adapters.collection!.create({ ...collection, productHandles: [] })
    expect(requests).toEqual([
      { collection: { handle: "jackets", title: "Jackets", descriptionHtml: "", sortOrder: "ALPHA_ASC", sources: [] } }
    ])
  })
  it("resolves product handles before creating a collection", async () => {
    const requests: unknown[] = []
    const adapters = storefrontAdapters(async (query, variables, mutation) => {
      requests.push(variables)
      if (!mutation) {
        return { product: { id: "destination-product", handle: "jacket" } }
      }
      return { collectionCreate: { collection: { id: "collection", handle: "jackets" }, userErrors: [] } }
    })
    expect((await adapters.collection!.create(collection)).url).toBe("/collections/jackets")
    expect(requests[0]).toEqual({ identifier: { handle: "jacket" } })
    expect(JSON.stringify(requests[1])).toContain('"productId":"destination-product"')
  })
  it("rejects missing products before collection creation", async () => {
    const adapters = storefrontAdapters(async () => ({ product: null }))
    await expect(adapters.collection!.create(collection)).rejects.toThrow("product is missing")
  })
  it("rejects ambiguous or renamed collection matches", async () => {
    const adapters = storefrontAdapters(async () => ({
      collections: {
        nodes: [
          { id: "one", handle: "jackets" },
          { id: "two", handle: "jackets" }
        ],
        pageInfo: { hasNextPage: false }
      }
    }))
    await expect(adapters.collection!.find(collection)).rejects.toThrow("Ambiguous")
  })
  it("creates a missing blog and preserves the route", async () => {
    const adapters = storefrontAdapters(async () => ({
      blogCreate: { blog: { id: "blog", handle: "journal" }, userErrors: [] }
    }))
    expect((await adapters.blog!.create(blog)).url).toBe("/blogs/journal")
  })
  it("finds existing collections and blogs without writes", async () => {
    const adapters = storefrontAdapters(async (query, _variables, mutation) => {
      expect(mutation).toBeUndefined()
      if (query.includes("MigrationCollections")) {
        return { collections: { nodes: [{ id: "collection", handle: "jackets" }], pageInfo: { hasNextPage: false } } }
      }
      return {
        blogs: {
          nodes: [{ id: "blog", handle: "journal", articles: { nodes: [], pageInfo: { hasNextPage: false } } }],
          pageInfo: { hasNextPage: false }
        }
      }
    })
    expect((await adapters.collection!.find(collection))?.id).toBe("collection")
    const existing = await adapters.blog!.find(blog)
    expect(existing?.id).toBe("blog")
    expect(adapters.blog!.conflict!(existing!, blog)).toBeUndefined()
  })
})
