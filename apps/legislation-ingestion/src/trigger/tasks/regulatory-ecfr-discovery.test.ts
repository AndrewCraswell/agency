import { afterEach, expect, it, vi } from "vitest"
import { regulatoryEcfrDiscoveryPayloadSchema, runRegulatoryEcfrDiscovery } from "./regulatory-ecfr-discovery.js"

afterEach(() => vi.unstubAllEnvs())

it("accepts only a bounded unique title selection", () => {
  expect(regulatoryEcfrDiscoveryPayloadSchema.parse({ titles: [50, 1] })).toEqual({ titles: [50, 1] })
  for (const input of [{ titles: [1, 1] }, { titles: [0] }, { titles: [51] }, { titles: [] }, { active: true }]) {
    expect(regulatoryEcfrDiscoveryPayloadSchema.safeParse(input).success).toBe(false)
  }
})

it("rejects a search database before opening source discovery", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://example/legislation_passage_search")
  await expect(runRegulatoryEcfrDiscovery({ titles: [1] })).rejects.toThrow(
    "Regulatory discovery requires a canonical PostgreSQL database"
  )
})
