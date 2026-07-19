import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { resolvePrompt } from "./registry"

describe("resolvePrompt", () => {
  it("resolves the scrum-master Linear intake instructions with a content digest", async () => {
    const prompt = await resolvePrompt("scrum_master")

    expect(prompt.content).toContain("pnpm linear:tasks fetch --team FEN --limit 3")
    expect(prompt.content).toContain("select exactly one")
    expect(prompt.content).toContain("sourceWorkItem")
    expect(prompt.sha256).toBe(createHash("sha256").update(prompt.content).digest("hex"))
  })

  it("hands the selected planning result to the engineer without re-triage", async () => {
    const prompt = await resolvePrompt("coder", "v1")

    expect(prompt.content).toContain("PlanningResult")
    expect(prompt.content).toContain("Do not query Linear")
    expect(prompt.role).toBe("coder")
  })

  it("rejects unregistered roles and prompt versions", async () => {
    await expect(resolvePrompt("reviewer")).rejects.toThrow()
    await expect(resolvePrompt("scrum_master", "v2")).rejects.toThrow()
  })
})
