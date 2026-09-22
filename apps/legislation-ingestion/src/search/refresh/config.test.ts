import { describe, expect, it } from "vitest"
import { nodePostgresEndpoint, productionRefreshEndpoint } from "./config.js"

describe("production refresh configuration", () => {
  it("reads the protected TLS source endpoint", () => {
    expect(
      productionRefreshEndpoint({
        LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL:
          "postgresql://refresh:secret@production.invalid/legislation?sslmode=verify-full"
      })
    ).toContain("production.invalid")
  })

  it("fails closed when the protected value is absent or does not require TLS", () => {
    expect(() => productionRefreshEndpoint({})).toThrow()
    expect(() =>
      productionRefreshEndpoint({
        LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL: "postgresql://refresh:secret@production.invalid/legislation"
      })
    ).toThrow("must require TLS")
  })

  it("uses standard libpq semantics for encrypted Railway connections", () => {
    expect(nodePostgresEndpoint("postgresql://railway.invalid/database?sslmode=require")).toContain(
      "sslmode=require&uselibpqcompat=true"
    )
    expect(nodePostgresEndpoint("postgresql://trusted.invalid/database?sslmode=verify-full")).not.toContain(
      "uselibpqcompat"
    )
  })
})
