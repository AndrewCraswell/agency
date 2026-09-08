import { describe, expect, it } from "vitest"
import { orderResources, resolveReferences } from "./dependencies.ts"

describe("content dependencies", () => {
  it("orders dependencies before resources and resolves destination IDs", () => {
    const resources = [
      { key: "chart", kind: "metaobject", data: { fields: { guide: { $ref: "guide" } } } },
      { key: "guide", kind: "metaobject", data: { title: "How to measure" } }
    ]
    expect(orderResources(resources).map((resource) => resource.key)).toEqual(["guide", "chart"])
    expect(resolveReferences(resources[0]?.data, new Map([["guide", { id: "destination-guide" }]]))).toEqual({
      fields: { guide: "destination-guide" }
    })
  })

  it("rejects duplicate keys, missing references and dependency cycles", () => {
    const resource = { key: "chart", kind: "metaobject", data: {} }
    expect(() => orderResources([resource, resource])).toThrow("unique")
    expect(() => orderResources([{ ...resource, dependsOn: ["missing"] }])).toThrow("Unknown")
    expect(() => orderResources([{ ...resource, data: { parent: { $ref: "chart" } } }])).toThrow("cycle")
  })

  it("resolves URLs without copying source-store URLs and rejects unavailable fields", () => {
    const resources = new Map([["chart", { id: "destination-chart", url: "/pages/size-charts/mens-jackets" }]])
    expect(resolveReferences([{ $ref: "chart", field: "url" }, "unchanged"], resources)).toEqual([
      "/pages/size-charts/mens-jackets",
      "unchanged"
    ])
    expect(() => resolveReferences({ $ref: "missing" }, resources)).toThrow("Unresolved")
    expect(() => resolveReferences({ $ref: "chart", field: "url" }, new Map([["chart", { id: "chart" }]]))).toThrow(
      "url"
    )
  })
})
