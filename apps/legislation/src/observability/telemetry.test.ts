import { describe, expect, it } from "vitest"
import { sanitizeTelemetry } from "./telemetry.js"

describe("telemetry redaction", () => {
  it("redacts credentials and bounds legislative text", () => {
    const sanitized = sanitizeTelemetry({
      apiKey: "secret",
      authorization: "Bearer abc.def",
      billText: "x".repeat(3000),
      nested: { password: "do-not-log" }
    })

    expect(sanitized).toEqual({
      apiKey: "[REDACTED]",
      authorization: "[REDACTED]",
      billText: `${"x".repeat(2000)}[TRUNCATED]`,
      nested: { password: "[REDACTED]" }
    })
  })
})
