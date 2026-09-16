import { z } from "zod"

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
