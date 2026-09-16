import { load } from "cheerio"
import { z } from "zod"
import { readBounded, type RetryingHttpClient } from "../http-client.js"
import type { CongressionalChamber } from "./committee-directory-parser.js"
import { extractGovInfoCommitteePdfText } from "./committee-pdf-text.js"

const pageSchema = z.object({
  nextPage: z.string().nullable(),
  granules: z.array(z.object({ granuleId: z.string(), granuleLink: z.string(), title: z.string() }))
})
const summarySchema = z.object({ download: z.object({ txtLink: z.string(), pdfLink: z.string().optional() }) })
const sectionPattern = /^(?:STANDING|SELECT AND SPECIAL) COMMITTEES OF THE (SENATE|HOUSE)$/

export type GovInfoCommitteeGranuleText = { chamber: CongressionalChamber; title: string; text: string }

/** Follow advertised text links only; old directories expose HTML-wrapped preformatted text. */
export async function getGovInfoCommitteeGranules(options: {
  apiKey: string
  http: RetryingHttpClient
  packageId: string
  includeAssignments?: boolean
  rendition?: "text" | "pdf"
}): Promise<GovInfoCommitteeGranuleText[]> {
  if (!/^CDIR-\d{4}-\d{2}-\d{2}$/.test(options.packageId)) {
    throw new Error("Invalid GovInfo directory package ID")
  }
  const base = `https://api.govinfo.gov/packages/${options.packageId}/granules`
  let next: string | null = `${base}?offsetMark=*&pageSize=1000`
  const seen = new Set<string>()
  const selected = new Map<string, z.infer<typeof pageSchema>["granules"][number]>()
  const get = async (url: string) => {
    const target = new URL(url)
    if (
      target.origin !== "https://api.govinfo.gov" ||
      !target.pathname.startsWith(`/packages/${options.packageId}/granules`)
    ) {
      throw new Error("GovInfo granule URL escaped its package")
    }
    return options.http.get(target, { headers: { "X-Api-Key": options.apiKey, accept: "application/json,text/html" } })
  }
  while (next !== null) {
    if (seen.has(next) || seen.size >= 20) {
      throw new Error("GovInfo granule pagination did not terminate")
    }
    seen.add(next)
    const page = pageSchema.parse(
      JSON.parse(new TextDecoder().decode(await readBounded(await get(next), 5 * 1024 * 1024)))
    )
    for (const granule of page.granules) {
      if (
        sectionPattern.test(granule.title) ||
        (options.includeAssignments &&
          /^ASSIGNMENTS OF (?:SENATORS|REPRESENTATIVES(?:, RESIDENT COMMISSIONER, AND DELEGATES)?) TO COMMITTEES$/.test(
            granule.title
          ))
      ) {
        selected.set(granule.granuleId, granule)
      }
    }
    next = page.nextPage
  }
  for (const chamber of ["SENATE", "HOUSE"]) {
    if (![...selected.values()].some((granule) => granule.title === `STANDING COMMITTEES OF THE ${chamber}`)) {
      throw new Error(`GovInfo ${options.packageId} has no advertised ${chamber} committee text`)
    }
  }
  const result: GovInfoCommitteeGranuleText[] = []
  for (const granule of selected.values()) {
    const summary = summarySchema.parse(
      JSON.parse(new TextDecoder().decode(await readBounded(await get(granule.granuleLink), 5 * 1024 * 1024)))
    )
    let text: string
    if (options.rendition === "pdf" && sectionPattern.test(granule.title)) {
      if (!summary.download.pdfLink) {
        throw new Error(`GovInfo granule ${granule.granuleId} has no advertised PDF`)
      }
      text = await extractGovInfoCommitteePdfText(
        await readBounded(await get(summary.download.pdfLink), 32 * 1024 * 1024)
      )
      const heading = new RegExp(granule.title.split(" ").join("\\s+"))
      if (!heading.test(text)) {
        throw new Error(`GovInfo PDF lacks ${granule.title}`)
      }
      text = text.replace(heading, granule.title)
    } else {
      const response = await get(summary.download.txtLink)
      const source = new TextDecoder().decode(await readBounded(response, 8 * 1024 * 1024))
      text = extractGovInfoPreformattedText(source, granule.title)
    }
    result.push({
      chamber: granule.title.endsWith("SENATE") || granule.title.includes("SENATORS") ? "upper" : "lower",
      title: granule.title,
      text
    })
  }
  return result
}

export function extractGovInfoPreformattedText(source: string, title: string): string {
  const document = load(source)
  const pre = document("pre")
  if (pre.length !== 1) {
    throw new Error("GovInfo advertised text has no unique preformatted rendition")
  }
  const text = pre.text().replaceAll("\r\n", "\n")
  const heading = new RegExp(title.split(" ").join("\\s+"))
  if (!heading.test(text)) {
    throw new Error(`GovInfo advertised text lacks its committee section heading: ${title}`)
  }
  return text.replace(heading, title)
}
