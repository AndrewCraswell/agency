import { describe, expect, it } from "vitest"
import { finalizeCatalog } from "./catalog-finalize.ts"

const complete = { pageInfo: { hasNextPage: false } }
const source = {
  shop: {
    id: "source",
    name: "Fencing Club",
    myshopifyDomain: "8f3f5f-3.myshopify.com",
    primaryDomain: { host: "fencing.club" },
    currencyCode: "USD"
  },
  capturedAt: "2026-09-08T00:00:00Z",
  products: [
    {
      id: "source-product",
      handle: "jacket",
      title: "Mens jacket",
      descriptionHtml: "",
      status: "ACTIVE",
      variants: {
        ...complete,
        nodes: [
          {
            id: "source-variant",
            sku: "J44",
            price: "99.00",
            compareAtPrice: null,
            selectedOptions: [{ name: "Size", value: "44" }]
          }
        ]
      },
      media: { ...complete, nodes: [{ id: "source-image" }] },
      metafields: { ...complete, nodes: [] },
      collections: { ...complete, nodes: [{ handle: "jackets" }] }
    }
  ]
}
const product = {
  id: "product",
  handle: "jacket",
  title: "Mens jacket",
  descriptionHtml: "",
  status: "DRAFT",
  options: [],
  metafield: null,
  variants: {
    ...complete,
    nodes: [
      {
        id: "variant",
        sku: "J44",
        price: "99.00",
        compareAtPrice: null,
        selectedOptions: [{ name: "Size", value: "44" }],
        inventoryItem: {
          id: "inventory",
          tracked: true,
          inventoryLevels: {
            ...complete,
            nodes: [{ id: "level", location: { id: "location" }, quantities: [{ name: "available", quantity: 0 }] }]
          }
        },
        productVariantComponents: { ...complete, nodes: [] }
      }
    ]
  },
  media: { ...complete, nodes: [{ id: "image", status: "READY", image: { url: "https://cdn.shopify.com/image.jpg" } }] }
}
const setup = {
  shop: { id: "destination", myshopifyDomain: "contosocamp.myshopify.com" },
  locations: { nodes: [{ id: "location", name: "Shop location", isActive: true }] },
  publications: { nodes: [{ id: "publication", name: "Online Store" }] },
  collections: { ...complete, nodes: [] }
}
const content = {
  collections: {
    ...complete,
    nodes: [{ handle: "jackets", title: "Jackets", descriptionHtml: "", sortOrder: "ALPHA_ASC", image: null }]
  }
}

describe("catalog finalization boundaries", () => {
  it("verifies data before assigning charts, seeding stock, creating collections and activating products", async () => {
    const writes: string[] = []
    const result = await finalizeCatalog(
      async (query, _variables, mutation) => {
        if (mutation) {
          writes.push(query)
          if (query.includes("CreateCatalogCollection")) {
            return { collectionCreate: { collection: { id: "collection", handle: "jackets" }, userErrors: [] } }
          }
          return { result: { userErrors: [] } }
        }
        if (query.includes("CatalogSetup")) {
          return setup
        }
        if (query.includes("CatalogCharts")) {
          return {
            metaobjects: {
              ...complete,
              nodes: [{ id: "chart", handle: "mens-jackets", capabilities: { publishable: { status: "ACTIVE" } } }]
            }
          }
        }
        return { product }
      },
      source,
      content,
      [],
      { jacket: "mens-jackets" },
      "contosocamp.myshopify.com",
      "location",
      "publication"
    )
    expect(result).toEqual({ products: 1, collections: 1, assignments: 1, bundleVariants: 0 })
    expect(writes).toHaveLength(6)
    expect(writes[0]).toContain("metafieldsSet")
    expect(writes[1]).toContain("SetTestStock")
    expect(writes[4]).toContain("ActivateCatalogProduct")
  })

  it.each(["identity", "location", "publication", "missing", "content", "images"])(
    "rejects %s defects before writes",
    async (defect) => {
      const request = async (query: string, _variables?: Record<string, unknown>, mutation?: boolean) => {
        if (mutation) {
          throw new Error("Unexpected mutation")
        }
        if (query.includes("CatalogSetup")) {
          if (defect === "identity") {
            return { ...setup, shop: { id: "source", myshopifyDomain: "contosocamp.myshopify.com" } }
          }
          if (defect === "location") {
            return { ...setup, locations: { nodes: [] } }
          }
          if (defect === "publication") {
            return { ...setup, publications: { nodes: [] } }
          }
          return setup
        }
        if (defect === "missing") {
          return { product: null }
        }
        if (defect === "content") {
          return { product: { ...product, title: "Unexpected" } }
        }
        return { product: { ...product, media: { ...complete, nodes: [] } } }
      }
      await expect(
        finalizeCatalog(request, source, content, [], {}, "contosocamp.myshopify.com", "location", "publication")
      ).rejects.toThrow(
        /Unexpected destination|location is unavailable|Only the Online Store|Missing product|content differs|images are not ready/
      )
    }
  )
  it("rejects writes outside Contoso before reading or mutating", async () => {
    await expect(
      finalizeCatalog(
        async () => {
          throw new Error("No request expected")
        },
        {},
        {},
        [],
        {},
        "source.myshopify.com",
        "location",
        "publication"
      )
    ).rejects.toThrow("restricted")
  })
  it("rejects an unconfirmed source snapshot", async () => {
    const source = {
      shop: {
        id: "other",
        name: "Other",
        myshopifyDomain: "other.myshopify.com",
        primaryDomain: { host: "other.test" },
        currencyCode: "USD"
      },
      products: [],
      capturedAt: "2026-09-08T00:00:00Z"
    }
    await expect(
      finalizeCatalog(
        async () => {
          throw new Error("No request expected")
        },
        source,
        {},
        [],
        {},
        "contosocamp.myshopify.com",
        "location",
        "publication"
      )
    ).rejects.toThrow("Unexpected source")
  })
})
