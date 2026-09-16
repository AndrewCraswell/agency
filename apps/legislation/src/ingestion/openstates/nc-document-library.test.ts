import { expect, it } from "vitest"
import { parseNcDocumentLibrary } from "./nc-document-library.js"

it("retains publisher file and folder identities without inferring meeting relations", () => {
  const html = `<div id="folders"><button onclick="navigateToFolder(512, 24091, '2026-2027');">2026-2027</button></div>
    <a class="file" href="https://webservices.ncleg.gov/ViewDocSiteFile/120383">Agenda.pdf</a>`
  const result = parseNcDocumentLibrary(html, "512")
  expect(result.folders).toEqual([{ id: "24091", name: "2026-2027" }])
  expect(result.files[0]?.id).toBe("120383")
  expect(result.meetingRelationshipsEstablished).toBe(false)
  expect(() => parseNcDocumentLibrary(html.replace("navigateToFolder(512", "navigateToFolder(513"), "512")).toThrow(
    /target/
  )
  expect(() =>
    parseNcDocumentLibrary(html.replace("https://webservices.ncleg.gov", "https://example.org"), "512")
  ).toThrow(/target/)
  expect(() => parseNcDocumentLibrary("<h1>Sign in</h1>", "512")).toThrow(/missing/)
})
