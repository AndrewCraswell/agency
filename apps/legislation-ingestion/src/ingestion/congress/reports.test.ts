import { describe, expect, it } from "vitest"
import { normalizeCongressCommitteeReportBundle } from "./reports.js"

describe("Congress committee report normalization", () => {
  it("normalizes every official text representation and its explicit relationships", () => {
    const snapshot = normalizeCongressCommitteeReportBundle({
      reference: {
        citation: "H. Rept. 119-1",
        cmte_rpt_id: "289187",
        congress: 119,
        number: "1",
        part: "1",
        type: "HRPT",
        updateDate: "2025-05-27T14:12:39Z",
        url: "https://api.congress.gov/v3/committee-report/119/HRPT/1?format=json"
      },
      report: {
        associatedBill: [
          { congress: 119, number: "53", type: "HRES" },
          { congress: 119, number: "53", type: "HRES" }
        ],
        committees: [
          { name: "Rules Committee", systemCode: "hsru00" },
          { name: "Rules Committee", systemCode: "hsru00" }
        ],
        issueDate: "2025-01-21T05:00:00Z",
        title: "Providing for consideration of legislation"
      },
      text: [
        {
          formats: [
            {
              isErrata: "N",
              type: "Formatted Text",
              url: "https://www.congress.gov/119/crpt/hrpt1/generated/CRPT-119hrpt1.htm"
            }
          ]
        },
        {
          formats: [
            {
              isErrata: "N",
              type: "PDF",
              url: "https://www.congress.gov/119/crpt/hrpt1/CRPT-119hrpt1.pdf"
            }
          ]
        },
        {
          formats: [
            {
              isErrata: "N",
              type: "PDF",
              url: "https://www.congress.gov/119/crpt/hrpt1/CRPT-119hrpt1.pdf"
            }
          ]
        }
      ]
    })

    expect(snapshot.materials).toHaveLength(2)
    expect(snapshot.materials.map((item) => item.material.contentType)).toEqual(["text/html", "application/pdf"])
    expect(snapshot.materials[0]?.material).toMatchObject({
      classification: "committee-report",
      documentDate: "2025-01-21",
      jurisdictionId: "jurisdiction:us"
    })
    expect(snapshot.materials[0]?.links).toEqual([
      {
        billId: "bill:us:119:hres:53",
        classification: "reported-bill",
        materialId: snapshot.materials[0]?.material.id
      },
      {
        classification: "reporting-committee",
        materialId: snapshot.materials[0]?.material.id,
        organizationId: "organization:congress:hsru00"
      }
    ])
  })

  it("retains a report without published text or related entities", () => {
    const snapshot = normalizeCongressCommitteeReportBundle({
      reference: {
        citation: "S. Rept. 119-2",
        cmte_rpt_id: "2",
        congress: 119,
        number: "2",
        type: "SRPT",
        url: "https://api.congress.gov/v3/committee-report/119/SRPT/2"
      },
      report: {},
      text: []
    })

    expect(snapshot.materials).toHaveLength(1)
    expect(snapshot.materials[0]?.links).toEqual([])
    expect(snapshot.materials[0]?.material.sourceUrl).toContain("committee-report/119/SRPT/2")
  })
})
