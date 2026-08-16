import { readFile } from "node:fs/promises"
import { beforeAll, describe, expect, it } from "vitest"
import { normalizeGovInfoBillStatus } from "./normalize.js"

let fixture = ""
let sparseFixture = ""

beforeAll(async () => {
  fixture = await readFile(new URL("../../../tests/fixtures/govinfo/BILLSTATUS-119hr1234.xml", import.meta.url), "utf8")
  sparseFixture = await readFile(
    new URL("../../../tests/fixtures/govinfo/BILLSTATUS-118s77-sparse.xml", import.meta.url),
    "utf8"
  )
})

describe("GovInfo normalization", () => {
  it("normalizes official status and versions into a federal aggregate", () => {
    const aggregate = normalizeGovInfoBillStatus(fixture, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.bill).toMatchObject({
      chamber: "lower",
      committees: ["House Administration Committee"],
      id: "bill:us:119:hr:1234",
      summary: "Requires publication of structured legislative data.",
      status: "Referred to the House Administration Committee",
      title: "Legislative Data Access Act",
      upstreamIds: { govinfo: "BILLSTATUS-119hr1234" }
    })
    expect(aggregate.actions).toHaveLength(2)
    expect(aggregate.people).toEqual([
      {
        id: "person:congress:e000001",
        name: "Representative Example",
        upstreamIds: { bioguide: "E000001" }
      },
      {
        id: "person:congress:e000002",
        name: "Representative Second",
        upstreamIds: { bioguide: "E000002" }
      }
    ])
    expect(aggregate.sponsors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ classification: "primary", isPrimary: true }),
        expect.objectContaining({ classification: "cosponsor", isPrimary: false })
      ])
    )
    expect(aggregate.documents?.map(({ document }) => document)).toEqual([
      expect.objectContaining({ contentType: "application/xml", title: "Enrolled Bill", versionCode: "enr" }),
      expect.objectContaining({ contentType: "application/xml", title: "Introduced in House", versionCode: "ih" })
    ])
    expect(aggregate.relations).toEqual([
      { billId: "bill:us:119:hr:1234", classification: "related", relatedBillId: "bill:us:119:s:567" }
    ])
  })

  it("rejects status records without a title", () => {
    const withoutTitle = fixture.replace(/<titles>[\s\S]*<\/titles>/, "")
    expect(() => normalizeGovInfoBillStatus(withoutTitle, { sourceUrl: "https://example.test/status.xml" })).toThrow(
      "no title"
    )
  })

  it("normalizes a sparse Senate package from another Congress", () => {
    const aggregate = normalizeGovInfoBillStatus(sparseFixture, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/118/s/BILLSTATUS-118s77.xml"
    })

    expect(aggregate).toMatchObject({
      actions: [],
      bill: { id: "bill:us:118:s:77", summary: undefined },
      documents: [],
      relations: [],
      session: { id: "session:us:118" }
    })
  })
})
