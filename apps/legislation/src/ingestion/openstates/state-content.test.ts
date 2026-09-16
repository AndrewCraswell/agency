import { afterAll, expect, it } from "vitest"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { LocalArtifactStore } from "../documents/artifact-store.js"
import { stateContentScope } from "./state-content-scope.js"
import { processStateContentBatch } from "./state-content.js"

const config = loadConfig({ NODE_ENV: "test" })
const { database, pool } = createDatabase(config.database)
afterAll(async () => {
  await pool.end()
})
const input = { config, database, correlationId: "test" }
const options = { state: "nc" as const, artifactStore: new LocalArtifactStore("unused") }

it("limits the worker to the two approved states", () => {
  expect(stateContentScope.parse("ak")).toBe("ak")
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
})
