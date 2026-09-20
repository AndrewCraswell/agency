import { LegislationError } from "@repo/legislation-core/domain/errors"
import { describe, expect, it } from "vitest"
import { persistedSourceProjectionContext, projectPersistedSource } from "./persisted-source-projection"

function record() {
  return {
    provenanceComplete: true,
    sourceIsOfficial: false,
    sourceProvider: "published-roster",
    sourceRetrievedAt: new Date("2026-08-23T12:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://api.congress.gov/v3/member/A000001",
    updatedAt: new Date("2026-08-24T12:00:00.000Z")
  }
}

describe("persisted source projection", () => {
  it("preserves explicit source facts independently of the URL and record update time", () => {
    expect(projectPersistedSource(record(), "person")).toEqual({
      isOfficial: false,
      provider: "published-roster",
      retrievedAt: new Date("2026-08-23T12:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/member/A000001"
    })
  })

  it("retains each source in order and the first record's update time", () => {
    const first = record()
    const second = {
      ...record(),
      sourceIsOfficial: true,
      sourceProvider: "official-profile",
      sourceRetrievedAt: new Date("2026-08-25T12:00:00.000Z"),
      sourceUpdatedAt: new Date("2026-08-21T12:00:00.000Z"),
      sourceUrl: "https://example.test/profile",
      updatedAt: new Date("2026-08-26T12:00:00.000Z")
    }
    expect(persistedSourceProjectionContext([first, second], "https://api.example.test", "person detail")).toEqual({
      apiBaseUrl: "https://api.example.test",
      sources: [
        {
          isOfficial: false,
          provider: "published-roster",
          retrievedAt: first.sourceRetrievedAt,
          sourceUpdatedAt: null,
          sourceUrl: first.sourceUrl
        },
        {
          isOfficial: true,
          provider: "official-profile",
          retrievedAt: second.sourceRetrievedAt,
          sourceUpdatedAt: second.sourceUpdatedAt,
          sourceUrl: second.sourceUrl
        }
      ],
      updatedAt: first.updatedAt
    })
  })

  it.each([
    { provenanceComplete: false },
    { sourceIsOfficial: null },
    { sourceProvider: null },
    { sourceProvider: " " },
    { sourceRetrievedAt: null },
    { sourceRetrievedAt: new Date("invalid") },
    { sourceUrl: null },
    { sourceUrl: " " }
  ])("rejects incomplete source facts: %j", (overrides) => {
    expect(() => projectPersistedSource({ ...record(), ...overrides }, "person")).toThrow(
      new LegislationError("unprocessable", "person canonical provenance is incomplete")
    )
  })

  it.each(["provenanceComplete", "sourceIsOfficial", "sourceProvider", "sourceRetrievedAt", "sourceUrl"])(
    "rejects a missing %s rather than inventing a value",
    (field) => {
      const incomplete = record()
      Reflect.deleteProperty(incomplete, field)
      expect(() => projectPersistedSource(incomplete, "person")).toThrow(
        new LegislationError("unprocessable", "person canonical provenance is incomplete")
      )
    }
  )

  it("rejects incomplete secondary sources instead of returning only the primary source", () => {
    expect(() =>
      persistedSourceProjectionContext(
        [record(), { ...record(), sourceProvider: null }],
        "https://api.example.test",
        "person detail"
      )
    ).toThrow("person detail canonical provenance is incomplete")
  })
})
