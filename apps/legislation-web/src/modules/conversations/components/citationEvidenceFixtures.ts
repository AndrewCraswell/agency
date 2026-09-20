import { projectResearchEvidence, type EvidenceSnapshot } from "../evidence"

export const billVersionCitationFixtures = [
  { congress: "119", number: "1", title: "Synthetic Data Access Act", version: "Introduced in Senate", code: "is" },
  { congress: "119", number: "2", title: "Synthetic Public Records Act", version: "Introduced in Senate", code: "is" },
  { congress: "118", number: "1", title: "Synthetic Data Access Act", version: "Introduced in Senate", code: "is" },
  { congress: "119", number: "1", title: "Synthetic Data Access Act", version: "Enrolled Bill", code: "enr" }
].flatMap(({ congress, number, title, version, code }, index) => {
  const billId = `bill:us:${congress}:s:${number}`
  const documentId = `document:${billId}:${code}`
  let ordinal = 0
  return projectResearchEvidence(
    {
      bill: { id: billId, identifier: `S ${number}`, title, sessionId: `session:us:${congress}` },
      document: {
        id: documentId,
        billId,
        classification: "version",
        title: version,
        versionCode: code,
        documentDate: "2025-01-03",
        sourceUrl: `https://publisher.example/fixture/${index}.pdf`
      },
      section: {
        id: `section:${documentId}:2`,
        documentId,
        sectionIdentifier: "Section 2",
        text: "Synthetic retained bill passage. This fixture tests citation identity, not a legislative claim."
      }
    },
    () => `bill-version-fixture-${index}-${ordinal++}`
  )
    .filter((source) => source.content.state === "available")
    .map((source) => ({ ...source, citationRef: `e${index + 1}` }))
})

// Synthetic source records preserve the reported syntax, not historical research claims.
export const malformedCitationFixtures = [
  { caseId: "071", marker: "[7](#citation-e549]", reference: "e549" },
  { caseId: "091", marker: "[4](#citation-e139]", reference: "e139" },
  { caseId: "001", marker: "[2](#citation-e74]", reference: "e74" },
  { caseId: "047", marker: "[5](#citation-e208]", reference: "e208" }
].map(({ caseId, marker, reference }) => ({
  answerId: `syntax-fixture-${caseId}`,
  marker,
  evidence: {
    id: `syntax-source-${caseId}`,
    citationRef: reference,
    title: `Citation syntax fixture ${caseId}`,
    origin: "web",
    publisher: "Synthetic regression fixture",
    sourceUrl: `https://publisher.example/fixture/${caseId}`,
    content: { state: "available", quote: `Synthetic retained passage for case ${caseId}.` }
  } satisfies EvidenceSnapshot
}))

const context = [
  "This is synthetic regression text, not a published finding. It tests access to retained supporting context.",
  "The preview must retain headings, links, table cells and paragraph boundaries without executing source HTML.",
  "A short initial view must not remove later qualifications or silently substitute text that was never collected.",
  "The saved passage remains scrollable by keyboard and can be expanded without making a new research request."
].join("\n\n")

export const markdownEvidenceFixture: EvidenceSnapshot = {
  id: "markdown-passage-fixture",
  citationRef: "e1",
  title: "Fiscal table formatting fixture",
  origin: "web",
  publisher: "Synthetic regression fixture",
  locator: "Retained table and qualification",
  sourceUrl: "https://publisher.example/fixture/table",
  content: {
    state: "available",
    quote: [
      "## Budget estimate",
      "",
      context,
      "",
      "| Measure | Estimate |",
      "| --- | --- |",
      "| Gross component | $25 million |",
      "| Offset<br>included in net | $8 million |",
      "| Net estimate | $17 million |",
      "",
      "See the [source methodology](https://publisher.example/fixture/methodology).",
      "",
      "**Qualification:** These illustrative components must not be described as separate net savings."
    ].join("\n"),
    truncated: true,
    totalCharacters: 20001
  }
}

export const qualifiedEvidenceFixture: EvidenceSnapshot = {
  ...markdownEvidenceFixture,
  id: "qualified-passage-fixture",
  title: "Study qualification formatting fixture",
  sourceUrl: "https://publisher.example/fixture/qualification",
  content: {
    state: "available",
    quote: [
      "## Significance",
      "",
      context,
      "",
      "The illustrative claim concerns carefully designed safeguards.",
      "",
      "**Qualification:** This selected-school study does not establish results for all US districts."
    ].join("\n"),
    truncated: true,
    totalCharacters: 20001
  }
}
