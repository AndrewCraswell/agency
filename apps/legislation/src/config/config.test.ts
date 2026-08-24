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
      mcp: { transport: "in-process" },
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

  it("requires complete bounded configuration when MCP HTTP transport is selected", () => {
    expect(
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "https://legislation.example",
        LEGISLATION_MCP_API_BEARER_TOKEN: "service-secret",
        LEGISLATION_MCP_API_TIMEOUT_MS: "12000",
        LEGISLATION_MCP_TRANSPORT: "http"
      }).mcp
    ).toEqual({
      apiBaseUrl: "https://legislation.example",
      bearerToken: "service-secret",
      timeoutMs: 12_000,
      transport: "http"
    })
    expect(() => loadConfig({ LEGISLATION_MCP_TRANSPORT: "http" })).toThrow(ConfigurationError)
    expect(() =>
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "https://legislation.example/mcp",
        LEGISLATION_MCP_TRANSPORT: "http"
      })
    ).toThrow(ConfigurationError)
    expect(() =>
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "https://legislation.example",
        LEGISLATION_MCP_API_TIMEOUT_MS: "60001",
        LEGISLATION_MCP_TRANSPORT: "http"
      })
    ).toThrow(ConfigurationError)
    expect(() => loadConfig({ LEGISLATION_MCP_TRANSPORT: "sidecar" })).toThrow(ConfigurationError)
    expect(
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "http://127.0.0.1:3100",
        LEGISLATION_MCP_TRANSPORT: "http"
      }).mcp
    ).toMatchObject({ apiBaseUrl: "http://127.0.0.1:3100", transport: "http" })
    expect(
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "http://127.0.0.1:3100",
        LEGISLATION_MCP_TRANSPORT: "hybrid"
      }).mcp
    ).toMatchObject({ apiBaseUrl: "http://127.0.0.1:3100", httpMethods: [], transport: "hybrid" })
    expect(
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "http://127.0.0.1:3100",
        LEGISLATION_MCP_HTTP_METHODS: "  ,  ",
        LEGISLATION_MCP_TRANSPORT: "hybrid"
      }).mcp
    ).toMatchObject({ httpMethods: [], transport: "hybrid" })
    expect(() =>
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "http://127.0.0.1:3100",
        LEGISLATION_MCP_HTTP_METHODS: "getBill,notAQueryMethod",
        LEGISLATION_MCP_TRANSPORT: "hybrid"
      })
    ).toThrow(ConfigurationError)
    expect(() =>
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "http://127.0.0.1:3100",
        LEGISLATION_MCP_HTTP_METHODS: "getBill,getBill",
        LEGISLATION_MCP_TRANSPORT: "hybrid"
      })
    ).toThrow(ConfigurationError)
  })

  it("does not expose an HTTP transport bearer token in configuration errors", () => {
    const secret = "do-not-log-this-token"
    let thrown: unknown
    try {
      loadConfig({
        LEGISLATION_MCP_API_BASE_URL: "not-a-url",
        LEGISLATION_MCP_API_BEARER_TOKEN: secret,
        LEGISLATION_MCP_TRANSPORT: "http"
      })
    } catch (error) {
      thrown = error
    }
    expect(String(thrown)).not.toContain(secret)
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
      WORKOS_API_AUDIENCE: "client_environment",
      WORKOS_ISSUER: "https://api.workos.com/user_management/client_test",
      WORKOS_JWKS_URL: "https://api.workos.com/sso/jwks/client_test",
      WORKOS_MCP_AUDIENCE: "https://legislation.example/mcp"
    })

    expect(config.auth).toEqual({
      apiAudience: "client_environment",
      issuer: "https://api.workos.com/user_management/client_test",
      jwksUrl: "https://api.workos.com/sso/jwks/client_test",
      mcpAudience: "https://legislation.example/mcp",
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

  it("requires separate API and MCP audiences in WorkOS mode", () => {
    expect(() =>
      loadConfig({
        AUTH_MODE: "workos",
        WORKOS_API_AUDIENCE: "client_environment",
        WORKOS_ISSUER: "https://issuer.example",
        WORKOS_JWKS_URL: "https://issuer.example/jwks"
      })
    ).toThrow(ConfigurationError)
    expect(() =>
      loadConfig({
        AUTH_MODE: "workos",
        WORKOS_ISSUER: "https://issuer.example",
        WORKOS_JWKS_URL: "https://issuer.example/jwks",
        WORKOS_MCP_AUDIENCE: "https://legislation.example/mcp"
      })
    ).toThrow(ConfigurationError)
  })

  it("uses the existing MCP audience variable during the Railway configuration rollout", () => {
    expect(
      loadConfig({
        AUTH_MODE: "workos",
        WORKOS_API_AUDIENCE: "client_environment",
        WORKOS_AUDIENCE: "https://legislation.example/mcp",
        WORKOS_ISSUER: "https://issuer.example",
        WORKOS_JWKS_URL: "https://issuer.example/jwks"
      }).auth
    ).toEqual({
      apiAudience: "client_environment",
      issuer: "https://issuer.example",
      jwksUrl: "https://issuer.example/jwks",
      mcpAudience: "https://legislation.example/mcp",
      mode: "workos"
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

  it("keeps high-fanout derived workers on a one-connection pool", () => {
    expect(() => loadConfig({ DERIVED_BACKFILL_DATABASE_MAX_CONNECTIONS: "2" })).toThrow(ConfigurationError)
  })

  it("caps an older OCR attempt setting at five", () => {
    expect(loadConfig({ OCR_MAXIMUM_ATTEMPTS: "10" }).ocr.maximumAttempts).toBe(5)
  })
})
