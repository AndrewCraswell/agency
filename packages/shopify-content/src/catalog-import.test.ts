import { describe, expect, it } from "vitest"
import { brandCopy, catalogProductInput, importCatalog } from "./catalog-import.ts"

const complete = { pageInfo: { hasNextPage: false } }
const photo = { url: "https://cdn.shopify.com/jacket.jpg", altText: "Mens jacket" }
const product = {
  id: "source-product",
  handle: "mens-jacket",
  title: "Mens jacket",
  descriptionHtml: "<p>Original description</p>",
  productType: "Jackets",
  vendor: "Fencing Club",
  tags: ["Clothing"],
  status: "ACTIVE",
  templateSuffix: "old",
  isGiftCard: false,
  requiresSellingPlan: false,
  category: null,
  seo: { title: null, description: null },
  options: [{ name: "Size", position: 1, optionValues: [{ name: "44" }] }],
  variants: {
    ...complete,
    nodes: [
      {
        id: "source-variant",
        sku: "J44",
        barcode: null,
        price: "99.00",
        compareAtPrice: "119.00",
        taxable: true,
        inventoryPolicy: "DENY",
        requiresComponents: false,
        selectedOptions: [{ name: "Size", value: "44" }],
        image: photo,
        inventoryItem: {
          requiresShipping: true,
          tracked: false,
          measurement: { weight: { value: 1, unit: "KILOGRAMS" } }
        }
      }
    ]
  },
  media: { ...complete, nodes: [{ mediaContentType: "IMAGE", alt: "Mens jacket", image: photo }] },
  metafields: {
    ...complete,
    nodes: [
      { namespace: "custom", key: "safety_level", type: "single_line_text_field", value: "350N" },
      { namespace: "custom", key: "size_chart", type: "page_reference", value: "gid://shopify/Page/1" }
    ]
  },
  collections: { ...complete, nodes: [] }
}
const snapshot = {
  shop: {
    id: "source-shop",
    name: "Fencing Club",
    myshopifyDomain: "8f3f5f-3.myshopify.com",
    primaryDomain: { host: "fencing.club" },
    currencyCode: "USD"
  },
  products: [product],
  capturedAt: "2026-09-08T00:00:00Z"
}
const shop = { shop: { id: "destination-shop", myshopifyDomain: "contosocamp.myshopify.com", currencyCode: "USD" } }

describe("Contoso catalog import", () => {
  it("preserves commercial values and excludes source-specific fields and inventory quantities", () => {
    const result = catalogProductInput(product)
    expect(result.input.variants[0]).toMatchObject({
      sku: "J44",
      price: "99.00",
      compareAtPrice: "119.00",
      inventoryItem: { tracked: true }
    })
    expect(result.input.files[0]?.originalSource).toBe(photo.url)
    expect(result.input.variants[0]?.file).toEqual(result.input.files[0])
    expect(result.input.status).toBe("DRAFT")
    expect(result.input.templateSuffix).toBe("")
    expect(result.excluded).toEqual(["custom.size_chart"])
    expect(JSON.stringify(result.input)).not.toContain("gid://shopify/Page")
    expect(JSON.stringify(result.input)).not.toContain("inventoryQuantities")
  })
  it("normalizes only customer copy", () => {
    expect(brandCopy("Men's, Mens's, Women’s and Kids' jackets")).toBe("Mens, Mens, Womens and Kids jackets")
  })
  it("rejects unsupported product contracts and missing variant images", () => {
    expect(() => catalogProductInput({ ...product, requiresSellingPlan: true })).toThrow("subscription")
    expect(() => catalogProductInput({ ...product, media: { ...complete, nodes: [] } })).toThrow("Variant image")
  })
  it("never writes during planning", async () => {
    const result = await importCatalog(
      snapshot,
      async (query, _variables, mutation) => {
        expect(mutation).toBeUndefined()
        if (query.includes("CatalogDestinationIdentity")) {
          return shop
        }
        return { product: null }
      },
      "contosocamp.myshopify.com",
      false
    )
    expect(result).toEqual([{ handle: "mens-jacket", action: "create" }])
  })
  it("cannot write to the source store", async () => {
    await expect(
      importCatalog(
        snapshot,
        async () => {
          throw new Error("No request expected")
        },
        "8f3f5f-3.myshopify.com",
        true
      )
    ).rejects.toThrow("restricted")
  })
  it("keeps existing products without overwriting", async () => {
    const result = await importCatalog(
      snapshot,
      async (query, _variables, mutation) => {
        expect(mutation).toBeUndefined()
        if (query.includes("CatalogDestinationIdentity")) {
          return shop
        }
        return { product: { id: "existing", handle: product.handle } }
      },
      "contosocamp.myshopify.com",
      true
    )
    expect(result[0]?.action).toBe("kept")
  })
  it("rejects destination drift before a creation", async () => {
    let reads = 0
    await expect(
      importCatalog(
        snapshot,
        async (query) => {
          if (query.includes("CatalogDestinationIdentity")) {
            return shop
          }
          reads++
          return { product: reads === 1 ? null : { id: "concurrent", handle: product.handle } }
        },
        "contosocamp.myshopify.com",
        true
      )
    ).rejects.toThrow("Destination changed")
  })
  it("creates a draft only after the plan and recheck", async () => {
    let writes = 0
    await importCatalog(
      snapshot,
      async (query, variables, mutation) => {
        if (query.includes("CatalogDestinationIdentity")) {
          return shop
        }
        if (!mutation) {
          return { product: null }
        }
        writes++
        expect(variables?.input).toEqual(catalogProductInput(product).input)
        return {
          result: {
            resource: {
              id: "created",
              handle: product.handle,
              status: "DRAFT",
              variants: {
                ...complete,
                nodes: [{ id: "new-variant", sku: "J44", selectedOptions: [{ name: "Size", value: "44" }] }]
              },
              media: { ...complete, nodes: [{ id: "new-image", status: "PROCESSING", mediaContentType: "IMAGE" }] }
            },
            userErrors: []
          }
        }
      },
      "contosocamp.myshopify.com",
      true
    )
    expect(writes).toBe(1)
  })
})
