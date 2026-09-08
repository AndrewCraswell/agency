import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createResourceAdapters, definitionConflict, installedResource, mutate } from "./adapters.ts"
import { createCliClient, unwrapResponse, type AdminClient } from "./client.ts"
import * as queries from "./queries.ts"

const connection = (nodes: unknown[]) => ({ resources: { nodes, pageInfo: { hasNextPage: false } } })
const success = (resource: unknown) => ({ result: { resource, userErrors: [] } })
const chart = {
  id: "chart",
  handle: "mens-jackets",
  type: "size_chart",
  definition: { capabilities: { onlineStore: { enabled: true, data: { urlHandle: "size-charts" } } } }
}

describe("Shopify resource adapters", () => {
  it("finds a menu by exact handle across pages instead of using an unsupported search filter", async () => {
    const client = vi
      .fn<AdminClient>()
      .mockResolvedValueOnce({
        resources: { nodes: [{ id: "main", handle: "main-menu" }], pageInfo: { hasNextPage: true, endCursor: "next" } }
      })
      .mockResolvedValueOnce(connection([{ id: "sizes", handle: "size-charts" }]))
    expect((await createResourceAdapters(client).menu!.find({ handle: "size-charts" }))?.id).toBe("sizes")
    expect(client).toHaveBeenNthCalledWith(1, queries.menusQuery, { after: undefined })
    expect(client).toHaveBeenNthCalledWith(2, queries.menusQuery, { after: "next" })
    client.mockResolvedValue(connection([{ id: "main", handle: "main-menu" }]))
    expect(await createResourceAdapters(client).menu!.find({ handle: "size-charts" })).toBeUndefined()
  })

  it("rejects duplicate menu handles and stalled pagination", async () => {
    const client = vi.fn<AdminClient>().mockResolvedValue(
      connection([
        { id: "one", handle: "sizes" },
        { id: "two", handle: "sizes" }
      ])
    )
    await expect(createResourceAdapters(client).menu!.find({ handle: "sizes" })).rejects.toThrow("Ambiguous")
    client.mockResolvedValue({ resources: { nodes: [], pageInfo: { hasNextPage: true, endCursor: "same" } } })
    await expect(createResourceAdapters(client).menu!.find({ handle: "sizes" })).rejects.toThrow("did not advance")
  })

  it("looks up exact handles and refuses ambiguous or mismatched search results", async () => {
    const client = vi
      .fn<AdminClient>()
      .mockResolvedValueOnce(connection([{ id: "page", handle: "size-charts" }]))
      .mockResolvedValueOnce(connection([{ id: "wrong", handle: "other" }]))
      .mockResolvedValueOnce(connection([{ id: "one" }, { id: "two" }]))
    const adapter = createResourceAdapters(client).page!
    expect((await adapter.find({ handle: "size-charts" }))?.url).toBe("/pages/size-charts")
    await expect(adapter.find({ handle: "size-charts" })).rejects.toThrow("different")
    await expect(adapter.find({ handle: "size-charts" })).rejects.toThrow("Ambiguous")
  })

  it("serializes nested metaobject references and gets the URL from definition configuration", async () => {
    const client = vi.fn<AdminClient>().mockResolvedValue(success(chart))
    const adapter = createResourceAdapters(client).metaobject!
    const data = {
      type: "size_chart",
      handle: "mens-jackets",
      fields: { sizes: ["new-size-id"], name: "Jackets" },
      status: "ACTIVE"
    }
    expect((await adapter.create(data)).url).toBe("/pages/size-charts/mens-jackets")
    expect(client).toHaveBeenCalledWith(
      queries.entryCreate,
      {
        input: {
          type: "size_chart",
          handle: "mens-jackets",
          fields: [
            { key: "sizes", value: '["new-size-id"]' },
            { key: "name", value: "Jackets" }
          ],
          capabilities: { publishable: { status: "ACTIVE" } }
        }
      },
      true
    )
    await adapter.replace?.({ id: "chart", state: chart }, data)
    expect(client.mock.calls[1]?.[1]).not.toHaveProperty("input.type")
  })

  it("preserves menus by default at the planner and validates menu depth and targets", async () => {
    const client = vi.fn<AdminClient>().mockResolvedValue(success({ id: "menu", handle: "size-charts" }))
    const adapter = createResourceAdapters(client).menu!
    const data = {
      handle: "size-charts",
      title: "Size charts",
      items: [{ title: "Jackets", type: "HTTP", url: "/pages/size-charts/mens-jackets" }]
    }
    adapter.validate(data)
    await adapter.create(data)
    await adapter.replace?.({ id: "menu", state: {} }, data)
    expect(client.mock.calls[1]?.[1]).toEqual({ id: "menu", title: data.title, items: data.items })
    expect(() => adapter.validate({ ...data, items: [{ title: "Bad", type: "PAGE" }] })).toThrow("resource reference")
    expect(() => adapter.validate({ ...data, items: [{ title: "Bad", type: "HTTP" }] })).toThrow("URL")
    const leaf = { title: "Link", type: "FRONTPAGE" }
    expect(() =>
      adapter.validate({ ...data, items: [{ ...leaf, items: [{ ...leaf, items: [{ ...leaf, items: [leaf] }] }] }] })
    ).toThrow("three levels")
  })

  it("fails closed on GraphQL, user and malformed response errors", async () => {
    expect(() => unwrapResponse({ errors: [{ message: "Access denied" }] })).toThrow("Access denied")
    expect(unwrapResponse({ data: { shop: {} } })).toEqual({ shop: {} })
    expect(unwrapResponse({ shop: {} })).toEqual({ shop: {} })
    await expect(
      mutate(async () => ({ result: { resource: null, userErrors: [{ message: "Invalid input" }] } }), "", {}, "page")
    ).rejects.toThrow("Invalid input")
    await expect(mutate(async () => success(null), "", {}, "page")).rejects.toThrow("no resource")
    await expect(mutate(async () => ({}), "", {}, "page")).rejects.toThrow(z.ZodError)
  })

  it("rejects unsafe store names and mutation permission is independent of arguments", async () => {
    expect(() => createCliClient("other.example.com")).toThrow(z.ZodError)
    expect(() => createCliClient("store.myshopify.com; echo bad")).toThrow(z.ZodError)
    await expect(createCliClient("test.myshopify.com")("mutation {}", {}, true)).rejects.toThrow("disabled")
  })

  it("checks definition field types, required fields, validations and URL capability", () => {
    const desired = {
      type: "size_chart",
      name: "Size chart",
      displayNameKey: "title",
      access: { storefront: "PUBLIC_READ" },
      capabilities: { onlineStore: { enabled: true, data: { urlHandle: "size-charts" } } },
      fieldDefinitions: [{ key: "title", name: "Title", type: "single_line_text_field", required: true }]
    }
    const remote = {
      displayNameKey: "title",
      access: { storefront: "PUBLIC_READ" },
      capabilities: desired.capabilities,
      fieldDefinitions: [{ key: "title", required: true, type: { name: "single_line_text_field" }, validations: [] }]
    }
    expect(definitionConflict({ id: "definition", state: remote }, desired)).toBeUndefined()
    expect(definitionConflict({ id: "definition", state: { ...remote, fieldDefinitions: [] } }, desired)).toContain(
      "field"
    )
    expect(
      definitionConflict(
        { id: "definition", state: { ...remote, capabilities: { onlineStore: { enabled: false } } } },
        desired
      )
    ).toContain("capability")
    expect(
      definitionConflict({ id: "definition", state: { ...remote, access: { storefront: "NONE" } } }, desired)
    ).toContain("storefront")
    expect(
      installedResource({ ...chart, definition: { capabilities: { onlineStore: null } } }, "metaobject").url
    ).toBeUndefined()
  })

  it("requires an explicit product handle and uses compare-and-set for assignments", async () => {
    const client = vi
      .fn<AdminClient>()
      .mockResolvedValueOnce({ product: null })
      .mockResolvedValueOnce({ product: { id: "product", metafield: null } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [{ id: "field", value: "chart" }], userErrors: [] } })
    const adapter = createResourceAdapters(client)["product-chart-assignment"]!
    const data = { productHandle: "jacket", namespace: "custom", key: "size_chart", value: "chart" }
    await expect(adapter.find(data)).rejects.toThrow("No assignment was guessed")
    await adapter.create(data)
    expect(client.mock.calls[2]?.[1]).toMatchObject({
      metafields: [{ ownerId: "product", value: "chart", compareDigest: null }]
    })
  })
})
