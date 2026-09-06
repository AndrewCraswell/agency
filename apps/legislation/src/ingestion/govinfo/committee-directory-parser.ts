export type CongressionalChamber = "lower" | "upper"

export interface GovInfoCommitteeMember {
  chamber: CongressionalChamber
  district?: string
  name: string
  role?: string
  state: string
}

export interface GovInfoCommitteeRecord {
  chamber: CongressionalChamber
  classification: "committee" | "subcommittee"
  members: GovInfoCommitteeMember[]
  name: string
  parentName?: string
}

const MEMBER_PATTERN =
  /([A-Z][A-Za-z.'’"\- ]*[A-Za-z.'’"](?:, Jr\.|, Sr\.|, III|, II)?) \(([a-z]{2})(?:-([a-z0-9]{1,2}))?\)(?:\s+(chairman|chairwoman|chair|vice chair|ranking member|member ranking))?/gi
const SECTION_BOUNDARIES = {
  lower: ["STANDING COMMITTEES OF THE HOUSE", "JOINT COMMITTEES"],
  upper: ["STANDING COMMITTEES OF THE SENATE", "STANDING COMMITTEES OF THE HOUSE"]
} as const

/** Parses the text rendition; XML and presentation HTML are intentionally unsupported. */
export function parseGovInfoCommitteeDirectory(text: string): GovInfoCommitteeRecord[] {
  const records = [parseChamber(text, "upper"), parseChamber(text, "lower")].flat()
  const committees = records.filter((record) => record.classification === "committee")
  if (
    committees.filter((record) => record.chamber === "upper").length < 10 ||
    committees.filter((record) => record.chamber === "lower").length < 10
  ) {
    throw new Error("GovInfo Congressional Directory committee parse failed its completeness threshold")
  }
  return records
}

function parseChamber(text: string, chamber: CongressionalChamber): GovInfoCommitteeRecord[] {
  const [startMarker, endMarker] = SECTION_BOUNDARIES[chamber]
  const start = text.indexOf(startMarker)
  const locatedEnd = text.indexOf(endMarker, start + startMarker.length)
  const end = chamber === "lower" && locatedEnd < 0 ? text.length : locatedEnd
  if (start < 0 || end <= start) {
    throw new Error(`GovInfo Congressional Directory lacks the ${chamber} committee section`)
  }
  const blocks = text
    .slice(start + startMarker.length, end)
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0)
    )
    .filter((block) => block.length > 0)

  const records: GovInfoCommitteeRecord[] = []
  let parentName: string | undefined
  let pendingHeading: string | undefined
  let inSubcommittees = false

  for (const lines of blocks) {
    const members = parseMemberColumns(lines, chamber)
    if (members.length > 0) {
      if (pendingHeading === undefined) {
        const previous = records.at(-1)
        if (previous === undefined || previous.chamber !== chamber) {
          throw new Error(`GovInfo ${chamber} committee member block has no heading`)
        }
        previous.members.push(...members)
        continue
      }
      const classification = inSubcommittees ? "subcommittee" : "committee"
      if (classification === "committee") {
        parentName = pendingHeading
      }
      records.push({
        chamber,
        classification,
        members,
        name: pendingHeading,
        ...(classification === "subcommittee" && parentName !== undefined ? { parentName } : {})
      })
      pendingHeading = undefined
      continue
    }

    if (lines.some((line) => line.trim() === "SUBCOMMITTEES")) {
      inSubcommittees = true
      pendingHeading = undefined
      continue
    }
    const heading = extractHeading(lines)
    if (heading === undefined) {
      continue
    }
    if (!isUppercaseHeading(heading)) {
      inSubcommittees = false
    }
    pendingHeading = heading
  }
  return records
}

/** Repair each printed column independently so a wrapped name cannot absorb its neighbor. */
function parseMemberColumns(lines: readonly string[], chamber: CongressionalChamber): GovInfoCommitteeMember[] {
  const columns: string[][] = [[], []]
  for (const line of lines) {
    const cells = line.trim().split(/\s{2,}/)
    for (const [index, cell] of cells.entries()) {
      const column = columns[index]
      if (column !== undefined) {
        column.push(cell)
      }
    }
  }
  return columns.flatMap((column) => parseMembers(repairWrappedMembers(column).join("\n"), chamber))
}

function repairWrappedMembers(lines: readonly string[]): string[] {
  const repaired: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    const previousIndex = repaired.length - 1
    if (/^\([a-z]{2}(?:-[a-z0-9]{1,2})?\)/i.test(trimmed) && previousIndex >= 0) {
      repaired[previousIndex] = `${repaired[previousIndex]} ${trimmed}`
    } else if (/^(member|chair|man|sistant chair)$/i.test(trimmed) && previousIndex >= 0) {
      const previous = repaired[previousIndex] ?? ""
      repaired[previousIndex] = previous.endsWith("-") ? `${previous.slice(0, -1)}${trimmed}` : `${previous} ${trimmed}`
    } else {
      repaired.push(line)
    }
  }
  return repaired
}

function parseMembers(block: string, chamber: CongressionalChamber): GovInfoCommitteeMember[] {
  return [...block.matchAll(MEMBER_PATTERN)].map((match) => ({
    chamber,
    ...(match[3] === undefined ? {} : { district: normalizeDistrict(match[3]) }),
    name: match[1]?.replaceAll(/\s+/g, " ").trim() ?? "",
    ...(match[4] === undefined ? {} : { role: canonicalRole(match[4]) }),
    state: match[2]?.toUpperCase() ?? ""
  }))
}

function extractHeading(lines: readonly string[]): string | undefined {
  const candidates = lines
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 2 &&
        !line.startsWith("[") &&
        !line.startsWith("(") &&
        !/^[_-]+$/.test(line) &&
        !line.startsWith("https://") &&
        !/\bRoom\b|\(ph\)|\(f\)|The Capitol|Building|Majority:|Minority:/i.test(line) &&
        !/^(SELECT AND SPECIAL COMMITTEES|JOINT COMMITTEES|OF THE|SUBCOMMITTEES)$/i.test(line)
    )
  if (candidates.length === 0) {
    return undefined
  }
  return candidates
    .join(" ")
    .replaceAll(/\s+/g, " ")
    .replace(/\s*\.{3,}\s*$/, "")
    .trim()
}

function isUppercaseHeading(value: string): boolean {
  const letters = value.replaceAll(/[^A-Za-z]/g, "")
  return letters.length > 0 && letters === letters.toUpperCase()
}

function normalizeDistrict(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "at" || normalized === "al" || normalized === "dl") {
    return "0"
  }
  return /^\d+$/.test(normalized) ? String(Number(normalized)) : normalized
}

function canonicalRole(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized.includes("ranking")) {
    return "ranking-member"
  }
  if (normalized.includes("vice")) {
    return "vice-chair"
  }
  return "chair"
}
