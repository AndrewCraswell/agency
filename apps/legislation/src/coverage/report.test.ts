import { describe, expect, it } from "vitest"
import { compareCoverageReports, type CoverageReport } from "./report.js"

function report(bills: number, federalBills: number): CoverageReport {
  return {
    checkpoints: [],
    documentProcessing: [],
    documentTypes: [],
    documentQuality: { emptyText: 0, extractionFailures: 0, fallbackSegmentation: 0, lowText: 0, total: 0 },
    embeddingCoverage: { bills: { embedded: 0, total: bills }, sections: { embedded: 0, total: 0 } },
    federalBillTypes: [{ billType: "hr", bills: federalBills, congress: "119", documents: 0 }],
    eventCoverage: [],
    generatedAt: "2026-08-16T00:00:00.000Z",
    ingestionFailures: 0,
    scopes: [
      {
        actions: 0,
        availability: "available",
        bills,
        documents: 0,
        jurisdictionId: "jurisdiction:us",
        jurisdictionType: "country",
        processedDocuments: 0,
        sections: 0,
        sessionId: "session:us:119",
        sessionIdentifier: "119",
        sponsors: 0,
        votes: 0
      }
    ],
    supportingMaterialTypes: [],
    totals: { actions: 0, bills, documents: 0, processedDocuments: 0, sections: 0, sponsors: 0, votes: 0 },
    version: 1,
    voteCoverage: []
  }
}

describe("coverage comparison", () => {
  it("identifies scoped and federal regressions", () => {
    expect(compareCoverageReports(report(10, 10), report(8, 7))).toMatchObject({
      regressions: ["scope:session:us:119", "federal:119:hr"],
      totalChanges: { bills: -2 }
    })
  })
})
