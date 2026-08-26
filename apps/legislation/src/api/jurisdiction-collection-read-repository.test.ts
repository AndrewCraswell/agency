import { describe, expect, it } from "vitest"
import { JurisdictionCollectionRepository } from "./jurisdiction-collection-read-repository.js"

describe("jurisdiction collection repository", () => {
  it("forwards the complete collection input to the canonical store", async () => {
    let received: unknown
    const repository = new JurisdictionCollectionRepository({
      listJurisdictions: async (input) => {
        received = input
        return { items: [], truncated: false }
      }
    })
    const input = { classification: ["state"] as const, cursor: "cursor", isActive: true, limit: 10, q: "ca" }

    await expect(repository.listJurisdictions(input)).resolves.toEqual({ items: [], truncated: false })
    expect(received).toEqual(input)
  })
})
