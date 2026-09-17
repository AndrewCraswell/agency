import { describe, expect, it } from "vitest"
import { sanitizeTelemetry } from "./sanitize-telemetry"

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
      billText: "[REDACTED]",
      nested: { password: "[REDACTED]" }
    })
  })
  it("redacts URL credentials, cookies and bodies while retaining diagnostic identities", () => {
    const input: Record<string, unknown> = {
      url: "https://user:private@example.org/path?token=private",
      cookie: "private",
      body: "private",
      recordId: "bill:us:116:hr:1",
      query: "HR 1"
    }
    input.self = input
    const result = JSON.stringify(sanitizeTelemetry(input))
    expect(result).not.toContain("private")
    expect(result).toContain("[CIRCULAR]")
    expect(result).toContain("bill:us:116:hr:1")
    expect(result).toContain("HR 1")
  })
})
