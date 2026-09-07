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
const fullMember = new RegExp(`^(.+?)(?:,|\\.)? (?:of (?:the )?)?(${stateNames})(?:[.,]?\\s*(.*))?$`, "i")
const memberWithoutOf = new RegExp(
  `^.+?, (${stateNames})(?:\\.|, (?:Chair(?:man|woman)?|Vice Chair(?:man|woman)?|Ranking (?:Minority )?Member)\\.?)?$`,
  "i"
)
const memberWithOf = new RegExp(`^.+?[,\\.]?\\s+of (?:the )?(?:${stateNames})(?=[.,\\s]|$)`, "i")
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
  const source = granule.text.replaceAll(
    /([A-Za-z][A-Za-z.’'-]*(?: [A-Za-z][A-Za-z.’'-]*)*), of (Mississppi|Masschusetts)(?=[.,])/g,
    (entry: string, name: string, misspelling: string) => {
      const state = misspelling === "Mississppi" ? "Mississippi" : "Massachusetts"
      // Correct only when this exact printed person has the correctly spelled state
      // elsewhere in this same granule. Uncorroborated misspellings still fail closed.
      if (!granule.text.includes(`${name}, of ${state}`)) {
        throw new Error(`Uncorroborated GovInfo state spelling: ${entry}`)
      }
      return `${name}, of ${state}`
    }
  )
  // This 105th snapshot explicitly records Pallone's election after his prior
  // leave. It does not authorize stripping other markers or active-leave notes.
  const palloneNote = source.match(
    /^[ \t]*1 Representative Frank Pallone, Jr\. \(D–NJ\)[\s\S]*?since the beginning of the 105th Congress\./m
  )?.[0]
  const palloneElected =
    granule.chamber === "lower" &&
    granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
    palloneNote?.replaceAll(/\s+/g, " ").trim() ===
      "1 Representative Frank Pallone, Jr. (D–NJ) was elected to the Committee on Commerce for the 105th Congress on February 13, 1997, pursuant to H. Res. 58, which passed the House on February 13, 1997. Previously, Mr. Pallone had been on sabbatical leave from the Committee since the beginning of the 105th Congress."
  const rosterSource = palloneElected && palloneNote ? source.replace(palloneNote, "") : source
  // The 105th Government Reform roster omits Sanders's state in both text
  // renditions. His exact full name has an explicit state elsewhere in this
  // granule; any missing or conflicting state evidence keeps the row invalid.
  const sandersStates = new Set(
    [...source.matchAll(/(?:^|[ \t]{2,})Bernard Sanders, of ([A-Za-z ]+?)[.,]/gm)].map((match) =>
      match[1]?.toLowerCase()
    )
  )
  const body = rosterSource
    .slice(rosterSource.indexOf(granule.title) + granule.title.length)
    .replaceAll(/\[\[Page[^\]]*\]\]/g, "")
    .replaceAll(/\[[\s\S]*?\]/g, "")
    .replaceAll(/^[ \t]*Reauthorized pursuant to S\. Res\. 4, 95th Congress[ \t]*$/gm, "")
    .replaceAll(/\(No Vice Chairman\)\.?/gi, "")
    .replaceAll(/\(No Subcommittees\)\.?/gi, "")
    .replaceAll(/,´\s*(?=of\b)/g, ", ")
    .replaceAll(/^[ \t]*´[ \t]*$/gm, "")
    .replaceAll(/^([ \t]*)\*([ \t]+Children and Families[ \t]*)$/gm, "$1$2")
    .replaceAll(/^[ \t]*(?:Vacant|TBD), (?:Chair|Chairman|Chairwoman)\.?[ \t]*$/gim, "")
    // The 105th/106th Senate rosters run directly into these explicit staff labels.
    // Preserve the member prefix rather than treating the staff tail as another member.
    .replaceAll(
      /^([ \t]*(?:(?:Majority|Minority) )?Staff Director(?:\/Chief Counsel)?\.(?:—|--)[^\n]*)$/gm,
      "\n\nSTAFF\n\n$1"
    )
    // These printed subcommittee headings touch the preceding roster. Match
    // only complete standalone lines, preserving every preceding member cell.
    .replaceAll(
      /^[ \t]+(Retirement and Aging|Primary Health and Aging|The Western Hemisphere|Employer-Employee Relations|Oversight and Investigations)[ \t]*$/gm,
      "\n\n$1\n\n"
    )
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
    if (/^Vacant(?:,|\s|$)/i.test(joined) || /^TBD, (?:Chair|Chairman|Chairwoman)\.?$/i.test(joined)) {
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
        (/^(?:Mr|Mrs|Ms|Miss|Dr)\./.test(line.trim()) ||
          memberWithOf.test(line.trim()) ||
          (!/\d/.test(line) && memberWithoutOf.test(line.trim().split(/\s{2,}/)[0] ?? "")))
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
      (cell) => /^(?:Mr|Mrs|Ms|Miss|Dr)\./.test(cell) || memberWithOf.test(cell) || memberWithoutOf.test(cell)
    )
    if (hasMembers && isStaff && !isPartyOrganization && !/\.\s*--/.test(joined)) {
      throw new Error(`GovInfo historical member block remains in staff scope: ${joined.slice(0, 100)}`)
    }
    if (hasMembers && !isStaff && !isPartyOrganization) {
      const members = cells
        .filter((cell) => !/^Vacan(?:t|cy)/i.test(cell))
        .map((cell) => {
          try {
            const rosterName = heading ?? current?.name ?? ""
            let memberCell = cell
            if (
              palloneElected &&
              !isSubcommittee &&
              rosterName === "Commerce" &&
              cell === "Frank Pallone, Jr., of New Jersey.1"
            ) {
              memberCell = "Frank Pallone, Jr., of New Jersey."
            } else if (
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              !isSubcommittee &&
              rosterName === "Government Reform and Oversight" &&
              cell === "Bernard Sanders" &&
              sandersStates.size === 1 &&
              sandersStates.has("vermont")
            ) {
              memberCell = "Bernard Sanders, of Vermont."
            }
            const member = parseMember(memberCell, granule.chamber, parent, rosterName, options)
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
      (!/\b\d{3,}\b|:|\.--|\.—|^\(|\.$/.test(joined) ||
        /^(?:Select|Special) Committee on [A-Za-z0-9 ,’'-]+$/.test(joined)) &&
      !/^\(?The (?:chair|committee)/i.test(joined)
    ) {
      heading = heading && /(?:,|\b(?:and|the))$/.test(heading) ? `${heading} ${joined}` : joined
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
        cells.push("")
        continue
      }
      if (cell === "´" || /^[1-9]\d* vacanc(?:y|ies)\.?$/i.test(cell)) {
        cells.push("")
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
        ) ||
        /^\(Speaker[’']s Designee\s*\/\s*Vice Chairman\)\.?$/i.test(cell) ||
        (/\(Speaker[’']s$/.test(previous ?? "") && /^Designee\)\.?$/.test(cell))
      if (
        /^(?:[A-Za-z].*?, of(?: |$)|(?:Mr|Mrs|Ms|Miss|Dr)\.|Vacan)/.test(cell) ||
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
  const abbreviated = /^(?:Mr|Mrs|Ms|Miss|Dr)\.\s+([^,]+)(?:,\s*(.*))?$/.exec(cell.trim())
  if (!abbreviated?.[1] || !parent) {
    throw new Error(`Unparsed GovInfo historical roster entry: ${cell}`)
  }
  // The printed 105th roster distinguishes T. Davis and D. Davis. Match
  // a single explicit given-name initial against the parent roster, never
  // infer it from an honorific or use it without the whole surname boundary.
  const initialQualified = /^([A-Z])\.\s+([^.]+)$/.exec(abbreviated[1])
  if (/^[A-Z]\./.test(abbreviated[1]) && !initialQualified) {
    throw new Error(`Ambiguous GovInfo abbreviated member ${cell}: unsupported initial format`)
  }
  const key = normalizeName(initialQualified?.[2] ?? abbreviated[1])
  const matches = parent.members.filter((member) => {
    const name = normalizeName(member.name)
    return (
      (name === key || name.endsWith(` ${key}`)) &&
      (!initialQualified || name.charAt(0) === initialQualified[1]?.toLowerCase())
    )
  })
  const resolved =
    matches.length !== 1 && !initialQualified
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
  // This identifies the appointing authority, not a chair or vice-chair office.
  if (/^\(Speaker[’']s Designee\)\.?$/i.test(value.trim())) {
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
  if (value.trim() === "" || value.trim() === "´") {
    return undefined
  }
  throw new Error(`Unrecognized GovInfo membership role: ${value}`)
}
