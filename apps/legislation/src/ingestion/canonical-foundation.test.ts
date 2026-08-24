import { describe, expect, it } from "vitest"
import {
  canonicalFoundationRecordSchema,
  isJurisdictionFoundationComplete,
  isSessionFoundationComplete,
  parseCanonicalFoundationContentHash
} from "./canonical-foundation.js"

const provenance = {
  isOfficial: true,
  provider: "official-legislature",
  retrievedAt: "2026-08-24T12:00:00.000Z",
  sourceUpdatedAt: null,
  url: "https://legislature.example.test/about"
}

describe("canonical jurisdiction and session foundation", () => {
  it("accepts only source-backed records with every route-required fact", () => {
    expect(
      canonicalFoundationRecordSchema.parse({
        id: "jurisdiction:wa",
        isActive: true,
        kind: "jurisdiction",
        source: provenance,
        timezone: "America/Los_Angeles"
      })
    ).toMatchObject({ kind: "jurisdiction", timezone: "America/Los_Angeles" })

    expect(() =>
      canonicalFoundationRecordSchema.parse({
        classification: "regular",
        id: "session:wa:2025-2026",
        kind: "session",
        source: provenance
      })
    ).toThrow("Invalid input")
  })

  it("allows an explicitly unknown timezone but never an unknown active state or partial provenance", () => {
    const complete = {
      id: "jurisdiction:wa",
      isActive: true,
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "official-legislature",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/about"
    }
    expect(isJurisdictionFoundationComplete(complete)).toBe(true)
    expect(isJurisdictionFoundationComplete({ ...complete, isActive: null })).toBe(false)
    expect(isJurisdictionFoundationComplete({ ...complete, provenanceComplete: false })).toBe(false)
  })

  it("fails closed when a session lacks its publisher classification", () => {
    const complete = {
      classification: "regular",
      id: "session:wa:2025-2026",
      isActive: false,
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "official-legislature",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/sessions/2025-2026"
    }
    expect(isSessionFoundationComplete(complete)).toBe(true)
    expect(isSessionFoundationComplete({ ...complete, classification: null })).toBe(false)
  })

  it("requires a lowercase SHA-256 snapshot identity before resuming a checkpoint", () => {
    expect(parseCanonicalFoundationContentHash("a".repeat(64))).toBe("a".repeat(64))
    expect(() => parseCanonicalFoundationContentHash("A".repeat(64))).toThrow("contentHash")
    expect(() => parseCanonicalFoundationContentHash("not-a-hash")).toThrow("contentHash")
  })
})
