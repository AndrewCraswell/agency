import type { ScraperBillState } from "./scraper-bill-profiles.js"

export type ScraperVoteChamber = "legislature" | "lower" | "upper"

function chamberFromCode(value: string | null): ScraperVoteChamber | undefined {
  if (value === "H") return "lower"
  if (value === "S") return "upper"
  return undefined
}

/** Derive a roll call's chamber only from its admitted official publisher URL. */
export function scraperVoteChamberFromSourceUrl(
  state: ScraperBillState,
  session: string,
  sourceUrl: string | null
): ScraperVoteChamber | undefined {
  if (sourceUrl === null) return undefined
  // Washington's GetRollCalls URL covers both chambers; it is not chamber evidence.
  if (state === "wa") return undefined
  let url: URL
  try {
    url = new URL(sourceUrl)
  } catch {
    return undefined
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined
  if (state === "ak") {
    if (url.hostname !== "www.akleg.gov" || url.pathname !== `/basis/Journal/Pages/${session}`) return undefined
    return chamberFromCode(url.searchParams.get("Chamber"))
  }
  if (url.hostname !== "www.ncleg.gov") return undefined
  const match = /^\/Legislation\/Votes\/RollCallVoteTranscript\/([^/]+)\/([HS])\/[1-9][0-9]*$/.exec(url.pathname)
  if (match?.[1] !== session) return undefined
  return chamberFromCode(match[2] ?? null)
}

/** Classify Alaska journal tallies before falling back to the journal page chamber. */
export function scraperVoteChamberFromEvidence(input: {
  canonicalChamber?: string | null
  motion: string
  positionCount: number
  session: string
  sourceUrl: string | null
  state: ScraperBillState
}): ScraperVoteChamber | undefined {
  if (
    input.canonicalChamber === "lower" ||
    input.canonicalChamber === "upper" ||
    input.canonicalChamber === "legislature"
  ) {
    return input.canonicalChamber
  }
  if (input.state === "ak") {
    if (/\bHOUSE VOTE\b/i.test(input.motion)) return "lower"
    if (/\bSENATE VOTE\b/i.test(input.motion)) return "upper"
    if (input.positionCount > 40) return "legislature"
  }
  return scraperVoteChamberFromSourceUrl(input.state, input.session, input.sourceUrl)
}
