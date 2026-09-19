import { describe, expect, it } from "vitest"
import {
  bindCommitteeInventory,
  parseWashingtonCommitteeInventory,
  readWashingtonCommitteeInventory,
  retainWashingtonCommitteeInventory
} from "./washington-committee-inventory.js"

const row =
  "<Committee><Id>34080</Id><Agency>Senate</Agency><Acronym>LGV</Acronym><Name>Changed name</Name></Committee>"
const xml = `<ArrayOfCommittee>${row}</ArrayOfCommittee>`
describe("retained Washington committee identity inventory", () => {
  it("binds publisher IDs through exact accepted code identities, not names", () => {
    const inventory = parseWashingtonCommitteeInventory(xml, "2025-26")
    const organizations = [{ id: "org:a", upstreamIds: { "waCommittee:senate:LGV": "retained-roster" } }]
    const result = bindCommitteeInventory(organizations, inventory.entries)
    expect(result[0]?.upstreamIds).toHaveProperty("waCommitteeId:2025-26:senate:34080", inventory.sourceUrl)
    expect(bindCommitteeInventory(result, inventory.entries)).toEqual(result)
    expect(organizations[0]?.upstreamIds).not.toHaveProperty("waCommitteeId:2025-26:senate:34080")
    for (const candidates of [
      [],
      [...organizations, { ...organizations[0]!, id: "org:b" }],
      [...organizations, { id: "org:b", upstreamIds: { "waCommitteeId:2025-26:senate:34080": "other" } }]
    ]) {
      expect(() => bindCommitteeInventory(candidates, inventory.entries)).toThrow("missing or ambiguous")
    }
  })
  it("rejects invalid, ambiguous and unsafe inventories", () => {
    for (const text of [
      "<broken>",
      "<ArrayOfCommittee/>",
      `<!DOCTYPE test>${xml}`,
      `<ArrayOfCommittee>${row}${row}</ArrayOfCommittee>`,
      xml.replace("Senate", "Other"),
      xml.replace("34080", "0")
    ])
      expect(() => parseWashingtonCommitteeInventory(text, "2025-26")).toThrow()
    expect(() => parseWashingtonCommitteeInventory(xml, "2024-25")).toThrow()
    expect(() => parseWashingtonCommitteeInventory(xml, "2025-27")).toThrow()
  })
  it("replays exact retained bytes and rejects corruption", async () => {
    const values = new Map<string, Uint8Array>()
    const store = {
      exists: async (path: string) => values.has(path),
      put: async (path: string, bytes: Uint8Array) => {
        values.set(path, bytes)
        return true
      },
      read: async (path: string) => {
        const value = values.get(path)
        if (!value) throw new Error("missing")
        return value
      }
    }
    const retained = await retainWashingtonCommitteeInventory(store, xml, "2025-26")
    expect(await readWashingtonCommitteeInventory(store, retained.path)).toEqual(retained.inventory)
    values.set(retained.path, Buffer.from(xml.replace("Changed name", "Different")))
    await expect(readWashingtonCommitteeInventory(store, retained.path)).rejects.toThrow("checksum mismatch")
    await expect(readWashingtonCommitteeInventory(store, "../source.xml")).rejects.toThrow("Invalid")
  })
})
