import { describe, expect, it } from "vitest"
import { postgresRuntimeConfiguration } from "./postgres"

describe("postgresRuntimeConfiguration", () => {
  it("enforces certificate verification and bounded sessions for Azure PostgreSQL", () => {
    const configuration = postgresRuntimeConfiguration({
      POSTGRES_API_URL: "postgresql://agent:secret@agency.postgres.database.azure.com/agentic",
      POSTGRES_PROVIDER: "azure",
      POSTGRES_POOL_MAX: "8"
    })
    const url = new URL(configuration.connectionString)

    expect(configuration.provider).toBe("azure")
    expect(configuration.authMode).toBe("azure-entra")
    expect(configuration.pool).toMatchObject({ max: 8, ssl: { rejectUnauthorized: true } })
    expect(configuration.pool.password).toBeTypeOf("function")
    expect(url.searchParams.get("sslmode")).toBe("verify-full")
    expect(url.searchParams.get("options")).toContain("statement_timeout=60000")
    expect(url.searchParams.get("options")).toContain("idle_in_transaction_session_timeout=60000")
  })

  it("rejects a non-Azure host in Azure provider mode", () => {
    expect(() =>
      postgresRuntimeConfiguration({
        POSTGRES_API_URL: "postgresql://agent:secret@example.test/agentic",
        POSTGRES_PROVIDER: "azure"
      })
    ).toThrow("Azure Database for PostgreSQL hostname")
  })
})
