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
        jurisdictionId: "jurisdiction:us",
        name: "Representative Example",
        sourceId: "E000001",
        upstreamIds: { bioguide: "E000001" }
      },
      {
        id: "person:congress:e000002",
        jurisdictionId: "jurisdiction:us",
        name: "Representative Second",
        sourceId: "E000002",
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
      expect.objectContaining({
        billId: "bill:us:119:hr:1234",
        classification: "related",
        direction: "outgoing",
        relatedBillId: "bill:us:119:s:567"
      })
    ])
  })

  it("persists source-declared relation direction and complete provenance when retrieved", () => {
    const aggregate = normalizeGovInfoBillStatus(fixture, {
      retrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.relations?.[0]).toMatchObject({
      canonicalFactsComplete: true,
      direction: "outgoing",
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "govinfo",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUpdatedAt: new Date("2025-02-10T12:00:00.000Z"),
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })
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

  it("normalizes legacy GovInfo bill field names", () => {
    const legacyFixture = fixture
      .replace("<number>1234</number>", "<billNumber>1234</billNumber>")
      .replace("<type>HR</type>", "<billType>HR</billType>")
      .replace("<number>567</number>", "<billNumber>567</billNumber>")
      .replace("<type>S</type>", "<billType>S</billType>")

    const aggregate = normalizeGovInfoBillStatus(legacyFixture, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/117/hr/BILLSTATUS-117hr1234.xml"
    })

    expect(aggregate.bill.id).toBe("bill:us:119:hr:1234")
    expect(aggregate.relations).toEqual([
      expect.objectContaining({
        relatedBillId: "bill:us:119:s:567"
      })
    ])
  })

  it("accepts structured relationship details and removes identical duplicate actions", () => {
    const currentShape = fixture
      .replace(
        "<relationshipDetails>Identical bill</relationshipDetails>",
        "<relationshipDetails><item><type>Related bill</type><identifiedBy>CRS</identifiedBy></item></relationshipDetails>"
      )
      .replace(
        "<item><actionDate>2025-02-03</actionDate><text>Introduced in House</text></item>",
        "<item><actionDate>2025-02-03</actionDate><text>Introduced in House</text></item><item><actionDate>2025-02-03</actionDate><text>Introduced in House</text></item>"
      )

    const aggregate = normalizeGovInfoBillStatus(currentShape, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.actions).toHaveLength(2)
    expect(aggregate.relations).toEqual([
      expect.objectContaining({
        billId: "bill:us:119:hr:1234",
        classification: "related",
        direction: "outgoing",
        relatedBillId: "bill:us:119:s:567"
      })
    ])
  })

  it("preserves every distinct official format for each legislative version", () => {
    const multipleFormats = fixture.replace(
      "<item><url>https://www.govinfo.gov/content/pkg/BILLS-119hr1234enr/xml/BILLS-119hr1234enr.xml</url></item>",
      "<item><url>https://www.govinfo.gov/content/pkg/BILLS-119hr1234enr/pdf/BILLS-119hr1234enr.pdf</url></item><item><url>https://www.govinfo.gov/content/pkg/BILLS-119hr1234enr/xml/BILLS-119hr1234enr.xml</url></item><item><url>https://www.govinfo.gov/content/pkg/BILLS-119hr1234enr/uslm/BILLS-119hr1234enr.xml</url></item>"
    )

    const aggregate = normalizeGovInfoBillStatus(multipleFormats, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.documents).toHaveLength(4)
    expect(aggregate.documents?.map(({ document }) => document.sourceUrl)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/pdf/"),
        expect.stringContaining("/xml/"),
        expect.stringContaining("/uslm/")
      ])
    )
  })

  it("preserves federal lifecycle classifications from BILLSTATUS actions", () => {
    const enacted = fixture.replace(
      "</actions>",
      [
        "<item><actionDate>2025-07-04</actionDate><type>President</type><text>Signed by President.</text></item>",
        "<item><actionDate>2025-07-04</actionDate><type>President</type><text>Became Public Law No: 119-21.</text></item>",
        "</actions>"
      ].join("")
    )

    const aggregate = normalizeGovInfoBillStatus(enacted, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.actions?.slice(-2)).toMatchObject([
      { classification: ["executive-signature"] },
      { classification: ["became-law"] }
    ])
  })

  it("ignores sparse empty formats and action records while retaining the bill", () => {
    const sparseCollections = fixture
      .replace(/<formats>[\s\S]*?<\/formats>/, "<formats></formats>")
      .replace(
        "<item><actionDate>2025-02-03</actionDate><text>Introduced in House</text></item>",
        "<item><actionDate>2025-02-03</actionDate></item>"
      )

    const aggregate = normalizeGovInfoBillStatus(sparseCollections, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.bill.id).toBe("bill:us:119:hr:1234")
    expect(aggregate.actions).toHaveLength(1)
    expect(aggregate.documents).toHaveLength(1)
  })

  it("normalizes an empty optional document date without rejecting the version", () => {
    const emptyDate = fixture.replace("<date>2025-02-10T05:00:00Z</date>", "<date></date>")

    const aggregate = normalizeGovInfoBillStatus(emptyDate, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.documents?.[0]?.document.documentDate).toBeUndefined()
  })

  it("ignores malformed optional collections, duplicate sponsors, and self-relations", () => {
    const repeatedSponsor = fixture.match(/<sponsors>([\s\S]*?)<\/sponsors>/)?.[1]
    expect(repeatedSponsor).toBeDefined()
    const inconsistent = fixture
      .replace("<cosponsors>", `<cosponsors>${repeatedSponsor ?? ""}`)
      .replace(
        "<relatedBills>",
        "<relatedBills><item><congress>119</congress><number>1234</number><type>HR</type></item>"
      )
      .replace(/<committees>[\s\S]*?<\/committees>/, "<committees>Unavailable</committees>")

    const aggregate = normalizeGovInfoBillStatus(inconsistent, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.bill.committees).toEqual([])
    expect(new Set((aggregate.people ?? []).map((person) => person.id)).size).toBe(aggregate.people?.length)
    expect((aggregate.relations ?? []).every((relation) => relation.relatedBillId !== aggregate.bill.id)).toBe(true)
  })

  it("filters malformed optional collection items and scalar policy areas", () => {
    const inconsistent = fixture
      .replace("<textVersions>", "<textVersions><item><type></type></item>")
      .replace(
        "<policyArea><name>Government Operations and Politics</name></policyArea>",
        "<policyArea>None</policyArea>"
      )

    const aggregate = normalizeGovInfoBillStatus(inconsistent, {
      sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr1234.xml"
    })

    expect(aggregate.bill.id).toBe("bill:us:119:hr:1234")
    expect(aggregate.bill.subjects).toEqual([])
    expect(aggregate.documents).toHaveLength(2)
  })
})
