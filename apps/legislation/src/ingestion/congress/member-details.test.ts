import { describe, expect, it, vi } from "vitest"
import { hydrateCongressMemberSnapshot } from "./member-details.js"

describe("Congress member detail hydration", () => {
  it("supersedes career-wide collection terms with authoritative detail terms", async () => {
    const member = {
      bioguideId: "A000014",
      name: "Abercrombie, Neil",
      terms: { item: [{ chamber: "House of Representatives", startYear: 1991, endYear: 2011 }] },
      url: "https://api.congress.gov/v3/member/A000014"
    }
    const client = {
      getMember: vi.fn<(bioguideId: string) => Promise<unknown>>().mockResolvedValue({
        bioguideId: "A000014",
        firstName: "Neil",
        lastName: "Abercrombie",
        currentMember: false,
        terms: [
          {
            congress: 105,
            chamber: "House of Representatives",
            startYear: 1997,
            endYear: 1999,
            memberType: "Representative"
          }
        ]
      })
    }
    const snapshot = await hydrateCongressMemberSnapshot(
      [member, member],
      105,
      { retrievedAt: new Date("2026-09-08T00:00:00Z") },
      client
    )
    expect(client.getMember).toHaveBeenCalledTimes(1)
    expect(snapshot.terms).toHaveLength(1)
    expect(snapshot.terms[0]).toMatchObject({ sourceId: "105:lower:1997:1999", officeTitle: "Representative" })
    expect(snapshot.termPersonIds).toEqual(["person:congress:a000014"])
    expect(snapshot.terms[0]?.startDate).toBeUndefined()
    expect(snapshot.terms[0]?.endDate).toBeUndefined()
  })
})
