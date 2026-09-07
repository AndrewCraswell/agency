import { openStatesJurisdictionNames } from "../openstates/coverage.js"
import type {
  CongressionalChamber,
  GovInfoCommitteeMember,
  GovInfoCommitteeRecord
} from "./committee-directory-parser.js"
import type { GovInfoCommitteeGranuleText } from "./committee-granule-text.js"

const states = new Map(
  Object.entries(openStatesJurisdictionNames).map(([code, name]) => [name.toLowerCase(), code.toUpperCase()])
)
states.set("guam", "GU")
states.set("virgin islands", "VI")
states.set("american samoa", "AS")
states.set("northern mariana islands", "MP")
// Printed state typo in the 115th Senate directory; it is not a new jurisdiction.
states.set("nebraksa", "NE")
const stateNames = [...states.keys()].sort((a, b) => b.length - a.length).join("|")
const fullMember = new RegExp(`^(.+?), (?:of (?:the )?)?(${stateNames})(?:[.,]?\\s*(.*))?$`, "i")
const memberWithoutOf = new RegExp(`^.+?, (${stateNames})\\.?$`, "i")
export type HistoricalCommitteeParserOptions = {
  resolveAbbreviatedMember?: (context: {
    name: string
    parent: GovInfoCommitteeRecord
    subcommitteeName: string
    chamber: CongressionalChamber
  }) => GovInfoCommitteeMember | undefined
}

/** Historical printed rosters. Ambiguous abbreviated names never become guessed memberships. */
export function parseGovInfoHistoricalCommitteeText(
  granules: readonly GovInfoCommitteeGranuleText[],
  options: HistoricalCommitteeParserOptions = {}
): GovInfoCommitteeRecord[] {
  const result = granules.flatMap((granule) => parseGranule(granule, options))
  for (const chamber of ["upper", "lower"]) {
    if (result.filter((record) => record.chamber === chamber && record.classification === "committee").length < 10) {
      throw new Error(`GovInfo historical ${chamber} roster failed its completeness threshold`)
    }
  }
  return result
}

export function parseGovInfoHistoricalCommitteeGranule(
  granule: GovInfoCommitteeGranuleText,
  options: HistoricalCommitteeParserOptions = {}
): GovInfoCommitteeRecord[] {
  return parseGranule(granule, options)
}

function parseGranule(
  granule: GovInfoCommitteeGranuleText,
  options: HistoricalCommitteeParserOptions
): GovInfoCommitteeRecord[] {
  const body = granule.text
    .slice(granule.text.indexOf(granule.title) + granule.title.length)
    .replaceAll(/\[\[Page[^\]]*\]\]/g, "")
    .replaceAll(/\[[\s\S]*?\]/g, "")
    .replaceAll(/\(No Vice Chairman\)\.?/gi, "")
    .replaceAll(/\(No Subcommittees\)\.?/gi, "")
    .replaceAll(/,´(?=\s+of\b)/g, ",")
    .replaceAll(/^[ \t]*´[ \t]*$/gm, "")
    // These printed HELP headings touch the preceding roster at a page boundary.
    .replaceAll(/^[ \t]+(Retirement and Aging|Primary Health and Aging)[ \t]*$/gm, "\n\n$1\n\n")
    .replaceAll(/^[ \t]*(?:COMMITTEE )?STAFF[ \t]*$/gm, "\n\nSTAFF\n\n")
    .replaceAll(/^[ \t]*SUBCOMMITTEES[ \t]*$/gm, "\n\nSUBCOMMITTEES\n\n")
  const partyBoundary =
    /^[ \t]*(?:National (?:Republican|Democratic) (?:Congressional|Senatorial) Committee|(?:(?:House|Senate) )?(?:Democratic|Republican) (?:Conference|Caucus|Policy|Steering|Senatorial|Congressional|Campaign|National))\b/m.exec(
      body
    )
  const text = partyBoundary ? body.slice(0, partyBoundary.index) : body
  const records: GovInfoCommitteeRecord[] = []
  let parent: GovInfoCommitteeRecord | undefined
  let current: GovInfoCommitteeRecord | undefined
  let heading: string | undefined
  let isSubcommittee = false
  let isStaff = false
  let isPartyOrganization = false
  let isExOfficioBlock = false
  for (const block of text.split(/\n\s*\n/).filter((part) => part.trim())) {
    const lines = block.split("\n").filter((line) => line.trim())
    const joined = lines.map((line) => line.trim()).join(" ")
    if (/^Vacant(?:,|\s|$)/i.test(joined)) {
      continue
    }
    if (
      /^(?:National (?:Republican|Democratic) (?:Congressional|Senatorial) Committee|(?:(?:House|Senate) )?(?:Democratic|Republican) (?:Conference|Caucus|Policy|Steering|Senatorial|Congressional|Campaign|National))\b/i.test(
        lines[0]?.trim() ?? ""
      )
    ) {
      break
    }
    if (/^SUBCOMMITTEES\.?$/.test(joined)) {
      isSubcommittee = true
      isStaff = false
      isExOfficioBlock = false
      heading = undefined
      continue
    }
    if (/^Ex Officio\.?$/i.test(joined)) {
      isExOfficioBlock = true
      heading = undefined
      continue
    }
    if (/^(?:COMMITTEE )?STAFF$/.test(joined)) {
      isStaff = true
      heading = undefined
      isExOfficioBlock = false
      continue
    }
    const firstMemberLine = lines.findIndex(
      (line) =>
        !/\.—|\.\s*--/.test(line) &&
        (/,\s+of (?:the )?[A-Z]|^(?:Mr|Mrs|Ms|Miss)\./.test(line.trim()) ||
          (!/\d/.test(line) && memberWithoutOf.test(line.trim())))
    )
    const rosterLines = firstMemberLine > 0 ? lines.slice(firstMemberLine) : lines
    if (firstMemberLine > 0) {
      const preceding = lines.slice(0, firstMemberLine)
      const candidates = preceding
        .map((line) => line.trim())
        .filter((line) => !/phone|fax|Building|https?:|meets|\.—|\.--|:|^Vacant|^STAFF|^No Subcommittees/i.test(line))
      if (candidates.length > 0) {
        heading = candidates.join(" ")
        const hasContact = preceding.some((line) => /phone|Building|https?:/.test(line))
        if (hasContact || isStaff) {
          isSubcommittee = false
        } else if (parent && current?.members.length) {
          isSubcommittee = true
        }
        isStaff = false
      }
    }
    const cells = firstMemberLine < 0 ? [] : memberCells(rosterLines)
    const hasMembers = cells.some(
      (cell) => /,\s+of (?:the )?[A-Z]|^(?:Mr|Mrs|Ms|Miss)\./.test(cell) || fullMember.test(cell)
    )
    if (hasMembers && isStaff && !isPartyOrganization && !/\.\s*--/.test(joined)) {
      throw new Error(`GovInfo historical member block remains in staff scope: ${joined.slice(0, 100)}`)
    }
    if (hasMembers && !isStaff && !isPartyOrganization) {
      const members = cells
        .filter((cell) => !/^Vacan(?:t|cy)/i.test(cell))
        .map((cell) => {
          try {
            const member = parseMember(cell, granule.chamber, parent, heading ?? current?.name ?? "", options)
            return isExOfficioBlock ? { ...member, role: "ex-officio" } : member
          } catch (error) {
            throw new Error(
              `${error instanceof Error ? error.message : "Invalid member"} in ${heading ?? current?.name}: ${rosterLines.slice(0, 3).join(" | ")}`
            )
          }
        })
      if (heading !== undefined) {
        current = {
          chamber: granule.chamber,
          classification: isSubcommittee ? "subcommittee" : "committee",
          name: heading,
          members: [],
          ...(isSubcommittee && parent ? { parentName: parent.name } : {})
        }
        if (isSubcommittee && !parent) {
          throw new Error(`GovInfo subcommittee ${heading} has no parent`)
        }
        if (!isSubcommittee) {
          parent = current
        }
        records.push(current)
        heading = undefined
      }
      if (!current) {
        throw new Error(`GovInfo roster has members without a heading: ${joined}`)
      }
      current.members.push(...members)
      continue
    }
    if (
      /phone|\bfax\b|Office Building|https?:|^meets\b|^Republicans|^Democrats|^Independents|^Room numbers/i.test(joined)
    ) {
      const first = lines[0]
      if (
        first &&
        /^ {3,}[A-Z]/.test(first) &&
        !/\b\d{3,}\b|phone|fax|Office Building|https?:|^\s*meets|:|\.—/i.test(first)
      ) {
        heading = first.trim()
        if (isStaff) {
          isSubcommittee = false
        }
        isStaff = false
      }
      if (/phone|Office Building/.test(joined) && heading) {
        isStaff = false
      }
      continue
    }
    if (
      (!/\b\d{3,}\b|:|\.--|\.—|^\(|\.$/.test(joined) || /^Select Committee on [A-Za-z0-9 ,’'-]+$/.test(joined)) &&
      !/^\(?The (?:chair|committee)/i.test(joined)
    ) {
      heading = joined
      isExOfficioBlock = false
      isPartyOrganization = /^(?:(?:Senate|House) )?(?:Democratic|Republican)\b/i.test(joined)
      if (isPartyOrganization) {
        break
      }
      // A new centered title after the staff section is a parent committee.
      if (isStaff) {
        isSubcommittee = false
        isStaff = false
      }
    }
  }
  if (records.length === 0) {
    throw new Error(`GovInfo historical granule ${granule.title} has no parsed rosters`)
  }
  return records
}

function memberCells(lines: readonly string[]): string[] {
  const columns: string[][] = [[], []]
  const boundaries = lines.flatMap((line) => {
    const match = /\S {2,}(?=\S)/.exec(line)
    return match ? [match.index + match[0].length] : []
  })
  const boundary = boundaries.length > 0 ? Math.min(...boundaries) : undefined
  for (const line of lines) {
    const rawCells = line
      .trim()
      .replaceAll(/,\s+(?=of\b)/g, ", ")
      .split(/\s{2,}/)
    const cells: string[] = []
    for (const cell of rawCells) {
      if (/^\.$/.test(cell)) {
        continue
      }
      if (
        (/^[.,]*\s*of\b/.test(cell) ||
          /^(?:Chair(?:man|woman)?|Vice Chair(?:man|woman)?|Ranking (?:Minority )?Member)\.?$/i.test(cell)) &&
        cells.length > 0
      ) {
        cells[cells.length - 1] = `${cells.at(-1)}${cell.startsWith(",") || cell.startsWith(".") ? "" : " "}${cell}`
      } else {
        cells.push(cell)
      }
    }
    if (cells.length === 1 && boundary !== undefined && line.search(/\S/) >= boundary - 2) {
      cells.unshift("")
    }
    for (const [i, cell] of cells.entries()) {
      if (!cell) {
        continue
      }
      const column = columns[i]
      if (!column) {
        throw new Error(`GovInfo roster has more than two printed columns: ${JSON.stringify(cells)}`)
      }
      const previous = column.at(-1)
      const isWrappedRole =
        /^(?:Ranking (?:Minority )?Member|Vice Chair(?:man|woman)?|Member|Chairman|Chairwoman|Chair|officio|Leader|Whip)\.?$/i.test(
          cell
        ) || /^\(Speaker[’']s Designee\s*\/\s*Vice Chairman\)\.?$/i.test(cell)
      if (
        /^(?:[A-Za-z].*?, of(?: |$)|(?:Mr|Mrs|Ms|Miss)\.|Vacan)/.test(cell) ||
        column.length === 0 ||
        (previous && fullMember.test(previous) && !isWrappedRole)
      ) {
        column.push(cell)
      } else {
        column[column.length - 1] = `${column.at(-1)} ${cell}`
      }
    }
  }
  return columns.flat()
}

function parseMember(
  cell: string,
  chamber: CongressionalChamber,
  parent: GovInfoCommitteeRecord | undefined,
  subcommitteeName: string,
  options: HistoricalCommitteeParserOptions
): GovInfoCommitteeMember {
  const full = fullMember.exec(cell.trim())
  if (full?.[1] && full[2]) {
    const state = states.get(full[2].toLowerCase())
    if (!state) {
      throw new Error(`Unknown GovInfo member state ${full[2]}`)
    }
    const role = memberRole(full[3])
    return { chamber, name: full[1].replace(/,$/, "").trim(), state, ...(role ? { role } : {}) }
  }
  const abbreviated = /^(?:Mr|Mrs|Ms|Miss)\.\s+([^,]+)(?:,\s*(.*))?$/.exec(cell.trim())
  if (!abbreviated?.[1] || !parent) {
    throw new Error(`Unparsed GovInfo historical roster entry: ${cell}`)
  }
  const key = normalizeName(abbreviated[1])
  const matches = parent.members.filter((member) => normalizeName(member.name).endsWith(key))
  const resolved =
    matches.length !== 1
      ? options.resolveAbbreviatedMember?.({ name: abbreviated[1], parent, subcommitteeName, chamber })
      : undefined
  const member = resolved ?? matches[0]
  if (
    resolved &&
    !parent.members.some((candidate) => candidate.name === resolved.name && candidate.state === resolved.state)
  ) {
    throw new Error("GovInfo abbreviation resolver escaped its parent roster")
  }
  if ((!resolved && matches.length !== 1) || !member) {
    throw new Error(`Ambiguous GovInfo abbreviated member ${cell} in ${parent.name}: ${matches.length} candidates`)
  }
  const role = memberRole(abbreviated[2])
  return { chamber, name: member.name, state: member.state, ...(role ? { role } : {}) }
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z ]/g, "")
    .replace(/\s+(?:jr|sr|iv|iii|ii)$/, "")
    .trim()
}
function memberRole(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  if (/ranking/i.test(value)) {
    return "ranking-member"
  }
  if (/vice/i.test(value)) {
    return "vice-chair"
  }
  if (/chair/i.test(value)) {
    return "chair"
  }
  if (/ex officio/i.test(value)) {
    return "ex-officio"
  }
  if (/^(?:Democratic|Republican|Majority|Minority) (?:Leader|Whip)\.?$/i.test(value)) {
    return value.toLowerCase().replace(/\.$/, "").replaceAll(" ", "-")
  }
  if (value.trim() === "") {
    return undefined
  }
  throw new Error(`Unrecognized GovInfo membership role: ${value}`)
}
