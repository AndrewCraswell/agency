import { createLogger } from "@repo/legislation-core/observability/logger"
import { describe, expect, it } from "vitest"
import { createResearchEvidenceProjector } from "./evidenceSource.server"

const document = {
  id: "document:xml",
  billId: "bill:us:119:hr:1",
  classification: "version",
  versionCode: "ih",
  documentDate: "2025-01-03",
  title: "Introduced text",
  contentType: "application/xml",
  sourceUrl: "https://www.govinfo.gov/content/pkg/BILLS-119hr1ih/xml/BILLS-119hr1ih.xml"
}
const pdf = {
  ...document,
  id: "document:pdf",
  contentType: "application/pdf",
  sourceUrl: "https://www.govinfo.gov/content/pkg/BILLS-119hr1ih/pdf/BILLS-119hr1ih.pdf"
}
const html = {
  ...document,
  id: "document:html",
  contentType: "text/html",
  sourceUrl: "https://www.congress.gov/119/bills/hr1/BILLS-119hr1ih.htm"
}

function setup(runId = "run:one") {
  const lines: string[] = []
  const logger = createLogger({ service: "evidence-test", level: "warn", write: (line) => lines.push(line) })
  return { lines, logger, project: createResearchEvidenceProjector(logger, runId) }
}

describe("readable evidence sources", () => {
  it("recognizes publisher XHTML record pages without logging a fallback", () => {
    const { project, lines } = setup()
    const sourceUrl = "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2652"
    expect(project({ id: "bill:ca:20232024:ab:2652", title: "Education", sourceUrl })[0]?.readableUrl).toBe(sourceUrl)
    expect(lines).toEqual([])
  })

  it("selects existing same-version publisher HTML before PDF while preserving identity and provenance", () => {
    const { project, lines } = setup()
    const evidence = project({ documents: [document, pdf, html] })
    expect(evidence[0]?.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/)
    expect(evidence[0]).toMatchObject({ sourceUrl: document.sourceUrl, readableUrl: html.sourceUrl })
    const withoutRenditions = setup().project(document)
    expect(evidence[0]?.id).toBe(withoutRenditions[0]?.id)
    expect(lines).toEqual([])
    expect(project({ ...document, text: "Exact text" })[0]?.readableUrl).toBe(html.sourceUrl)
  })

  it("uses a retained PDF and explicit trusted document rendition metadata", () => {
    expect(setup().project({ documents: [document, pdf] })[0]?.readableUrl).toBe(pdf.sourceUrl)
    const { project } = setup()
    const readableUrl = "https://publisher.example/read/version/ih"
    expect(project({ ...document, readableUrl })[0]?.readableUrl).toBe(readableUrl)
    expect(project(document)[0]?.readableUrl).toBe(readableUrl)
    expect(
      setup().project({
        ...document,
        renditions: [{ documentId: document.id, sourceUrl: pdf.sourceUrl, contentType: "application/pdf" }]
      })[0]?.readableUrl
    ).toBe(pdf.sourceUrl)
    expect(setup().project({ ...document, renditions: [{ url: pdf.sourceUrl, format: "pdf" }] })[0]?.readableUrl).toBe(
      pdf.sourceUrl
    )
  })

  it.each([
    { ...pdf, versionCode: "eh" },
    { ...pdf, documentDate: "2025-02-03" },
    { ...pdf, billId: "bill:us:119:hr:2" },
    { ...pdf, classification: "analysis" },
    { ...pdf, sourceUrl: "https://unrelated.example/text.pdf" },
    { ...pdf, sourceUrl: "https://www.govinfo.gov/text.pdf?signature=secret" }
  ])("does not substitute a different version, owner, publisher, or unsafe rendition", (candidate) => {
    expect(setup().project({ documents: [document, candidate] })[0]?.readableUrl).toBeUndefined()
  })

  it("rejects mismatched nested versions and does not rewrite XML or relabel raw data", () => {
    const { project } = setup()
    expect(project({ ...document, renditions: [{ ...pdf, versionCode: "eh" }] })[0]?.readableUrl).toBeUndefined()
    expect(project({ ...document, contentType: "application/pdf" })[0]?.readableUrl).toBeUndefined()
    expect(project({ ...document, readableUrl: document.sourceUrl })[0]?.readableUrl).toBeUndefined()
    expect(
      project({ ...document, readableUrl: "https://user:secret@www.govinfo.gov/text.pdf" })[0]?.readableUrl
    ).toBeUndefined()
    expect(project(document)[0]?.sourceUrl).toBe(document.sourceUrl)
  })

  it("does not reuse a readable source across conflicting observations or document versions", () => {
    const { project } = setup()
    const first = { ...document, sourceObservationId: "observation:one", readableUrl: html.sourceUrl }
    expect(project(first)[0]?.readableUrl).toBe(html.sourceUrl)
    expect(project({ ...document, sourceObservationId: "observation:two" })[0]?.readableUrl).toBeUndefined()
    expect(project({ ...document, versionCode: "eh" })[0]?.readableUrl).toBeUndefined()
  })

  it.each(["versionCode", "documentDate"] as const)(
    "requires matching nullable %s on independent retained candidates",
    (field) => {
      for (const missing of [null, undefined]) {
        const source = { ...document, versionId: "version:one" }
        const candidate = { ...html, id: source.id, versionId: source.versionId, [field]: missing }
        const { project } = setup()
        project(candidate)
        expect(project(source)[0]?.readableUrl).toBeUndefined()
        expect(setup().project({ documents: [source, candidate] })[0]?.readableUrl).toBeUndefined()

        const reversed = setup()
        reversed.project({ ...html, id: source.id, versionId: source.versionId })
        expect(reversed.project({ ...source, [field]: missing })[0]?.readableUrl).toBeUndefined()
      }
    }
  )

  it("accepts equal nullish version metadata but lets only nested renditions inherit known parent values", () => {
    const source = { ...document, versionCode: null, documentDate: null }
    const candidate = { ...pdf, id: source.id, versionCode: undefined, documentDate: undefined }
    expect(setup().project({ documents: [source, candidate] })[0]?.readableUrl).toBe(pdf.sourceUrl)
    expect(setup().project({ ...document, renditions: [{ url: pdf.sourceUrl, format: "pdf" }] })[0]?.readableUrl).toBe(
      pdf.sourceUrl
    )
    for (const field of ["versionCode", "documentDate"] as const) {
      expect(
        setup().project({
          ...document,
          renditions: [{ url: pdf.sourceUrl, format: "pdf", [field]: null }]
        })[0]?.readableUrl
      ).toBeUndefined()
    }
  })

  it.each([
    { billId: "bill:us:119:hr:2" },
    { billId: null },
    { versionId: "version:two" },
    { versionId: null },
    { sourceObservationId: "observation:two" },
    { sourceObservationId: null },
    { versionHash: "hash:two" },
    { versionHash: null }
  ])("does not let matching document or version IDs bypass conflicting identity: %j", (change) => {
    const source = {
      ...document,
      versionId: "version:one",
      sourceObservationId: "observation:one",
      versionHash: "hash:one"
    }
    const { project } = setup()
    project({ ...source, ...change, readableUrl: html.sourceUrl })
    expect(project(source)[0]?.readableUrl).toBeUndefined()
    expect(
      setup().project({ ...source, renditions: [{ url: pdf.sourceUrl, format: "pdf", ...change }] })[0]?.readableUrl
    ).toBeUndefined()
  })

  it("resolves section renditions only through their owning document and retains exact passage identity", () => {
    const section = {
      id: "section:one",
      documentId: document.id,
      sectionIdentifier: "2",
      text: "Exact retained passage"
    }
    const { project } = setup()
    const enriched = project({
      document: { ...document, renditions: [{ url: html.sourceUrl, format: "html" }] },
      sections: [section]
    })
    expect(enriched[1]).toMatchObject({
      sourceUrl: document.sourceUrl,
      readableUrl: html.sourceUrl,
      content: { state: "available", quote: section.text }
    })
    expect(enriched[1]?.id).toBe(setup().project({ document, sections: [section] })[1]?.id)
    expect(project({ document, sections: [{ ...section, versionCode: "eh" }] })[1]?.readableUrl).toBeUndefined()
  })

  it("deduplicates fallback diagnostics per evidence per run and keeps sensitive material out", () => {
    const { project, lines, logger } = setup()
    const input = { ...document, text: "PRIVATE PASSAGE", sourceUrl: `${document.sourceUrl}?query=PRIVATE_QUERY` }
    const first = project(input)
    expect(project(input)[0]?.id).toBe(first[0]?.id)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('"event":"evidence_readable_source_fallback"')
    expect(lines[0]).toContain('"runId":"run:one"')
    expect(lines[0]).toContain('"sourceHost":"www.govinfo.gov"')
    expect(lines[0]).toContain('"sourceFormat":"xml"')
    expect(lines[0]).not.toMatch(/PRIVATE|https:|\?query=|BILLS-119/)
    project({ ...input, text: "Changed passage" })
    expect(lines).toHaveLength(2)
    createResearchEvidenceProjector(logger, "run:two")(input)
    expect(lines).toHaveLength(3)
    expect(lines[2]).toContain('"runId":"run:two"')
  })

  it("logs no-safe-source once without credentials, queries, or unsafe document identifiers", () => {
    const { project, lines } = setup()
    const input = {
      ...document,
      id: "PRIVATE_ID",
      sourceUrl: "https://user:PRIVATE_PASSWORD@example.org/doc.xml?token=PRIVATE_TOKEN"
    }
    expect(project(input)[0]?.sourceUrl).toBeNull()
    project(input)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('"reason":"no_safe_source"')
    expect(lines[0]).not.toContain("PRIVATE")
  })
})
