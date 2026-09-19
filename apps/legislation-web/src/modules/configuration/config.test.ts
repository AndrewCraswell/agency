import { describe, expect, it } from "vitest"
import { ConfigurationError, decodeIdempotencyEncryptionKey, loadConfig } from "./config"

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
const workosEnvironment = {
  AUTH_MODE: "workos",
  WORKOS_API_AUDIENCE: "client_environment",
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_ISSUER: "https://authkit.example",
  WORKOS_JWKS_URL: "https://authkit.example/oauth2/jwks",
  WORKOS_SESSION_ISSUER: "https://api.workos.com",
  WORKOS_SESSION_JWKS_URL: "https://api.workos.com/sso/jwks/client_test",
  WORKOS_MCP_AUDIENCE: "https://legislation.example/mcp"
} as const

describe("loadConfig", () => {
  it("keeps Geocodio server credentials optional and validates the configured base URL", () => {
    expect(loadConfig({}).geocodio).toEqual({ baseUrl: "https://api.geocod.io/v2" })
    expect(
      loadConfig({ GEOCODIO_API_KEY: " synthetic ", GEOCODIO_BASE_URL: "https://api.geocod.io/v2/" }).geocodio
    ).toEqual({
      apiKey: "synthetic",
      baseUrl: "https://api.geocod.io/v2/"
    })
    expect(loadConfig({ GEOCODIO_API_KEY: " " }).geocodio.apiKey).toBeUndefined()
    for (const baseUrl of [
      "http://api.geocod.io/v2",
      "https://user:password@api.geocod.io/v2",
      "https://api.geocod.io/v2?api_key=secret",
      "https://api.geocod.io/v2#fragment"
    ]) {
      expect(() => loadConfig({ GEOCODIO_BASE_URL: baseUrl })).toThrow(ConfigurationError)
    }
  })
  it("keeps regulatory serving closed unless organizations are explicitly configured", () => {
    expect(loadConfig({}).legalApi.allowedOrganizationIds).toEqual([])
    expect(
      loadConfig({ LEGISLATION_LEGAL_API_ORGANIZATIONS: "org-one, org-two" }).legalApi.allowedOrganizationIds
    ).toEqual(["org-one", "org-two"])
  })
  it("provides safe local defaults", () => {
    const config = loadConfig({})

    expect(config).toMatchObject({
      auth: { mode: "disabled" },
      database: {
        apiStatementTimeoutMs: 15_000,
        connectionTimeoutMs: 10_000,
        idleTimeoutMs: 30_000,
        maxConnections: 10,
        url: "postgresql://legislation:legislation@127.0.0.1:55432/legislation"
      },
      environment: "development",
      logging: { level: "info" },
      model: { baseUrl: "https://openrouter.ai/api/v1" },
      passageSearch: { enabled: false },
      server: {
        host: "127.0.0.1",
        port: 3100,
        publicApiBaseUrl: "http://127.0.0.1:3100",
        requestBodyBytes: 1_048_576
      }
    })
  })

  it("keeps the research generation model opt-in", () => {
    expect(loadConfig({}).model.researchAnswerModel).toBeUndefined()
    expect(loadConfig({ RESEARCH_ANSWER_MODEL: "openai/gpt-5-mini" }).model.researchAnswerModel).toBe(
      "openai/gpt-5-mini"
    )
  })

  it("treats explicitly blank optional provider credentials as disabled", () => {
    const config = loadConfig({ OPENROUTER_API_KEY: "", LANGFUSE_PUBLIC_KEY: " ", LANGFUSE_SECRET_KEY: "\t" })
    expect(config.model.apiKey).toBeUndefined()
    expect(config.observability.langfusePublicKey).toBeUndefined()
    expect(config.observability.langfuseSecretKey).toBeUndefined()
    const configured = loadConfig({
      OPENROUTER_API_KEY: " synthetic-key ",
      LANGFUSE_PUBLIC_KEY: " public ",
      LANGFUSE_SECRET_KEY: " secret "
    })
    expect(configured.model.apiKey).toBe("synthetic-key")
    expect(configured.observability.langfusePublicKey).toBe("public")
    expect(configured.observability.langfuseSecretKey).toBe("secret")
  })

  it("keeps ranked passage search off unless its separate database and generation are explicit", () => {
    expect(loadConfig({ PASSAGE_SEARCH_DATABASE_URL: "postgresql://search.example/passages" }).passageSearch).toEqual({
      enabled: false
    })
    expect(() => loadConfig({ PASSAGE_SEARCH_API_ENABLED: "yes" })).toThrow(ConfigurationError)
    expect(() => loadConfig({ PASSAGE_SEARCH_API_ENABLED: "true" })).toThrow(ConfigurationError)
    expect(() =>
      loadConfig({
        PASSAGE_SEARCH_API_ENABLED: "true",
        PASSAGE_SEARCH_DATABASE_URL: "postgresql://search.example/passages"
      })
    ).toThrow(ConfigurationError)

    expect(
      loadConfig({
        PASSAGE_SEARCH_API_ENABLED: "true",
        PASSAGE_SEARCH_API_STATEMENT_TIMEOUT_MS: "7000",
        PASSAGE_SEARCH_DATABASE_URL: "postgresql://search.example/passages",
        PASSAGE_SEARCH_RANKING_GENERATION: "full-corpus-2026-09-12"
      }).passageSearch
    ).toEqual({
      database: {
        apiStatementTimeoutMs: 7000,
        connectionTimeoutMs: 5000,
        idleTimeoutMs: 30000,
        maxConnections: 5,
        url: "postgresql://search.example/passages"
      },
      enabled: true,
      rankingGeneration: "full-corpus-2026-09-12"
    })
  })

  it("bounds the ranked passage query deadline without changing the canonical API deadline", () => {
    expect(() =>
      loadConfig({
        PASSAGE_SEARCH_API_ENABLED: "true",
        PASSAGE_SEARCH_API_STATEMENT_TIMEOUT_MS: "15001",
        PASSAGE_SEARCH_DATABASE_URL: "postgresql://search.example/passages",
        PASSAGE_SEARCH_RANKING_GENERATION: "generation"
      })
    ).toThrow(ConfigurationError)
  })

  it("rejects the canonical database as the ranked passage target", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://database.example/canonical",
        PASSAGE_SEARCH_API_ENABLED: "true",
        PASSAGE_SEARCH_DATABASE_URL: "postgresql://database.example/canonical",
        PASSAGE_SEARCH_RANKING_GENERATION: "generation"
      })
    ).toThrow("PASSAGE_SEARCH_DATABASE_URL must identify a separate database")
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
      LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY: encryptionKey,
      LEGISLATION_PORT: "8080",
      LEGISLATION_PUBLIC_API_BASE_URL: "https://legislation.example",
      LOG_LEVEL: "debug",
      NODE_ENV: "production",
      OPENSTATES_API_KEY: "openstates-key",
      WORKOS_API_AUDIENCE: "client_environment",
      WORKOS_CLIENT_ID: "client_test",
      WORKOS_ISSUER: "https://authkit.example",
      WORKOS_JWKS_URL: "https://authkit.example/oauth2/jwks",
      WORKOS_SESSION_ISSUER: "https://api.workos.com",
      WORKOS_SESSION_JWKS_URL: "https://api.workos.com/sso/jwks/client_test",
      WORKOS_MCP_AUDIENCE: "https://legislation.example/mcp"
    })

    expect(config.auth).toEqual({
      apiAudience: "client_environment",
      clientId: "client_test",
      issuer: "https://authkit.example",
      jwksUrl: "https://authkit.example/oauth2/jwks",
      mode: "workos",
      userSession: {
        clientId: "client_test",
        issuer: "https://api.workos.com",
        jwksUrl: "https://api.workos.com/sso/jwks/client_test"
      }
    })
    expect(config.database).toEqual({
      apiStatementTimeoutMs: 15_000,
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 15_000,
      maxConnections: 20,
      url: "postgresql://user:password@database.example/policy"
    })
    expect(config.environment).toBe("production")
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

  it("requires a valid 32-byte idempotency encryption key in production", () => {
    expect(() =>
      loadConfig({ LEGISLATION_PUBLIC_API_BASE_URL: "https://legislation.example", NODE_ENV: "production" })
    ).toThrow("LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET is required in production")
    expect(() =>
      loadConfig({
        LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET: "too-short",
        LEGISLATION_PUBLIC_API_BASE_URL: "https://legislation.example",
        NODE_ENV: "production"
      })
    ).toThrow("LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET must be a base64 or base64url-encoded 32-byte key")
    expect(
      loadConfig({
        ...workosEnvironment,
        LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET: encryptionKey,
        LEGISLATION_PUBLIC_API_BASE_URL: "https://legislation.example",
        LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY: encryptionKey,
        NODE_ENV: "production"
      }).security.idempotencyEncryptionKey
    ).toBe(encryptionKey)
    expect(decodeIdempotencyEncryptionKey(encryptionKey)).toHaveLength(32)
  })

  it("requires webhook secret protection in production", () => {
    expect(() =>
      loadConfig({
        ...workosEnvironment,
        LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET: encryptionKey,
        LEGISLATION_PUBLIC_API_BASE_URL: "https://legislation.example",
        NODE_ENV: "production"
      })
    ).toThrow("LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY is required in production")
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

  it("requires the AuthKit client ID used to validate user-session client_id", () => {
    const configuration = {
      AUTH_MODE: "workos",
      WORKOS_API_AUDIENCE: "client_environment",
      WORKOS_ISSUER: "https://issuer.example",
      WORKOS_JWKS_URL: "https://issuer.example/jwks",
      WORKOS_MCP_AUDIENCE: "https://legislation.example/mcp",
      WORKOS_SESSION_ISSUER: "https://api.workos.com",
      WORKOS_SESSION_JWKS_URL: "https://api.workos.com/sso/jwks/client_test"
    }

    expect(() => loadConfig(configuration)).toThrow(ConfigurationError)
    expect(loadConfig({ ...configuration, WORKOS_CLIENT_ID: "client_test" }).auth).toMatchObject({
      userSession: {
        issuer: "https://api.workos.com",
        jwksUrl: "https://api.workos.com/sso/jwks/client_test"
      }
    })
  })

  it("requires the API audience without loading the MCP audience", () => {
    expect(() => loadConfig({ ...workosEnvironment, WORKOS_API_AUDIENCE: undefined })).toThrow(ConfigurationError)
    expect(loadConfig({ ...workosEnvironment, WORKOS_MCP_AUDIENCE: undefined }).auth).toMatchObject({
      mode: "workos",
      apiAudience: "client_environment"
    })
  })

  it("requires an independent user-session issuer and JWKS", () => {
    expect(() =>
      loadConfig({
        ...workosEnvironment,
        WORKOS_SESSION_ISSUER: undefined
      })
    ).toThrow(ConfigurationError)
    expect(() =>
      loadConfig({
        ...workosEnvironment,
        WORKOS_SESSION_JWKS_URL: undefined
      })
    ).toThrow(ConfigurationError)
  })

  it("ignores source, OCR and backfill environment settings", () => {
    const config = loadConfig({
      FEDERAL_END_CONGRESS: "117",
      FEDERAL_START_CONGRESS: "118",
      OCR_MAXIMUM_ATTEMPTS: "invalid",
      DERIVED_BACKFILL_DATABASE_MAX_CONNECTIONS: "99",
      AZURE_STORAGE_ACCOUNT: ""
    })
    expect(config).not.toHaveProperty("ingestion")
    expect(config).not.toHaveProperty("ocr")
    expect(config).not.toHaveProperty("backfill")
    expect(config).not.toHaveProperty("azure")
  })

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() => loadConfig({ DATABASE_URL: "https://database.example" })).toThrow(ConfigurationError)
  })

  it("requires the Next API statement deadline to stay within its safe bound", () => {
    expect(() => loadConfig({ DATABASE_API_STATEMENT_TIMEOUT_MS: "999" })).toThrow(ConfigurationError)
    expect(() => loadConfig({ DATABASE_API_STATEMENT_TIMEOUT_MS: "60001" })).toThrow(ConfigurationError)
  })
})
