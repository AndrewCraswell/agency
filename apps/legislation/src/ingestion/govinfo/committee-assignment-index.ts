import { openStatesJurisdictionNames } from "../openstates/coverage.js"
import type { GovInfoCommitteeGranuleText } from "./committee-granule-text.js"
import type { HistoricalCommitteeParserOptions } from "./committee-historical-parser.js"

type AssignmentContext = Parameters<NonNullable<HistoricalCommitteeParserOptions["resolveAbbreviatedMember"]>>[0]

/** Disambiguate only using positive assignments in the same published directory. */
export function createGovInfoAssignmentResolver(granules: readonly GovInfoCommitteeGranuleText[]) {
  const entries = granules.flatMap((granule) => {
    const rows: { identity: string; assignments: string; chamber: string }[] = []
    for (const line of granule.text.split("\n")) {
      const start = /^\s*(\S.*?)\s+\([DRI]\)\s{2,}(\S.*)$/.exec(line)
      if (start?.[1] && start[2]) {
        rows.push({ identity: start[1], assignments: start[2], chamber: granule.chamber })
      } else if (/^ {30,}\S/.test(line)) {
        const row = rows.at(-1)
        if (row !== undefined) {
          row.assignments += ` ${line.trim()}`
        }
      }
    }
    return rows
  })
  return (context: AssignmentContext) => {
    // The 105th roster prints Aschcroft here, while its own assignment table
    // explicitly assigns Ashcroft to this subcommittee. Never use edit distance.
    const requestedName =
      context.chamber === "upper" &&
      context.name === "Aschcroft" &&
      normalize(context.parent.name) === "commerce science and transportation" &&
      normalize(context.subcommitteeName) === "manufacturing and competitiveness"
        ? "Ashcroft"
        : context.name
    const candidates = context.parent.members.filter((member) => {
      if (!normalize(member.name).endsWith(normalize(requestedName))) {
        return false
      }
      return entries.some((entry) => {
        if (entry.chamber !== context.chamber) {
          return false
        }
        const identity = /^(.*?)\s+of\s+(.+)$/.exec(entry.identity)
        const surname = identity?.[1] ?? (context.chamber === "upper" ? entry.identity : undefined)
        if (!surname || normalize(surname) !== normalize(requestedName)) {
          return false
        }
        const state = Object.entries(openStatesJurisdictionNames).find(
          ([, name]) => normalize(name) === normalize(identity?.[2] ?? "")
        )?.[0]
        if (identity?.[2] !== undefined && state?.toUpperCase() !== member.state.toUpperCase()) {
          return false
        }
        return entry.assignments.split(/\.\s+/).some((clause) => {
          const [committee, subcommittees] = clause.split(/\s*--\s*/)
          return (
            committee !== undefined &&
            subcommittees !== undefined &&
            normalize(committee) === normalize(context.parent.name) &&
            subcommittees.split(";").some((name) => normalize(name) === normalize(context.subcommitteeName))
          )
        })
      })
    })
    const unique = new Map(candidates.map((member) => [JSON.stringify([member.name, member.state]), member]))
    return unique.size === 1 ? unique.values().next().value : undefined
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()
}
