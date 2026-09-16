import { describe, expect, it } from "vitest"
import { formatSmokeProcessOutput } from "./smoke-process-diagnostics"

describe("smoke process diagnostics", () => {
  it("surfaces stdout-only startup failures", () => {
    expect(
      formatSmokeProcessOutput({
        secrets: [],
        stderrTail: "",
        stdoutTail: "configuration rejected before the logger initialized"
      })
    ).toBe("stdout: configuration rejected before the logger initialized")
  })

  it("redacts known and structured secrets from both streams", () => {
    const output = formatSmokeProcessOutput({
      secrets: ["explicit-smoke-secret"],
      stderrTail: "authorization: Bearer hidden-auth-value postgresql://user:pass@database/internal",
      stdoutTail: "token=explicit-smoke-secret api_key=provider-key"
    })

    expect(output).toContain("stdout:")
    expect(output).toContain("stderr:")
    expect(output).not.toContain("explicit-smoke-secret")
    expect(output).not.toContain("hidden-auth-value")
    expect(output).not.toContain("provider-key")
    expect(output).not.toContain("user:pass")
  })

  it("bounds each captured stream tail", () => {
    const output = formatSmokeProcessOutput({
      secrets: [],
      stderrTail: `discard-stderr-${"e".repeat(3_000)}`,
      stdoutTail: `discard-stdout-${"o".repeat(3_000)}`
    })

    expect(output).not.toContain("discard-stdout")
    expect(output).not.toContain("discard-stderr")
    expect(output.length).toBeLessThanOrEqual(4_020)
  })
})
