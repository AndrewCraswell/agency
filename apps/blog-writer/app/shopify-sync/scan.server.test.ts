import { describe, expect, it, vi } from "vitest"
import { scanShopifyResources } from "./scan.server"

const timestamps = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" }
const connectionNames = ["products", "collections", "blogs", "articles", "pages"] as const

function connection(nodes: unknown[], hasNextPage = false, endCursor: string | null = null) {
  return { nodes, pageInfo: { hasNextPage, endCursor } }
}

function response(connectionName: string, value: unknown) {
  return new Response(JSON.stringify({ data: { [connectionName]: value } }))
}

describe("scanShopifyResources", () => {
  it("paginates and normalizes every supported Shopify resource", async () => {
    const calls = new Map<string, number>()
    const graphql = vi.fn<Parameters<typeof scanShopifyResources>[1]>(async (query: string) => {
      if (query.includes("shop {")) {
        return new Response(
          JSON.stringify({
            data: {
              shop: {
                name: "Contoso Camp",
                myshopifyDomain: "contosocamp.myshopify.com",
                domains: [{ host: "contosocamp.myshopify.com" }, { host: "contosocamp.com" }],
                billingAddress: { countryCodeV2: "CA" }
              },
              shopLocales: [{ locale: "en-CA", primary: true, published: true }]
            }
          })
        )
      }
      const connectionName = connectionNames.find((name) => query.includes(`${name}(`))
      expect(connectionName).toBeDefined()
      if (connectionName === undefined) {
        throw new Error("Unexpected query")
      }
      const call = (calls.get(connectionName) ?? 0) + 1
      calls.set(connectionName, call)

      // Both collection queries read the same connection, so the live subset is told apart by its storefront filter.
      if (query.includes("published_status:published")) {
        return response("collections", connection([{ id: "gid://shopify/Collection/1" }]))
      }

      if (connectionName === "products") {
        const product = {
          id: `gid://shopify/Product/${call}`,
          title: `Tent ${call}`,
          handle: `tent-${call}`,
          description: "A tent",
          descriptionHtml: "<p>A tent</p>",
          ...timestamps,
          publishedAt: timestamps.updatedAt,
          productType: "Tent",
          status: "ACTIVE",
          tags: ["camping"],
          totalInventory: 4,
          vendor: "Contoso Camp",
          priceRangeV2: {
            minVariantPrice: { amount: "99.00", currencyCode: "USD" },
            maxVariantPrice: { amount: "149.00", currencyCode: "USD" }
          }
        }
        return response("products", connection([product], call === 1, call === 1 ? "next" : null))
      }

      const values = {
        collections: {
          id: "gid://shopify/Collection/1",
          title: "Tents",
          handle: "tents",
          description: "Tent collection",
          descriptionHtml: "<p>Tent collection</p>",
          updatedAt: timestamps.updatedAt,
          productsCount: { count: 2 }
        },
        blogs: {
          id: "gid://shopify/Blog/1",
          title: "Field Notes",
          handle: "field-notes",
          ...timestamps,
          commentPolicy: "MODERATED",
          tags: ["camping"]
        },
        articles: {
          id: "gid://shopify/Article/1",
          title: "Pitch a tent",
          handle: "pitch-a-tent",
          body: "<p>Instructions</p>",
          summary: "Instructions",
          ...timestamps,
          publishedAt: timestamps.updatedAt,
          isPublished: true,
          tags: ["guide"],
          author: { name: "Dana Reed" },
          blog: { id: "gid://shopify/Blog/1", handle: "field-notes", title: "Field Notes" }
        },
        pages: {
          id: "gid://shopify/Page/1",
          title: "About",
          handle: "about",
          body: "<p>About us</p>",
          bodySummary: "About us",
          ...timestamps,
          publishedAt: timestamps.updatedAt,
          isPublished: true
        }
      }
      return response(connectionName, connection([values[connectionName]]))
    })

    const snapshot = await scanShopifyResources("contosocamp.myshopify.com", graphql)
    const { resources } = snapshot

    expect(snapshot.shop).toEqual({
      name: "Contoso Camp",
      primaryLocale: "en-CA",
      myshopifyDomain: "contosocamp.myshopify.com",
      domains: [{ host: "contosocamp.myshopify.com" }, { host: "contosocamp.com" }],
      billingAddress: { countryCodeV2: "CA" }
    })
    expect(resources).toHaveLength(6)
    expect(calls.get("products")).toBe(2)
    expect(resources.map(({ resourceType }) => resourceType)).toEqual([
      "product",
      "product",
      "collection",
      "blog",
      "article",
      "page"
    ])
    expect(resources.find(({ resourceType }) => resourceType === "article")?.canonicalUrl).toBe(
      "https://contosocamp.myshopify.com/blogs/field-notes/pitch-a-tent"
    )
    expect(resources.find(({ resourceType }) => resourceType === "article")?.metadata).toMatchObject({
      authorName: "Dana Reed"
    })
    expect(resources.find(({ resourceType }) => resourceType === "collection")).toMatchObject({
      isPublished: true,
      isAvailable: true
    })
    expect(resources.every(({ contentHash }) => /^[0-9a-f]{64}$/u.test(contentHash))).toBe(true)
    expect(resources.every(({ locale }) => locale === "en-CA")).toBe(true)
  })

  it("rejects an incomplete cursor before returning a partial scan", async () => {
    const graphql = vi.fn<Parameters<typeof scanShopifyResources>[1]>(async (query: string) => {
      if (query.includes("shop {")) {
        return new Response(
          JSON.stringify({
            data: {
              shop: {
                name: "Contoso Camp",
                myshopifyDomain: "contosocamp.myshopify.com",
                domains: [{ host: "contosocamp.myshopify.com" }],
                billingAddress: { countryCodeV2: "US" }
              },
              shopLocales: [{ locale: "en", primary: true, published: true }]
            }
          })
        )
      }
      const connectionName = connectionNames.find((name) => query.includes(`${name}(`))
      if (connectionName === undefined) {
        throw new Error("Unexpected query")
      }
      return response(connectionName, connection([], connectionName === "products", null))
    })

    await expect(scanShopifyResources("contosocamp.myshopify.com", graphql)).rejects.toThrow(
      "products returned hasNextPage without an endCursor"
    )
  })
})
