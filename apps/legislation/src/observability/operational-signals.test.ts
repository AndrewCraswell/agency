import { describe, expect, it } from "vitest"
import type { CoverageReport } from "../coverage/report.js"
import { operationalReadinessSignals } from "./operational-signals.js"

function report(): CoverageReport {
  return {
    checkpoints: [
      {
        cursor: { updateDate: "2026-08-16T00:00:00.000Z" },
        source: "congress",
        stream: "bills",
        updatedAt: "2026-08-16T12:00:00.000Z"
      }
    ],
    documentFailures: [],
    documentProcessing: [],
    documentQuality: {
      emptyText: 0,
      extractionFailures: 6,
      fallbackSegmentation: 0,
      lowText: 0,
      publisherPageFalseSuccesses: 0,
      total: 100
    },
    documentTypes: [],
    embeddingCoverage: {
      bills: { embedded: 8, oldestMissingAt: "2026-08-15T00:00:00.000Z", total: 10 },
      sections: { embedded: 19, oldestMissingAt: "2026-08-16T00:00:00.000Z", total: 20 }
    },
    eventCoverage: [],
    federalBillTypes: [],
    generatedAt: "2026-08-17T00:00:00.000Z",
    ingestionFailureCategories: [],
    ingestionFailures: 0,
    scopes: [],
    supportingMaterialTypes: [],
    totals: { actions: 0, bills: 10, documents: 0, processedDocuments: 0, sections: 20, sponsors: 0, votes: 0 },
    version: 1,
    voteCoverage: []
  }
}

describe("operational readiness signals", () => {
  it("derives checkpoint, document, and embedding alert inputs from one coverage snapshot", () => {
    expect(operationalReadinessSignals(report(), new Date("2026-08-17T00:00:00.000Z"))).toEqual({
      congressCheckpointAgeHours: 12,
      congressCheckpointObserved: true,
      documentFailureRate: 0.06,
      embeddingBacklog: 3,
      embeddingBacklogAgeHours: 48,
      generatedAt: "2026-08-17T00:00:00.000Z"
    })
  })

  it("does not invent an age for an unobserved checkpoint or an empty embedding backlog", () => {
    const input = report()
    input.checkpoints = []
    input.embeddingCoverage = {
      bills: { embedded: 10, total: 10 },
      sections: { embedded: 20, total: 20 }
    }

    expect(operationalReadinessSignals(input, new Date("2026-08-17T00:00:00.000Z"))).toMatchObject({
      congressCheckpointAgeHours: null,
      congressCheckpointObserved: false,
      embeddingBacklog: 0,
      embeddingBacklogAgeHours: null
    })
  })
})
