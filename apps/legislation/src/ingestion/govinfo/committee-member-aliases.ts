import { z } from "zod"
import { readBounded, type RetryingHttpClient } from "../http-client.js"
import type { CongressionalChamber } from "./committee-directory-parser.js"

const pageSchema = z.object({
  nextPage: z.string().nullable(),
  granules: z.array(z.object({ granuleId: z.string(), granuleLink: z.string() }))
})
const nameFieldSchema = z.union([z.string(), z.array(z.string())]).optional()
const summarySchema = z.object({
  packageId: z.string(),
  granuleId: z.string(),
  members: z
    .array(
      z.object({
        congress: z.string(),
        chamber: z.enum(["H", "S"]),
        state: z.string(),
        bioGuideId: z
          .string()
          .regex(/^[A-Za-z]\d{6}$/)
          .optional(),
        name: z.array(
          z.object({
            parsed: nameFieldSchema,
            "authority-fnf": nameFieldSchema,
            "authority-lnf": nameFieldSchema,
            "authority-other": nameFieldSchema
          })
        )
      })
    )
    .min(1)
})

/** Resolve printed names through explicit IDs in the same directory, never approximate name similarity. */
export async function getGovInfoCommitteeMemberAliases(options: {
  apiKey: string
  http: RetryingHttpClient
  packageId: string
  congress: number
  candidates: readonly { state: string; chamber: CongressionalChamber }[]
}): Promise<{ name: string; personId: string; state: string; chamber: CongressionalChamber }[]> {
  if (
    !/^CDIR-\d{4}-\d{2}-\d{2}$/.test(options.packageId) ||
    !Number.isSafeInteger(options.congress) ||
    options.congress < 1
  ) {
    throw new Error("Invalid GovInfo committee alias package or Congress")
  }
  const requested = new Set<string>()
  for (const candidate of options.candidates) {
    if (!/^[A-Z]{2}$/.test(candidate.state)) {
      throw new Error("Invalid GovInfo committee alias state")
    }
    requested.add(`${candidate.state}-${candidate.chamber === "upper" ? "S" : "H"}`)
  }
  if (requested.size === 0) {
    return []
  }
  const basePath = `/packages/${options.packageId}/granules`
  const base = `https://api.govinfo.gov${basePath}`
  const getJson = async (value: string, path: string): Promise<unknown> => {
    const url = new URL(value)
    if (
      url.origin !== "https://api.govinfo.gov" ||
      url.pathname !== path ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== ""
    ) {
      throw new Error("GovInfo member alias URL escaped its package")
    }
    const response = await options.http.get(url, {
      redirect: "error",
      headers: { "X-Api-Key": options.apiKey, accept: "application/json" }
    })
    return JSON.parse(new TextDecoder().decode(await readBounded(response, 5 * 1024 * 1024)))
  }
  let next: string | null = `${base}?offsetMark=*&pageSize=1000`
  const pages = new Set<string>()
  const selected = new Map<string, { url: string; state: string; chamber: "S" | "H" }>()
  while (next !== null) {
    if (pages.has(next) || pages.size >= 20) {
      throw new Error("GovInfo member alias pagination did not terminate within 20 pages")
    }
    pages.add(next)
    const page = pageSchema.parse(await getJson(next, basePath))
    for (const granule of page.granules) {
      // The October 2018 package advertises October 29 granule IDs. The
      // advertised URL and returned package ID, not the date prefix, bind scope.
      const match = /^CDIR-\d{4}-\d{2}-\d{2}-([A-Z]{2})-(S|H)-\d+$/.exec(granule.granuleId)
      if (match === null) {
        continue
      }
      const state = match[1]!
      const chamber = match[2] === "S" ? "S" : "H"
      if (requested.has(`${state}-${chamber}`)) {
        selected.set(granule.granuleId, { url: granule.granuleLink, state, chamber })
        if (selected.size > 600) {
          throw new Error("GovInfo member alias request exceeds 600 individual summaries")
        }
      }
    }
    next = page.nextPage
  }
  const aliases = new Map<string, { name: string; personId: string; state: string; chamber: CongressionalChamber }>()
  for (const [granuleId, granule] of selected) {
    const summary = summarySchema.parse(await getJson(granule.url, `${basePath}/${granuleId}/summary`))
    if (summary.packageId !== options.packageId || summary.granuleId !== granuleId) {
      throw new Error("GovInfo member alias summary identity differs from its advertised granule")
    }
    for (const member of summary.members) {
      if (
        member.congress !== String(options.congress) ||
        member.chamber !== granule.chamber ||
        member.state !== granule.state
      ) {
        throw new Error("GovInfo member alias Congress, chamber, or state differs from its requested scope")
      }
      if (member.bioGuideId === undefined) {
        continue
      }
      const personId = `person:congress:${member.bioGuideId.toLowerCase()}`
      for (const names of member.name) {
        for (const name of Object.values(names).flatMap((value) => (Array.isArray(value) ? value : [value]))) {
          if (name !== undefined && name.trim() !== "") {
            const chamber = member.chamber === "S" ? "upper" : "lower"
            aliases.set(JSON.stringify([personId, name, member.state, chamber]), {
              name,
              personId,
              state: member.state,
              chamber
            })
          }
        }
      }
    }
  }
  return [...aliases.values()]
}
