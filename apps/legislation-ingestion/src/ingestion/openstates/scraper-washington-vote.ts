import { z } from "zod"

const chamberSelector = z.strictObject({ classification: z.enum(["lower", "upper"]) })
function chamber(value: unknown) {
  const selector = z.string().startsWith("~").parse(value)
  return chamberSelector.parse(JSON.parse(selector.slice(1))).classification
}

/** Only verified scraper archives may supply this source-specific evidence. No majority inference. */
export function washingtonVoteEvidence(
  value: unknown,
  bill: { identifier: string; actions: readonly Record<string, unknown>[] }
) {
  const vote = z
    .object({
      bill_identifier: z.literal(bill.identifier),
      legislative_session: z.literal("2025-2026"),
      organization: z.string(),
      start_date: z.iso.date(),
      motion_text: z.string(),
      sources: z.array(z.object({ url: z.url() })),
      counts: z
        .array(z.object({ option: z.enum(["yes", "no", "other"]), value: z.number().int().nonnegative() }))
        .length(3),
      votes: z.array(z.object({ voter_name: z.string().min(1), option: z.enum(["yes", "no", "other"]) })).min(1)
    })
    .parse(value)
  const votingChamber = chamber(vote.organization)
  const motion = /^(.*?) \(#([1-9][0-9]*)\)$/.exec(vote.motion_text)
  if (!motion) throw new Error("Washington roll call lacks its source sequence")
  const sources = vote.sources.filter(({ url }) => {
    const source = new URL(url)
    return (
      source.origin === "https://wslwebservices.leg.wa.gov" &&
      !source.username &&
      !source.password &&
      source.pathname === "/legislationservice.asmx/GetRollCalls" &&
      !source.hash &&
      [...source.searchParams].length === 2 &&
      source.searchParams.get("billNumber") === bill.identifier.split(" ")[1] &&
      source.searchParams.get("biennium") === "2025-26"
    )
  })
  const sourceUrl = sources[0]?.url
  if (sources.length !== 1 || sourceUrl === undefined) throw new Error("Invalid Washington roll-call source")
  const counts = new Map(vote.counts.map((entry) => [entry.option, entry.value]))
  if (
    counts.size !== 3 ||
    new Set(vote.votes.map((entry) => entry.voter_name)).size !== vote.votes.length ||
    [...counts].some(([option, count]) => vote.votes.filter((entry) => entry.option === option).length !== count)
  ) {
    throw new Error("Washington roll-call positions do not match source totals")
  }
  // The XML has no outcome field. A unique same-day/chamber final-passage action with exact tallies is evidence;
  // all other motions remain unknown rather than applying a simple-majority rule.
  const outcomes: string[] = []
  if (/^(?:3rd Reading & )?Final Passage$/i.test(motion[1]!)) {
    for (const action of bill.actions) {
      if (action.date !== vote.start_date) continue
      const result =
        typeof action.description === "string"
          ? /^(?:Third reading, )?(passed|failed); yeas, (\d+); nays, (\d+); absent, (\d+); excused, (\d+)\.$/i.exec(
              action.description
            )
          : null
      if (!result || chamber(action.organization_id) !== votingChamber) continue
      if (
        Number(result[2]) === counts.get("yes") &&
        Number(result[3]) === counts.get("no") &&
        Number(result[4]) + Number(result[5]) === counts.get("other")
      )
        outcomes.push(result[1]!.toLowerCase())
    }
  }
  return {
    identity: JSON.stringify(["wa", "2025-2026", bill.identifier, votingChamber, vote.start_date, motion[2]]),
    chamber: votingChamber,
    date: vote.start_date,
    sequence: motion[2]!,
    sourceUrl,
    result:
      outcomes.length === 1 ? (outcomes[0] === "passed" ? ("pass" as const) : ("fail" as const)) : ("unknown" as const)
  }
}
