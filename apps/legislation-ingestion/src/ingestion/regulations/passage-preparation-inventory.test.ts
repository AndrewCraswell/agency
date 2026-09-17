import pg from "pg"
import { expect, it, vi } from "vitest"
import { readLegalPassageInventory } from "./passage-preparation.js"

const scope = { kind: "edition" as const, id: "00000000-0000-4000-8000-000000000001" }

function inventoryItem(ordinal: number) {
  return {
    ordinal,
    version_id: `00000000-0000-4000-8000-${String(ordinal + 1).padStart(12, "0")}`,
    context: `US\nCode ${ordinal}`
  }
}

it("reads a large inventory with an exclusive ordinal cursor", async () => {
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const query = vi.spyOn(client, "query").mockImplementation(async (...arguments_) => {
    const values = arguments_[1]
    const afterOrdinal = Number(values?.[1])
    const rows =
      afterOrdinal === -1 ? Array.from({ length: 1000 }, (_, ordinal) => inventoryItem(ordinal)) : [inventoryItem(1000)]
    return { rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }
  })

  const inventory = await readLegalPassageInventory(client, scope, undefined, 1000)

  expect(inventory).toHaveLength(1001)
  expect(inventory.at(-1)?.ordinal).toBe(1000)
  expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("LIMIT $3"), [scope.id, -1, 1000])
  expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("LIMIT $3"), [scope.id, 999, 1000])
})

it("rejects an inventory page larger than the bounded finalization maximum", async () => {
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const query = vi.spyOn(client, "query")

  await expect(readLegalPassageInventory(client, scope, undefined, 1001)).rejects.toThrow()
  expect(query).not.toHaveBeenCalled()
})
