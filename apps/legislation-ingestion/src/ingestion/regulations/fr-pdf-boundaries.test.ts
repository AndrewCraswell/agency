import { describe, expect, it } from "vitest"
import { auditFrPdfBoundaries } from "./fr-pdf-boundaries.js"

describe("FR PDF publication boundary evidence", () => {
  it("flags neighboring publisher footers including historical dash and spacing variations", () => {
    expect(
      auditFrPdfBoundaries("[FR Doc. 99–34038 Filed 12–30–99] Body [FR DOC. 99-33595 Filed12-30-99]", "99-33595")
    ).toMatchObject({
      status: "shared_page_text",
      foreignDocumentNumbers: ["99-34038"],
      expectedFooterFound: true,
      publicationReady: false
    })
  })
  it("never treats a sole matching footer as proof of clean boundaries", () => {
    expect(
      auditFrPdfBoundaries("Unidentified adjacent text [FR Doc. 99-33595 Filed 12-30-99]", "99-33595")
    ).toMatchObject({ status: "boundaries_unverified", foreignDocumentNumbers: [], publicationReady: false })
  })
  it("does not confuse a citation or partial document number with the expected footer", () => {
    expect(auditFrPdfBoundaries("See FR Doc. 99-33595. [FR Doc. 99-335950 Filed 12-30-99]", "99-33595")).toMatchObject({
      status: "shared_page_text",
      expectedFooterFound: false
    })
    expect(auditFrPdfBoundaries("No footer", "99-33595").status).toBe("expected_footer_not_found")
  })
})
