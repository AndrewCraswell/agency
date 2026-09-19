import { createDatabase } from "@repo/legislation-core/database/database"
import { afterAll, expect, it } from "vitest"
import { loadConfig } from "../../config/config.js"
import { LocalArtifactStore } from "../documents/artifact-store.js"
import { stateContentScope, stateContentSession } from "./state-content-scope.js"
import { processStateContentBatch } from "./state-content.js"

const config = loadConfig({ NODE_ENV: "test" })
const { database, pool } = createDatabase(config.database)
afterAll(async () => {
  await pool.end()
})
const input = { config, database, correlationId: "test" }
const options = { state: "nc" as const, artifactStore: new LocalArtifactStore("unused") }

it("limits content capability to reviewed states with consistent default sessions", () => {
  expect(stateContentScope.parse("ak")).toBe("ak")
  expect(stateContentScope.parse("wa")).toBe("wa")
  expect(stateContentSession("wa")).toBe("2025-2026")
  expect(stateContentSession("ak")).toBe("34")
  expect(stateContentSession("nc")).toBe("2025")
  expect(stateContentSession("nc", "2017E1")).toBe("2017e1")
  expect(stateContentSession("wa", "2017-2018")).toBe("2017-2018")
  expect(() => stateContentSession("wa", "2025%")).toThrow()
  expect(() => stateContentScope.parse("ca")).toThrow(/Invalid option/)
})
it("rejects unsafe batch sizes before any database or provider access", async () => {
  await expect(processStateContentBatch(input, { ...options, billLimit: 11 })).rejects.toThrow(/Too big/)
  await expect(processStateContentBatch(input, { ...options, documentLimit: 0 })).rejects.toThrow(/Too small/)
  await expect(processStateContentBatch(input, { ...options, billConcurrency: 5 })).rejects.toThrow(/Too big/)
  await expect(processStateContentBatch(input, { ...options, session: "2017%" })).rejects.toThrow(/Invalid/)
})
it("requires embedding configuration before claiming or processing documents", async () => {
  await expect(processStateContentBatch(input, options)).rejects.toThrow("before starting")
  await expect(processStateContentBatch(input, { ...options, state: "wa" })).rejects.toThrow("before starting")
})
