import { describe, expect, it } from "vitest"
import { validateLegalAgenciesResponse } from "./legal-agencies-contract"

const entry = {
  status: "unresolved" as const,
  organizationId: null,
  sourceAgencyId: "fr-agency-406",
  name: "Personnel Management Office",
  aliases: ["Office of Personnel Management"],
  sourceId: "federal-register" as const,
  nativeId: "406",
  jurisdictionId: "jurisdiction:us" as const,
  publicationCount: 3,
  firstPublishedOn: "2000-01-18",
  lastPublishedOn: "2001-02-01"
}

describe("legal agency directory contract", () => {
  it("accepts source identities and matches aliases", () => {
    const response = {
      data: [entry],
      links: { self: "/api/legal/agencies?q=office", next: null },
      meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
    }
    expect(validateLegalAgenciesResponse(response, { q: "OFFICE" }).data).toEqual([entry])
  })

  it("rejects inferred resolution, duplicate aliases and mismatched filters", () => {
    const envelope = (data: unknown[]) => ({
      data,
      links: { self: "/api/legal/agencies", next: null },
      meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
    })
    expect(() =>
      validateLegalAgenciesResponse(envelope([{ ...entry, organizationId: "organization:us:opm" }]), {})
    ).toThrow()
    expect(() => validateLegalAgenciesResponse(envelope([{ ...entry, aliases: [entry.name] }]), {})).toThrow()
    expect(() => validateLegalAgenciesResponse(envelope([entry]), { q: "treasury" })).toThrow(
      "legal_agencies_response_mismatch"
    )
  })
})
