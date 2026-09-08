import { describe, expect, it, vi } from "vitest"
import { createResourceAdapters, definitionConflict } from "./adapters.ts"
import type { AdminClient } from "./client.ts"

const connection = (nodes: unknown[]) => ({ resources: { nodes, pageInfo: { hasNextPage: false } } })
const success = (resource: unknown) => ({ result: { resource, userErrors: [] } })

describe("resource adapter lifecycle", () => {
  it("validates and provisions definitions, fields, entries, pages and menus", async () => {
    const client = vi.fn<AdminClient>()
    const registry = createResourceAdapters(client)
    const cases = [
      {
        kind: "metaobject-definition",
        data: {
          type: "guide",
          name: "Guide",
          access: { storefront: "PUBLIC_READ" },
          fieldDefinitions: [{ key: "title", name: "Title", type: "single_line_text_field" }]
        },
        response: { resource: null },
        created: { id: "definition", type: "guide" }
      },
      {
        kind: "product-metafield-definition",
        data: {
          namespace: "custom",
          key: "size_chart",
          name: "Size chart",
          ownerType: "PRODUCT",
          type: "metaobject_reference"
        },
        response: connection([]),
        created: { id: "field-definition" }
      },
      {
        kind: "metaobject",
        data: { type: "guide", handle: "body", fields: { title: "Body" } },
        response: { resource: null },
        created: { id: "guide", handle: "body" }
      },
      {
        kind: "page",
        data: { handle: "size-charts", title: "Size charts" },
        response: connection([]),
        created: { id: "page", handle: "size-charts" }
      },
      {
        kind: "menu",
        data: { handle: "size-charts", title: "Size charts", items: [{ type: "FRONTPAGE", title: "Home" }] },
        response: connection([]),
        created: { id: "menu", handle: "size-charts" }
      }
    ]
    for (const item of cases) {
      const adapter = registry[item.kind]!
      adapter.validate(item.data)
      expect(adapter.identity(item.data)).toBeTruthy()
      client.mockResolvedValueOnce(item.response)
      expect(await adapter.find(item.data)).toBeUndefined()
      client.mockResolvedValueOnce(success(item.created))
      expect((await adapter.create(item.data)).id).toBe(item.created.id)
    }
    client.mockResolvedValueOnce(success({ id: "page", handle: "size-charts" }))
    expect(
      (await registry.page!.replace?.({ id: "page", state: {} }, { handle: "size-charts", title: "New title" }))?.id
    ).toBe("page")
    client.mockResolvedValueOnce({ resource: { id: "guide", handle: "body" } })
    expect((await registry.metaobject!.find({ type: "guide", handle: "body" }))?.id).toBe("guide")
    client.mockResolvedValueOnce(connection([{ id: "definition" }]))
    expect((await registry["product-metafield-definition"]!.find({ namespace: "custom", key: "size_chart" }))?.id).toBe(
      "definition"
    )
    client.mockResolvedValueOnce(connection([{ id: "one" }, { id: "two" }]))
    await expect(
      registry["product-metafield-definition"]!.find({ namespace: "custom", key: "size_chart" })
    ).rejects.toThrow("Ambiguous")
    client.mockResolvedValueOnce(success({ id: "page", handle: "unexpected" }))
    await expect(registry.page!.create({ handle: "size-charts", title: "Size charts" })).rejects.toThrow(
      "changed the requested handle"
    )
  })

  it("checks exact reference validation and additional definition requirements", () => {
    const registry = createResourceAdapters(async () => undefined)
    const field = {
      namespace: "custom",
      key: "chart",
      name: "Chart",
      ownerType: "PRODUCT",
      type: "metaobject_reference",
      validations: [{ name: "metaobject_definition_id", value: "definition" }]
    }
    const existing = { id: "field", state: { type: { name: "metaobject_reference" }, validations: field.validations } }
    expect(registry["product-metafield-definition"]!.conflict?.(existing, field)).toBeUndefined()
    expect(
      registry["product-metafield-definition"]!.conflict?.(
        { ...existing, state: { type: { name: "single_line_text_field" }, validations: [] } },
        field
      )
    ).toContain("Incompatible")
    const desired = {
      type: "guide",
      name: "Guide",
      access: { storefront: "PUBLIC_READ" },
      displayNameKey: "title",
      fieldDefinitions: [{ key: "title", name: "Title", type: "single_line_text_field" }]
    }
    const remote = {
      displayNameKey: "title",
      access: desired.access,
      capabilities: {},
      fieldDefinitions: [{ key: "title", required: false, type: { name: "single_line_text_field" }, validations: [] }]
    }
    expect(definitionConflict({ id: "definition", state: remote }, desired)).toBeUndefined()
    expect(definitionConflict({ id: "definition", state: { ...remote, displayNameKey: "other" } }, desired)).toContain(
      "display-name"
    )
    expect(
      definitionConflict(
        {
          id: "definition",
          state: {
            ...remote,
            fieldDefinitions: [
              ...remote.fieldDefinitions,
              { key: "extra", required: true, type: { name: "single_line_text_field" }, validations: [] }
            ]
          }
        },
        desired
      )
    ).toContain("Unexpected required")
    expect(
      definitionConflict(
        {
          id: "definition",
          state: { ...remote, capabilities: { onlineStore: { enabled: true, data: { urlHandle: "other" } } } }
        },
        { ...desired, capabilities: { onlineStore: { enabled: true, data: { urlHandle: "charts" } } } }
      )
    ).toContain("prefix")
    expect(() =>
      registry.menu!.validate({
        handle: "menu",
        title: "Menu",
        items: [{ title: "Bad", type: "HTTP", url: "javascript:alert(1)" }]
      })
    ).toThrow("HTTP(S)")
  })

  it("preserves existing product assignments and detects compare-and-set errors", async () => {
    const client = vi.fn<AdminClient>()
    const adapter = createResourceAdapters(client)["product-chart-assignment"]!
    const data = { productHandle: "jacket", namespace: "custom", key: "size_chart", value: "new-chart" }
    adapter.validate(data)
    expect(adapter.identity(data)).toBe("jacket/custom.size_chart")
    const metafield = { id: "field", type: "metaobject_reference", value: "chart", compareDigest: "digest" }
    client.mockResolvedValue({ product: { id: "product", metafield } })
    expect((await adapter.find(data))?.state).toEqual(metafield)
    expect(adapter.conflict?.({ id: "field", state: metafield }, data)).toBeUndefined()
    expect(adapter.conflict?.({ id: "field", state: { type: "json" } }, data)).toContain("not a metaobject")
    await expect(adapter.create(data)).rejects.toThrow("changed before writing")
    client
      .mockResolvedValueOnce({ product: { id: "product", metafield } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [{ id: "field", value: "new-chart" }], userErrors: [] } })
    expect((await adapter.replace?.({ id: "field", state: metafield }, data))?.id).toBe("field")
    client
      .mockResolvedValueOnce({ product: { id: "product", metafield: null } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: null, userErrors: [{ message: "Digest changed" }] } })
    await expect(adapter.create(data)).rejects.toThrow("Digest changed")
    client
      .mockResolvedValueOnce({ product: { id: "product", metafield: null } })
      .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } })
    await expect(adapter.create(data)).rejects.toThrow("no product assignment")
  })
})
