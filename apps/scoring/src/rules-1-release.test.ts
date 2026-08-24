import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { RULES_ONE_RELEASE, validateRulesOneRelease, verifyRulesOneReleaseSourceSnapshot } from "./rules-1-release.js"

function releaseCopy(): unknown {
  return JSON.parse(JSON.stringify(RULES_ONE_RELEASE))
}

function digestAtReleaseRevision(sourceRevision: string, path: string): string {
  const source = execFileSync("git", ["show", `${sourceRevision}:${path}`])
  return `sha256:${createHash("sha256").update(source).digest("hex")}`
}

describe("rules-1 release record", () => {
  it("pins complete M1 host evidence to the reviewed source snapshot", () => {
    const release = validateRulesOneRelease(RULES_ONE_RELEASE)

    expect(release.review).toEqual({
      approvalStatus: "approved-root",
      requiredRole: "root-independent-reviewer",
      reviewer: "root-independent-reviewer"
    })
    expect(release.artifacts).toHaveLength(39)
    expect(new Set(release.artifacts.map((artifact) => artifact.path)).size).toBe(release.artifacts.length)
    expect(release.traceabilityIds).toEqual([
      "GEN-03",
      "GEN-04",
      "EPEE-01",
      "EPEE-02",
      "EPEE-03",
      "EPEE-04",
      "EPEE-05",
      "FOIL-01",
      "FOIL-02",
      "FOIL-03",
      "FOIL-04",
      "FOIL-05",
      "SABRE-01",
      "SABRE-02",
      "SABRE-03",
      "SABRE-04",
      "SABRE-05",
      "SABRE-06",
      "SABRE-07"
    ])

    expect(verifyRulesOneReleaseSourceSnapshot(release, digestAtReleaseRevision)).toBe(release)
  }, 60_000)

  it("fails closed for missing, duplicate, extra, and stale release identities", () => {
    const missing = releaseCopy()
    if (
      typeof missing === "object" &&
      missing !== null &&
      "traceabilityIds" in missing &&
      Array.isArray(missing.traceabilityIds)
    ) {
      missing.traceabilityIds.pop()
    }
    expect(() => validateRulesOneRelease(missing)).toThrow(new RangeError("Invalid rules-1 traceability identities"))

    const duplicate = releaseCopy()
    if (
      typeof duplicate === "object" &&
      duplicate !== null &&
      "artifacts" in duplicate &&
      Array.isArray(duplicate.artifacts)
    ) {
      duplicate.artifacts[1] = duplicate.artifacts[0]
    }
    expect(() => validateRulesOneRelease(duplicate)).toThrow(new RangeError("Invalid rules-1 artifact identities"))

    const extra = releaseCopy()
    if (typeof extra === "object" && extra !== null && "verification" in extra && Array.isArray(extra.verification)) {
      extra.verification.push({ command: "pnpm --filter scoring test", id: "extra", requiredResult: "pass" })
    }
    expect(() => validateRulesOneRelease(extra)).toThrow(new RangeError("Invalid rules-1 verification identities"))

    const stale = releaseCopy()
    if (typeof stale === "object" && stale !== null && "artifacts" in stale && Array.isArray(stale.artifacts)) {
      const first = stale.artifacts[0]
      if (typeof first === "object" && first !== null && "sourceDigest" in first)
        first.sourceDigest = `sha256:${"0".repeat(64)}`
    }
    expect(() => validateRulesOneRelease(stale)).not.toThrow()
    expect(() => verifyRulesOneReleaseSourceSnapshot(stale, digestAtReleaseRevision)).toThrow(
      new RangeError("Stale rules-1 source digest: apps/scoring/docs/fie-traceability-matrix.md")
    )
  })

  it("enforces the root handoff state and never embeds timing values", () => {
    const invalidHandoff = releaseCopy()
    if (
      typeof invalidHandoff === "object" &&
      invalidHandoff !== null &&
      "review" in invalidHandoff &&
      typeof invalidHandoff.review === "object" &&
      invalidHandoff.review !== null &&
      "reviewer" in invalidHandoff.review &&
      "approvalStatus" in invalidHandoff.review
    ) {
      invalidHandoff.review.approvalStatus = "approved-root"
      invalidHandoff.review.reviewer = null
    }
    expect(() => validateRulesOneRelease(invalidHandoff)).toThrow(new RangeError("Invalid rules-1 review handoff"))

    expect(JSON.stringify(RULES_ONE_RELEASE)).not.toContain("timingValues")
    expect(JSON.stringify(RULES_ONE_RELEASE)).not.toContain("boundaryUs")
  })
})
