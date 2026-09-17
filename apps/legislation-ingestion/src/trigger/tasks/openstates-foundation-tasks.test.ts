import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("Open States foundation Trigger contract", () => {
  it("serializes immutable archive replays and keeps scheduling disabled", async () => {
    const source = await readFile(new URL("./openstates-foundation-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-foundation-import"')
    expect(source).toContain('name: "openstates-foundation-publication", concurrencyLimit: 1')
    expect(source).toContain("importArchivedStateFoundation")
    expect(source).not.toContain("schedules.task")
  })
})
