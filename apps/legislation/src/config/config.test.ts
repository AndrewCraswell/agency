import { describe, expect, it } from "vitest"
import { ConfigurationError, loadConfig } from "./config.js"

describe("loadConfig", () => {
  it("provides safe local defaults", () => {
    const config = loadConfig({})

    expect(config).toMatchObject({
      auth: { mode: "disabled" },
      backfill: {
        derivedDatabaseMaxConnections: 1,
        documentHostAcquireTimeoutMs: 120_000,
        documentHostDefaultSlots: 2,
        documentHostLeaseMs: 90_000
      },
      database: {
        connectionTimeoutMs: 10_000,
        idleTimeoutMs: 30_000,
        maxConnections: 10,
        url: "postgresql://legislation:legislation@127.0.0.1:55432/legislation"
      },
      environment: "development",
      ingestion: {
        concurrency: 4,
        federalEndCongress: 119,
        federalStartCongress: 113,
        requestTimeoutMs: 30_000
      },
      logging: { level: "info" },
      model: { baseUrl: "https://openrouter.ai/api/v1" },
      ocr: { maximumAttempts: 5 },
      server: {
        host: "127.0.0.1",
        port: 3100,
        publicApiBaseUrl: "http://127.0.0.1:3100",
        requestBodyBytes: 1_048_576
      }
    })
  })

  it("parses configured values", () => {
    const config = loadConfig({
      AUTH_MODE: "workos",
      DATABASE_CONNECTION_TIMEOUT_MS: "5000",
      DATABASE_IDLE_TIMEOUT_MS: "15000",
      DATABASE_MAX_CONNECTIONS: "20",
      DATABASE_URL: "postgresql://user:password@database.example/policy",
      GOVINFO_API_KEY: "govinfo-key",
      GOVINFO_API_URL: "https://govinfo.example/api/",
      LEGISLATION_HOST: "0.0.0.0",
      LEGISLATION_PORT: "8080",
      LEGISLATION_PUBLIC_API_BASE_URL: "https://legislation.example",
      LOG_LEVEL: "debug",
      NODE_ENV: "production",
      OPENSTATES_API_KEY: "openstates-key",
      WORKOS_AUDIENCE: "https://legislation.example/mcp",
      WORKOS_ISSUER: "https://api.workos.com/user_management/client_test",
      WORKOS_JWKS_URL: "https://api.workos.com/sso/jwks/client_test"
    })

    expect(config.auth).toEqual({
      audience: "https://legislation.example/mcp",
      issuer: "https://api.workos.com/user_management/client_test",
      jwksUrl: "https://api.workos.com/sso/jwks/client_test",
      mode: "workos"
    })
    expect(config.database).toEqual({
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 15_000,
      maxConnections: 20,
      url: "postgresql://user:password@database.example/policy"
    })
    expect(config.environment).toBe("production")
    expect(config.ingestion).toMatchObject({
      govInfoApiKey: "govinfo-key",
      govInfoApiUrl: "https://govinfo.example/api/",
      openStatesApiKey: "openstates-key"
    })
    expect(config.server).toMatchObject({
      host: "0.0.0.0",
      port: 8080,
      publicApiBaseUrl: "https://legislation.example"
    })
  })

  it("uses Railway's injected port and public container bind address", () => {
    const config = loadConfig({ LEGISLATION_PORT: "3100", PORT: "4567" })

    expect(config.server).toMatchObject({ host: "0.0.0.0", port: 4567 })
  })

  it("requires an http or https public API URL in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(ConfigurationError)
    expect(() => loadConfig({ LEGISLATION_PUBLIC_API_BASE_URL: "ftp://legislation.example" })).toThrow(
      ConfigurationError
    )
    expect(loadConfig({ LEGISLATION_PUBLIC_API_BASE_URL: "http://legislation.example" }).server.publicApiBaseUrl).toBe(
      "http://legislation.example"
    )
  })

  it.each(["0", "65536", "not-a-port"])('rejects invalid port "%s" without including secrets', (port) => {
    const secret = "must-not-appear"

    expect(() => loadConfig({ LEGISLATION_PORT: port, OPENROUTER_API_KEY: secret })).toThrow(ConfigurationError)
    let caught: unknown
    try {
      loadConfig({ LEGISLATION_PORT: port, OPENROUTER_API_KEY: secret })
    } catch (error) {
      caught = error
    }
    expect(String(caught)).not.toContain(secret)
  })

  it("rejects incomplete WorkOS configuration", () => {
    expect(() => loadConfig({ AUTH_MODE: "workos", WORKOS_ISSUER: "https://issuer.example" })).toThrow(
      ConfigurationError
    )
  })

  it("rejects an inverted federal range", () => {
    expect(() => loadConfig({ FEDERAL_END_CONGRESS: "117", FEDERAL_START_CONGRESS: "118" })).toThrow(
      "FEDERAL_START_CONGRESS must not exceed FEDERAL_END_CONGRESS"
    )
  })

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() => loadConfig({ DATABASE_URL: "https://database.example" })).toThrow(ConfigurationError)
  })

  it("keeps high-fanout derived workers on a one-connection pool", () => {
    expect(() => loadConfig({ DERIVED_BACKFILL_DATABASE_MAX_CONNECTIONS: "2" })).toThrow(ConfigurationError)
  })

  it("caps an older OCR attempt setting at five", () => {
    expect(loadConfig({ OCR_MAXIMUM_ATTEMPTS: "10" }).ocr.maximumAttempts).toBe(5)
  })
})
