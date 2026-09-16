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
  packageId?: string
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
  const davisNote =
    "In addition, the Republican Conference assigned Representative Thomas M. Davis III, Virginia, to the Committee on Commerce, and placed him on sabbatical leave for the 106th Congress."
  const davisOnLeave =
    ["CDIR-1999-06-15", "CDIR-2000-02-01", "CDIR-2000-10-01"].includes(options.packageId ?? "") &&
    granule.chamber === "lower" &&
    granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
    source.replaceAll(/\s+/g, " ").includes(`*${davisNote}`)
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
  // National Security prints McIntrye, while Agriculture in this same granule
  // prints the exact full name Mike McIntyre with North Carolina. Keep this
  // one parent-cell repair bounded; never apply general transposition matching.
  const mcIntyreStates = new Set(
    [...source.matchAll(/(?:^|[ \t]{2,})Mike McIntyre, of ([A-Za-z ]+?)[.,]/gm)].map((match) => match[1]?.toLowerCase())
  )
  const delahuntStates = new Set(
    [...source.matchAll(/(?:^| {2,})William(?: D\.)? Delahunt, of ([A-Za-z ]+?)(?=[.,])/gm)].map((match) => match[1])
  )
  const delahuntCorroborated =
    ["CDIR-1999-06-15", "CDIR-2000-02-01", "CDIR-2000-10-01"].includes(options.packageId ?? "") &&
    granule.chamber === "lower" &&
    granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
    /(?:^| {2,})William Delahunt, of Massachusetts[.,]/m.test(source) &&
    [...delahuntStates].every((state) => state === "Massachusetts" || state === "Massachusette")
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
      /^[ \t]+(Retirement and Aging|Primary Health and Aging|The Western Hemisphere|Employer-Employee Relations|Oversight and Investigations|Asia and the Pacific|International Operations and Human Rights|International Economic Policy and Trade|Water Resources and Environment)[ \t]*$/gm,
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
            let memberNote: string | undefined
            if (
              options.packageId === "CDIR-1997-06-04" &&
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              parent?.name === "Ways and Means" &&
              isSubcommittee &&
              rosterName === "Social Security" &&
              cell === "Mr. Becerna"
            ) {
              if (
                parent.members.filter((member) => member.name === "Xavier Becerra" && member.state === "CA").length !==
                  1 ||
                parent.members.filter((member) => /(?:^| )Becerra$/.test(member.name)).length !== 1 ||
                parent.members.some((member) => /(?:^| )Becerna$/.test(member.name))
              ) {
                throw new Error("Ambiguous GovInfo Becerna: reviewed identity evidence changed; re-review required")
              }
              memberCell = "Mr. Becerra"
            }
            if (
              options.packageId === "CDIR-1997-06-04" &&
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              parent?.name === "Ways and Means" &&
              isSubcommittee &&
              rosterName === "Health" &&
              (cell === "Ms. Johnson" || cell === "Mr. Johnson")
            ) {
              // These exact tokens are independently identified in two other printed
              // panels by state/initial-qualified assignments, not by gender inference.
              const committeeText = source.match(/^\s*Ways and Means\s*$([\s\S]*?)^\s*STAFF\s*$/m)?.[1] ?? ""
              const oversightToken = /^\s*Oversight\s*\n\s*Ms\. Johnson, Chairwoman\s*$/m.test(committeeText)
              const socialToken =
                /^\s*Social Security\s*\n\s*Mr\. Bunning, Chairman\s*\n\s*Mr\. Johnson[ \t]{2,}/m.test(committeeText)
              const reviewedParent = parent
              const resolve = (subcommitteeName: string) =>
                options.resolveAbbreviatedMember?.({
                  name: "Johnson",
                  parent: reviewedParent,
                  subcommitteeName,
                  chamber: granule.chamber
                })
              const nancy = resolve("Oversight")
              const sam = resolve("Social Security")
              if (
                !cells.includes("Ms. Johnson") ||
                !cells.includes("Mr. Johnson") ||
                !oversightToken ||
                !socialToken ||
                nancy?.name !== "Nancy L. Johnson" ||
                nancy.state !== "CT" ||
                sam?.name !== "Sam Johnson" ||
                sam.state !== "TX" ||
                parent.members.filter((member) => /(?:^| )Johnson$/.test(member.name)).length !== 2 ||
                parent.members.filter((member) => member.name === "Nancy L. Johnson" && member.state === "CT")
                  .length !== 1 ||
                parent.members.filter((member) => member.name === "Sam Johnson" && member.state === "TX").length !== 1
              ) {
                throw new Error(
                  "Ambiguous GovInfo Health Johnson: reviewed cross-panel evidence changed; re-review required"
                )
              }
              memberCell = cell === "Ms. Johnson" ? "Ms. N. Johnson" : "Mr. S. Johnson"
            }
            if (
              options.packageId === "CDIR-1997-06-04" &&
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              parent?.name === "Resources" &&
              isSubcommittee &&
              rosterName === "Forests and Forest Health" &&
              cell === "Mr. Randovich" &&
              parent.members.filter(
                (candidate) => candidate.name === "George P. Radanovich" && candidate.state === "CA"
              ).length === 1 &&
              parent.members.filter((candidate) => /(?:^| )Radanovich$/.test(candidate.name)).length === 1 &&
              !parent.members.some((candidate) => /(?:^| )Randovich$/.test(candidate.name))
            ) {
              memberCell = "Mr. Radanovich"
            }
            if (delahuntCorroborated && cell === "William D. Delahunt, of Massachusette.") {
              memberCell = "William D. Delahunt, of Massachusetts."
            }
            if (
              options.packageId === "CDIR-1997-06-04" &&
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              parent?.name === "Resources" &&
              isSubcommittee &&
              ["National Parks and Public Lands", "Water and Power"].includes(rosterName) &&
              cell === "Ms. Smith" &&
              cells.includes("Mr. R. Smith") &&
              (rosterName !== "Water and Power" || cells.includes("Mr. A. Smith"))
            ) {
              const linda = parent.members.filter(
                (candidate) => candidate.name === "Linda Smith" && candidate.state === "WA"
              )
              if (
                linda.length === 1 &&
                parent.members.filter((candidate) => candidate.name === "Linda Smith").length === 1
              ) {
                const positiveAssignment = options.resolveAbbreviatedMember?.({
                  name: "Smith",
                  parent: { ...parent, members: linda },
                  subcommitteeName: rosterName,
                  chamber: granule.chamber
                })
                if (positiveAssignment?.name === "Linda Smith" && positiveAssignment.state === "WA") {
                  memberCell = "Ms. L. Smith"
                }
              }
            }
            if (
              options.packageId === "CDIR-1997-06-04" &&
              granule.chamber === "lower" &&
              parent?.name === "Resources" &&
              isSubcommittee &&
              ["National Parks and Public Lands", "Water and Power"].includes(rosterName) &&
              memberCell === "Ms. Smith"
            ) {
              throw new Error("Ambiguous GovInfo abbreviated member Ms. Smith: reviewed evidence is incomplete")
            }
            if (
              davisOnLeave &&
              !isSubcommittee &&
              rosterName === "Commerce" &&
              cell === "Thomas M. Davis III, of Virginia.*"
            ) {
              memberCell = "Thomas M. Davis III, of Virginia."
              memberNote = davisNote
            }
            if (
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              isSubcommittee &&
              parent?.name === "National Security" &&
              rosterName === "Special Oversight Panel on the Merchant Marine" &&
              cell === "Mr. Abercombie" &&
              options.packageId === "CDIR-1997-06-04" &&
              parent.members.filter((member) => member.name === "Neil Abercrombie" && member.state === "HI").length ===
                1 &&
              parent.members.filter((member) => /(?:^| )Abercrombie$/.test(member.name)).length === 1 &&
              !parent.members.some((member) => /(?:^| )Abercombie$/.test(member.name))
            ) {
              // The panel's own explicit row proves the assignment; only its typo is repaired.
              memberCell = "Mr. Abercrombie"
            }
            if (
              options.packageId === "CDIR-1997-06-04" &&
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              isSubcommittee &&
              ((parent?.name === "Resources" &&
                rosterName === "Forests and Forest Health" &&
                memberCell === "Mr. Randovich") ||
                (parent?.name === "National Security" &&
                  rosterName === "Special Oversight Panel on the Merchant Marine" &&
                  memberCell === "Mr. Abercombie"))
            ) {
              throw new Error(
                `Ambiguous GovInfo abbreviated member ${cell}: reviewed identity evidence changed; re-review required`
              )
            }
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
            } else if (
              granule.chamber === "lower" &&
              granule.title === "STANDING COMMITTEES OF THE HOUSE" &&
              !isSubcommittee &&
              rosterName === "National Security" &&
              cell === "Mike McIntrye, of North Carolina." &&
              mcIntyreStates.size === 1 &&
              mcIntyreStates.has("north carolina")
            ) {
              memberCell = "Mike McIntyre, of North Carolina."
            }
            const member = parseMember(memberCell, granule.chamber, parent, rosterName, options)
            return {
              ...member,
              ...(memberNote ? { note: memberNote } : {}),
              ...(isExOfficioBlock ? { role: "ex-officio" } : {})
            }
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
      if (cell === "´" || /^(?:[1-9]\d* vacanc(?:y|ies)|vacancy)\.?$/i.test(cell)) {
        cells.push("")
        continue
      }
      if (/^vacancy\b/i.test(cell)) {
        throw new Error(`Unrecognized GovInfo vacancy annotation: ${cell}`)
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
