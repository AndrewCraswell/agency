import { describe, expect, it } from "vitest"
import { ConfigurationError, loadConfig } from "./config.js"

describe("ingestion configuration", () => {
  it("provides bounded worker defaults", () => {
    expect(loadConfig({})).toMatchObject({
      backfill: {
        derivedDatabaseMaxConnections: 1,
        documentHostAcquireTimeoutMs: 120_000,
        documentHostDefaultSlots: 2,
        documentHostLeaseMs: 90_000
      },
      database: { connectionTimeoutMs: 10_000, idleTimeoutMs: 30_000, maxConnections: 10 },
      environment: "development",
      ingestion: { concurrency: 4, federalEndCongress: 119, federalStartCongress: 113, requestTimeoutMs: 30_000 },
      logging: { level: "info" },
      model: { baseUrl: "https://openrouter.ai/api/v1" },
      ocr: { maximumAttempts: 5 }
    })
  })

  it("starts in production without WorkOS, Next, chat or webhook settings", () => {
    const config = loadConfig({ NODE_ENV: "production", AUTH_MODE: "workos", RESEARCH_ANSWER_MODEL: "" })
    expect(config.environment).toBe("production")
    expect(config).not.toHaveProperty("auth")
    expect(config).not.toHaveProperty("security")
    expect(config).not.toHaveProperty("server")
    expect(config.model).not.toHaveProperty("researchAnswerModel")
  })

  it("maps source and database settings", () => {
    const config = loadConfig({
      DATABASE_CONNECTION_TIMEOUT_MS: "5000",
      DATABASE_IDLE_TIMEOUT_MS: "15000",
      DATABASE_MAX_CONNECTIONS: "20",
      DATABASE_URL: "postgresql://user:password@database.example/policy",
      GOVINFO_API_KEY: "govinfo-key",
      GOVINFO_API_URL: "https://govinfo.example/api/",
      OPENSTATES_API_KEY: "openstates-key"
    })
    expect(config.ingestion).toMatchObject({
      govInfoApiKey: "govinfo-key",
      govInfoApiUrl: "https://govinfo.example/api/",
      openStatesApiKey: "openstates-key"
    })
    expect(config.database).toEqual({
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 15000,
      maxConnections: 20,
      url: "postgresql://user:password@database.example/policy"
    })
  })

  it("rejects an inverted federal range", () => {
    expect(() => loadConfig({ FEDERAL_END_CONGRESS: "117", FEDERAL_START_CONGRESS: "118" })).toThrow(
      "FEDERAL_START_CONGRESS must not exceed FEDERAL_END_CONGRESS"
    )
  })

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() => loadConfig({ DATABASE_URL: "https://database.example" })).toThrow(ConfigurationError)
  })

  it("keeps high-fanout workers on one connection", () => {
    expect(() => loadConfig({ DERIVED_BACKFILL_DATABASE_MAX_CONNECTIONS: "2" })).toThrow(ConfigurationError)
  })

  it("caps an older OCR setting at five attempts", () => {
    expect(loadConfig({ OCR_MAXIMUM_ATTEMPTS: "10" }).ocr.maximumAttempts).toBe(5)
  })
})
