import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("Open States action provenance Trigger contract", () => {
  it("is serialized, resumable and unscheduled", async () => {
    const source = await readFile(new URL("./openstates-action-provenance-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-action-provenance-reconcile"')
    expect(source).toContain('name: "openstates-action-provenance", concurrencyLimit: 1')
    expect(source).toContain("reconcileActionProvenanceBatch")
    expect(source).toContain("afterBillId: result.nextAfterBillId")
    expect(source).not.toContain("schedules.task")
  })
})
