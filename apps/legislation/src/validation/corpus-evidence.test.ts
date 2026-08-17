import { describe, expect, it } from "vitest"
import {
  createCorpusEvidenceAudit,
  parseCorpusEvidenceBundle,
  type CorpusEvidenceBundle,
  type EvidenceArtifactVerification
} from "./corpus-evidence.js"

const stateStrata = ["dense", "large", "older", "recent", "small", "sparse"] as const
const stateFields = ["actions", "documents", "identifier", "sponsors", "title", "votes"] as const
const artifactCategories = [
  "command-parameters",
  "congress-sync-checkpoint",
  "corpus-validation",
  "coverage-report",
  "failure-report",
  "govinfo-discovery-manifest",
  "openstates-discovery-manifest",
  "run-records",
  "sample-records",
  "content-hashes",
  "document-exceptions",
  "document-inventory",
  "embedding-model",
  "embedding-report",
  "extraction-sampled-review",
  "idempotency-report",
  "processing-report"
] as const

function hash(character: string): string {
  return character.repeat(64)
}

function runId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`
}

function processingCohort(source: "govinfo" | "openstates", format: "html" | "pdf" | "text" | "xml") {
  return {
    acquiredSupportedDocuments: 1,
    acquisitionFailures: 0,
    attemptedDocuments: 1,
    availableDocuments: 1,
    categorizedFailures: 0,
    embeddedSections: 99,
    emptyTextDocuments: 0,
    extractedSections: 100,
    extractionFailures: 0,
    fallbackSegmentedDocuments: 0,
    format,
    lowTextDocuments: 0,
    searchableDocuments: 1,
    source,
    supported: true
  }
}

function evidenceBundle(): CorpusEvidenceBundle {
  return parseCorpusEvidenceBundle({
    bundleId: "development-corpus-2026-08-17",
    convergenceSamples: [1, 2].map((index) => ({
      canonicalId: `bill:us:119:hr:${index}`,
      checkedAt: "2026-08-17T05:00:00.000Z",
      congressCanonicalId: `bill:us:119:hr:${index}`,
      congressSourceUrl: `https://api.congress.gov/v3/bill/119/hr/${index}`,
      govinfoCanonicalId: `bill:us:119:hr:${index}`,
      versions: [
        {
          congressCanonicalId: `document:us:119:hr:${index}:ih`,
          govinfoCanonicalId: `document:us:119:hr:${index}:ih`,
          versionCode: "ih"
        }
      ]
    })),
    documentInventory: [
      { documentId: "document:state:html", format: "html", source: "openstates" },
      { documentId: "document:state:text", format: "text", source: "openstates" },
      { documentId: "document:us:pdf", format: "pdf", source: "govinfo" },
      { documentId: "document:us:xml", format: "xml", source: "govinfo" }
    ].map((document) => ({
      ...document,
      acquisitionState: "pending",
      capturedAt: "2026-08-17T01:00:00.000Z",
      embeddedSectionCount: 0,
      embeddingState: "missing",
      extractionState: "pending",
      sectionCount: 0,
      versionStatus: "current"
    })),
    documentInventoryExpectedCount: 4,
    embedding: { dimensions: 1536, modelIdentifier: "openai/text-embedding-3-small" },
    environment: "development",
    evidenceArtifacts: artifactCategories.map((category, index) => ({
      category,
      generatedAt: "2026-08-17T06:00:00.000Z",
      path: `artifacts/${category}.json`,
      runIds: [runId(index + 20)],
      sha256: hash((index % 10).toString())
    })),
    extractionSamples: [
      { documentId: "document:state:html", format: "html" },
      { documentId: "document:state:text", format: "text" },
      { documentId: "document:us:pdf", format: "pdf" },
      { documentId: "document:us:xml", format: "xml" }
    ].map((sample, index) => ({
      ...sample,
      extractedContentHash: hash("a"),
      officialContentHash: hash("b"),
      officialUrl: `https://example.gov/documents/${index}`,
      reviewEvidence: "The extracted text and section boundaries agree with the official artifact.",
      reviewedAt: "2026-08-17T04:00:00.000Z",
      reviewer: "reviewer@example.test",
      sectionBoundaryOutcome: "match",
      textOutcome: "match"
    })),
    federalSamples: [
      { billType: "hr", canonicalId: "bill:us:118:hr:1", congress: "118" },
      { billType: "s", canonicalId: "bill:us:118:s:2", congress: "118" },
      { billType: "hr", canonicalId: "bill:us:119:hr:3", congress: "119" },
      { billType: "s", canonicalId: "bill:us:119:s:4", congress: "119" }
    ].map((sample, index) => ({
      ...sample,
      checks: [
        { evidence: "Compared normalized metadata with GovInfo BILLSTATUS XML.", kind: "metadata", outcome: "match" },
        {
          evidence: "Compared extracted content with the official version text.",
          kind: "official-text",
          outcome: "match"
        }
      ],
      govinfoMetadataHash: hash("c"),
      officialTextHash: hash("d"),
      officialTextUrl: `https://www.govinfo.gov/content/pkg/sample-${index}/html/sample-${index}.htm`,
      reviewedAt: "2026-08-17T04:00:00.000Z",
      reviewer: "reviewer@example.test"
    })),
    generatedAt: "2026-08-17T06:00:00.000Z",
    idempotencyRuns: [
      {
        afterContentSetHash: hash("e"),
        baselineRunId: runId(1),
        beforeContentSetHash: hash("e"),
        canonicalMutations: 0,
        downloads: 0,
        embeddingsRequested: 0,
        extractions: 0,
        runId: runId(2),
        sectionsWritten: 0,
        unchangedDocuments: 4
      }
    ],
    investigations: [],
    processingCohorts: [
      processingCohort("openstates", "html"),
      processingCohort("openstates", "text"),
      processingCohort("govinfo", "pdf"),
      processingCohort("govinfo", "xml")
    ],
    processingStartedAt: "2026-08-17T02:00:00.000Z",
    stateSamples: stateStrata.map((stratum, index) => ({
      canonicalId: `bill:state:${index}`,
      checks: stateFields.map((field) => ({
        evidence: `Compared ${field} with the original Open States record.`,
        field,
        outcome: "match"
      })),
      jurisdictionId: `jurisdiction:state:${index}`,
      reviewedAt: "2026-08-17T04:00:00.000Z",
      reviewer: "reviewer@example.test",
      sessionIdentifier: index < 3 ? "2018" : "2026",
      sourceArtifact: `samples/openstates-${index}.json`,
      sourceUrl: `https://openstates.org/sample/${index}`,
      strata: [stratum]
    })),
    upstreamArtifacts: [
      {
        artifactId: "ca-2025",
        databaseRecordCount: 100,
        discoveredAt: "2026-08-17T00:00:00.000Z",
        material: true,
        policyStatus: "in-policy",
        source: "openstates",
        sourceRecordCount: 100
      },
      {
        artifactId: "BILLSTATUS-119-hr",
        databaseRecordCount: 99,
        discoveredAt: "2026-08-17T00:00:00.000Z",
        gap: {
          action: "Retain the provider exception and retry the missing package on the next bounded replay.",
          category: "upstream-partial",
          explanation: "GovInfo listed one package without a downloadable artifact during the recorded discovery run."
        },
        material: true,
        policyStatus: "in-policy",
        source: "govinfo",
        sourceRecordCount: 100
      },
      {
        artifactId: "congress-119-checkpoint",
        databaseRecordCount: 50,
        discoveredAt: "2026-08-17T00:00:00.000Z",
        material: true,
        policyStatus: "in-policy",
        source: "congress",
        sourceRecordCount: 50
      }
    ],
    upstreamArtifactExpectedCount: 3,
    version: 1
  })
}

function verifiedArtifacts(bundle: CorpusEvidenceBundle): EvidenceArtifactVerification[] {
  return bundle.evidenceArtifacts.map((artifact) => ({
    actualSha256: artifact.sha256,
    category: artifact.category,
    path: artifact.path,
    status: "verified"
  }))
}

describe("corpus evidence audit", () => {
  it("accepts a complete deterministic D2 and D3 evidence bundle", () => {
    const bundle = evidenceBundle()
    const audit = createCorpusEvidenceAudit(bundle, verifiedArtifacts(bundle))

    expect(audit.ready).toBe(true)
    expect(audit.tasks).toHaveLength(12)
    expect(audit.tasks.every((task) => task.passed)).toBe(true)
    expect(audit.metrics.rates).toEqual({
      attemptedAvailableDocuments: 1,
      categorizedFailures: 1,
      embeddedSections: 0.99,
      searchableDocuments: 1
    })
    expect(createCorpusEvidenceAudit(bundle, verifiedArtifacts(bundle))).toEqual(audit)
  })

  it("reports incomplete sampling, processing, investigation, and artifact proof by task", () => {
    const bundle = evidenceBundle()
    bundle.stateSamples = bundle.stateSamples.filter((sample) => !sample.strata.includes("sparse"))
    const firstCohort = bundle.processingCohorts[0]
    if (firstCohort === undefined) {
      throw new Error("fixture must contain a processing cohort")
    }
    firstCohort.attemptedDocuments = 0
    const verification = verifiedArtifacts(bundle).map((artifact) =>
      artifact.category === "content-hashes" ? { ...artifact, status: "mismatch" as const } : artifact
    )

    const audit = createCorpusEvidenceAudit(bundle, verification)
    const results = new Map(audit.tasks.map((task) => [task.id, task]))

    expect(results.get("D2.6")).toMatchObject({ passed: false, reasons: [expect.stringContaining("sparse")] })
    expect(results.get("D3.8")).toMatchObject({ passed: false })
    expect(results.get("D3.9")).toMatchObject({
      passed: false,
      reasons: [expect.stringContaining("openstates:html")]
    })
    expect(results.get("D3.10")).toMatchObject({
      passed: false,
      reasons: [expect.stringContaining("content-hashes")]
    })
  })

  it("rejects artifact paths that can escape the evidence bundle", () => {
    const bundle = evidenceBundle()
    const firstArtifact = bundle.evidenceArtifacts[0]
    if (firstArtifact === undefined) {
      throw new Error("fixture must contain an evidence artifact")
    }

    expect(() =>
      parseCorpusEvidenceBundle({ ...bundle, evidenceArtifacts: [{ ...firstArtifact, path: "../secret" }] })
    ).toThrow("parent-directory")
  })
})
