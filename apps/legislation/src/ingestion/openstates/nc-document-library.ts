import { load } from "cheerio"

/** Publisher library inventory only. File titles are not evidence of a meeting relationship. */
export function parseNcDocumentLibrary(html: string, siteId: string) {
  if (!/^[1-9][0-9]*$/.test(siteId) || !html || Buffer.byteLength(html) > 4_000_000) {
    throw new Error("Invalid NC document library input")
  }
  const $ = load(html)
  if ($("#folders").length !== 1) {
    throw new Error("NC library folder content is missing or ambiguous")
  }
  const folders = new Map<string, { id: string; name: string }>()
  $("#folders button[onclick]").each((_, element) => {
    const match = $(element)
      .attr("onclick")
      ?.match(/^navigateToFolder\(([1-9][0-9]*),\s*([1-9][0-9]*),\s*'[^']*'\);$/)
    if (!match || match[1] !== siteId) {
      throw new Error("Unexpected NC library folder target")
    }
    const id = match[2]!
    const name = $(element).text().trim()
    if (!name || (folders.has(id) && folders.get(id)?.name !== name)) {
      throw new Error("Conflicting NC library folder identity")
    }
    folders.set(id, { id, name })
  })
  const files = new Map<string, { id: string; name: string; url: string }>()
  $("a.file").each((_, element) => {
    const url = $(element).attr("href") ?? ""
    const match = url.match(/^https:\/\/webservices\.ncleg\.gov\/ViewDocSiteFile\/([1-9][0-9]*)$/)
    const name = $(element).text().trim()
    if (!match || !name) {
      throw new Error("Unexpected NC library file target")
    }
    const id = match[1]!
    if (files.has(id) && files.get(id)?.name !== name) {
      throw new Error("Conflicting NC library file identity")
    }
    files.set(id, { id, name, url })
  })
  return {
    siteId,
    folders: [...folders.values()].sort((a, b) => a.id.localeCompare(b.id)),
    files: [...files.values()].sort((a, b) => a.id.localeCompare(b.id)),
    meetingRelationshipsEstablished: false as const
  }
}
