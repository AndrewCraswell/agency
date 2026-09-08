import { describe, expect, it } from "vitest"
import {
  bundlePriceUpdates,
  bundleUpdates,
  catalogMutation,
  collectionMembershipSource,
  mapImportedVariants,
  loadBundleCaptures,
  stockSeed
} from "./catalog-setup.ts"

const complete = { pageInfo: { hasNextPage: false } }
const options = [{ name: "Size", value: "44" }]
const variant = {
  id: "new-variant",
  sku: "J44",
  price: "99.00",
  compareAtPrice: null,
  selectedOptions: options,
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
const product = {
  id: "new-product",
  handle: "jacket",
  title: "Mens jacket",
  descriptionHtml: "",
  status: "DRAFT",
  options: [],
  metafield: null,
  variants: { ...complete, nodes: [variant] },
  media: { ...complete, nodes: [] }
}
const source = {
  shop: {
    id: "old-shop",
    name: "Source",
    myshopifyDomain: "source.myshopify.com",
    primaryDomain: { host: "source.test" },
    currencyCode: "USD"
  },
  capturedAt: "2026-09-08T00:00:00Z",
  products: [
    {
      id: "old-product",
      handle: "jacket",
      title: "Mens jacket",
      variants: {
        ...complete,
        nodes: [{ id: "old-variant", sku: "J44", price: "99.00", compareAtPrice: null, selectedOptions: options }]
      },
      media: { ...complete, nodes: [] },
      metafields: { ...complete, nodes: [] },
      collections: { ...complete, nodes: [] }
    }
  ]
}

describe("catalog setup", () => {
  it("loads only exact source bundle captures and rejects destination diagnostics", async () => {
    const original = structuredClone(source)
    Object.assign(original.products[0]!.variants.nodes[0]!, { requiresComponents: true })
    const files: string[] = []
    const captures = await loadBundleCaptures(original, async (filename) => {
      files.push(filename)
      return { product: { id: "old-product", handle: "jacket" } }
    })
    expect(files).toEqual(["migration-bundle-jacket.json"])
    expect(captures).toHaveLength(1)
    await expect(
      loadBundleCaptures(original, async () => ({ product: { id: "new-product", handle: "jacket" } }))
    ).rejects.toThrow("does not match the source")
  })
  it("restores only verified draft bundle prices after Shopify recalculation", () => {
    const original = structuredClone(source)
    Object.assign(original.products[0]!.variants.nodes[0]!, { requiresComponents: true })
    const bundle = {
      ...product,
      variants: {
        ...complete,
        nodes: [
          {
            ...variant,
            price: "120.00",
            productVariantComponents: { ...complete, nodes: [{ quantity: 1, productVariant: { id: "child" } }] }
          }
        ]
      }
    }
    const mapped = mapImportedVariants(original, [bundle])
    expect(bundlePriceUpdates(original, [bundle], mapped)).toEqual([
      { productId: "new-product", variants: [{ id: "new-variant", price: "99.00", compareAtPrice: null }] }
    ])
    expect(() => bundlePriceUpdates(original, [{ ...bundle, status: "ACTIVE" }], mapped)).toThrow("active bundle price")
  })
  it("maps exact variant options and commercial values without source IDs", () => {
    expect(mapImportedVariants(source, [product]).get("old-variant")).toBe("new-variant")
    expect(() =>
      mapImportedVariants(source, [{ ...product, variants: { ...complete, nodes: [{ ...variant, price: "1.00" }] } }])
    ).toThrow("variant differs")
    expect(() => mapImportedVariants(source, [])).toThrow("Missing")
  })
  it("restores only missing bundle components and rejects conflicting quantities", () => {
    const bundle = [
      {
        product: {
          handle: "kit",
          variants: {
            ...complete,
            nodes: [
              {
                id: "old-parent",
                productVariantComponents: { ...complete, nodes: [{ quantity: 2, productVariant: { id: "old-child" } }] }
              }
            ]
          }
        }
      }
    ]
    const map = new Map([
      ["old-parent", "new-variant"],
      ["old-child", "new-child"]
    ])
    expect(bundleUpdates(bundle, map, [product])).toEqual([
      { parentProductVariantId: "new-variant", productVariantRelationshipsToCreate: [{ id: "new-child", quantity: 2 }] }
    ])
    const restored = {
      ...variant,
      productVariantComponents: { ...complete, nodes: [{ quantity: 2, productVariant: { id: "new-child" } }] }
    }
    expect(bundleUpdates(bundle, map, [{ ...product, variants: { ...complete, nodes: [restored] } }])).toEqual([])
    expect(() => bundleUpdates(bundle, new Map(), [product])).toThrow("not imported")
  })
  it("seeds only zero-stock items using compare-and-set", () => {
    expect(stockSeed([product], "location").quantities).toEqual([
      { inventoryItemId: "inventory", locationId: "location", quantity: 20, changeFromQuantity: 0 }
    ])
    expect(() => stockSeed([product], "elsewhere")).toThrow("location missing")
    expect(
      stockSeed(
        [
          {
            ...product,
            variants: {
              ...complete,
              nodes: [
                {
                  ...variant,
                  productVariantComponents: { ...complete, nodes: [{ quantity: 1, productVariant: { id: "child" } }] }
                }
              ]
            }
          }
        ],
        "location"
      ).quantities
    ).toEqual([])
  })
  it("uses manual source selections for reproducible collection membership", () => {
    expect(collectionMembershipSource("Imported catalog", ["destination-product"]).source.inclusion.selections).toEqual(
      [{ productId: "destination-product" }]
    )
  })
  it("surfaces mutation errors", async () => {
    await expect(
      catalogMutation(async () => ({ result: { userErrors: [{ message: "Denied" }] } }), "mutation Example {}", {})
    ).rejects.toThrow("Denied")
  })
})
