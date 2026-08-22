import { describe, expect, it } from "vitest"
import { loadConfig } from "../../config/config.js"
import { CONGRESS_WAVE_CHILD_CONCURRENCY } from "./request-budget.js"
import { CONGRESS_WAVE_CHILD_DATABASE_CONNECTIONS, congressWaveChildDatabaseConfig } from "./wave-policy.js"

describe("Congress wave database policy", () => {
  it("gives each of the 15 concurrent children operation and heartbeat connections", () => {
    const database = congressWaveChildDatabaseConfig(loadConfig({ NODE_ENV: "test" }))
    expect(database.maxConnections).toBe(CONGRESS_WAVE_CHILD_DATABASE_CONNECTIONS)
    expect(CONGRESS_WAVE_CHILD_DATABASE_CONNECTIONS * CONGRESS_WAVE_CHILD_CONCURRENCY).toBe(30)
  })
})
