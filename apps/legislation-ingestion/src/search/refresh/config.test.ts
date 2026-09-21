import { describe, expect, it } from "vitest"
import { productionRefreshEndpoint } from "./config.js"

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
})
