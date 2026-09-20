import { describe, expect, it } from "vitest"
import { deploymentCommitSha, deploymentSentryRelease } from "./deployment-identity"

describe("deployment identity", () => {
  it("normalizes Railway's full Git commit SHA", () => {
    expect(deploymentCommitSha({ RAILWAY_GIT_COMMIT_SHA: ` ${"A".repeat(40)} ` })).toBe("a".repeat(40))
  })

  it("rejects abbreviated or malformed commit identities", () => {
    expect(() => deploymentCommitSha({ RAILWAY_GIT_COMMIT_SHA: "abc123" })).toThrow("full 40-character")
  })

  it("uses the deployed commit as the Sentry release and retains the explicit local fallback", () => {
    expect(
      deploymentSentryRelease({
        RAILWAY_GIT_COMMIT_SHA: "B".repeat(40),
        SENTRY_RELEASE: "manual-release"
      })
    ).toBe("b".repeat(40))
    expect(deploymentSentryRelease({ SENTRY_RELEASE: "manual-release" })).toBe("manual-release")
  })
})
