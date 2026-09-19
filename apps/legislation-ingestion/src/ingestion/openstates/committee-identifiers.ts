import { z } from "zod"

/** Publisher chamber/code, never a committee-name inference. */
export function washingtonCommitteeIdentifiers(input: unknown, chamber: string | null): Record<string, string> {
  const links = z.array(z.object({ url: z.string() }).passthrough()).safeParse(input)
  if (!links.success) return {}
  const result: Record<string, string> = {}
  for (const { url } of links.data) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    const match =
      /^\/about-the-legislature\/committees\/(house-of-representatives|house|senate)\/([a-z0-9]+)\/?$/.exec(
        parsed.pathname
      ) ?? /^\/(House|Senate)\/Committees\/([A-Z0-9]+)\/?$/.exec(parsed.pathname)
    const sourceChamber = match?.[1]?.toLowerCase().startsWith("house") ? "house" : "senate"
    if (
      parsed.origin !== "https://leg.wa.gov" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !match ||
      (sourceChamber === "house" ? chamber !== "lower" : chamber !== "upper")
    )
      continue
    result[`waCommittee:${sourceChamber}:${match[2]!.toUpperCase()}`] = url
  }
  return result
}

/** Exact publisher URLs bind a source organization to a session/code, not a name match. */
export function alaskaCommitteeIdentifiers(input: unknown, chamber: string | null): Record<string, string> {
  const links = z.array(z.object({ url: z.string() }).passthrough()).safeParse(input)
  if (!links.success) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const { url } of links.data) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    const session = /^\/basis\/Committee\/Details\/([1-9][0-9]*)$/.exec(parsed.pathname)?.[1]
    const code = parsed.searchParams.get("code")
    if (
      parsed.origin !== "https://www.akleg.gov" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      !session ||
      !code ||
      !/^[HSJ][A-Z0-9&]+$/.test(code) ||
      parsed.searchParams.size !== 1 ||
      (chamber === "upper" && !code.startsWith("S")) ||
      (chamber === "lower" && !code.startsWith("H")) ||
      !["upper", "lower", "legislature"].includes(chamber ?? "")
    ) {
      continue
    }
    result[`akCommittee:${session}:${code}`] = url
  }
  return result
}

/** NC committee type and numeric ID are explicit in the publisher URL; names are never identity evidence. */
export function northCarolinaCommitteeIdentifiers(input: unknown): Record<string, string> {
  const links = z.array(z.object({ url: z.string() }).passthrough()).safeParse(input)
  if (!links.success) {
    return {}
  }
  const result: Record<string, string> = {}
  for (const { url } of links.data) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    const match =
      /^\/Committees\/CommitteeInfo\/(HouseSelect|HouseStanding|NonStanding|Senate%20Standing|SenateSelect|SenateStanding)\/([1-9][0-9]*)$/.exec(
        parsed.pathname
      )
    if (
      parsed.origin !== "https://www.ncleg.gov" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !match
    ) {
      continue
    }
    result[`ncCommittee:${match[1]}:${match[2]}`] = url
  }
  return result
}
