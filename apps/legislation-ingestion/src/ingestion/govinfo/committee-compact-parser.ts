import { openStatesJurisdictionNames } from "../openstates/coverage.js"
import type { CongressionalChamber, GovInfoCommitteeRecord } from "./committee-directory-parser.js"

/** The 118th text rendition flattens each printed roster into a single annotated line. */
export function parseGovInfoCompactCommitteeDirectory(text: string): GovInfoCommitteeRecord[] {
  return [parseChamber(text, "upper"), parseChamber(text, "lower")].flat()
}

function parseChamber(text: string, chamber: CongressionalChamber): GovInfoCommitteeRecord[] {
  const marker = `STANDING COMMITTEES OF THE ${chamber === "upper" ? "SENATE" : "HOUSE"}`
  const start = text.indexOf(marker)
  const endMarker = chamber === "upper" ? "STANDING COMMITTEES OF THE HOUSE" : "JOINT COMMITTEES"
  const locatedEnd = text.indexOf(endMarker, start + marker.length)
  if (start < 0 || (chamber === "upper" && locatedEnd < 0)) {
    throw new Error(`GovInfo compact directory lacks ${chamber} section`)
  }
  const source = text
    .slice(start + marker.length, locatedEnd < 0 ? text.length : locatedEnd)
    .replaceAll(/([A-Z][A-Za-z .'-]+), of ([A-Z][A-Za-z ]+)\./g, (_match, name: string, stateName: string) => {
      const entry = Object.entries(openStatesJurisdictionNames).find(([, value]) => value === stateName)
      if (!entry) {
        throw new Error(`Unknown GovInfo compact full state: ${stateName}`)
      }
      return `${name} (${entry[0].toUpperCase()})`
    })
  const blocks = source
    .replaceAll(/\[[\s\S]*?\]/g, (value) => (value === "[VACANT]" ? value : ""))
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  const records: GovInfoCommitteeRecord[] = []
  let parentName: string | undefined
  for (const [index, block] of blocks.entries()) {
    const line = block
      .replaceAll(/\((?!ph\))[a-z]{2}(?:-[a-z0-9]{1,2})?\)/gi, (value) => value.toUpperCase())
      .replaceAll(/\[VACANT\](?:\s+CHAIR(?:MAN|WOMAN)?)?/g, "")
      .replaceAll(/\s+/g, " ")
    if (!/\((?!PH\))[A-Z]{2}(?:-[A-Z0-9]{1,2})?\)/.test(line)) {
      continue
    }
    const heading = precedingHeading(blocks, index)
    if (heading === undefined) {
      throw new Error(
        `GovInfo compact roster crosses line or heading boundaries; source reading order requires validation: ${blocks[index - 1]?.slice(0, 100)} => ${line.slice(0, 100)}`
      )
    }
    const isSubcommittee = heading === heading.toUpperCase()
    if (!isSubcommittee) {
      parentName = heading
    }
    if (!parentName) {
      throw new Error(`GovInfo compact subcommittee ${heading} has no parent`)
    }
    const members = [
      ...line.matchAll(
        /([^()]+)\(([A-Z]{2})(?:-([A-Z0-9]{1,2}))?\),?\s*(VICE CHAIRWOMAN|VICE CHAIRMAN|VICE CHAIR|CHAIRWOMAN|CHAIRMAN|CHAIR|RANKING MEMBER|MEMBER RANKING)?/g
      )
    ].map((match) => {
      const sourceName = match[1]?.replaceAll(/\[VACANT\]/g, "").trim()
      const leadingRole = sourceName?.match(
        /\s+(VICE CHAIRWOMAN|VICE CHAIRMAN|VICE CHAIR|CHAIRWOMAN|CHAIRMAN|CHAIR|RANKING MEMBER)$/
      )?.[1]
      const name = leadingRole ? sourceName?.slice(0, -leadingRole.length).trim() : sourceName
      const state = match[2]
      if (!name || !state || /\bof\b|\bVICE\b|\bCHAIR\b/.test(name)) {
        throw new Error(`GovInfo compact roster has an invalid or mixed-format member: ${name}`)
      }
      const sourceRole = match[4] ?? leadingRole
      let role: string | undefined
      if (sourceRole) {
        role = "chair"
      }
      if (sourceRole?.includes("VICE")) {
        role = "vice-chair"
      }
      if (sourceRole?.includes("RANKING")) {
        role = "ranking-member"
      }
      return {
        chamber,
        name,
        state,
        ...(match[3] ? { district: /^\d+$/.test(match[3]) ? String(Number(match[3])) : "0" } : {}),
        ...(role ? { role } : {})
      }
    })
    const expected = [...line.matchAll(/\((?!PH\))[A-Z]{2}(?:-[A-Z0-9]{1,2})?\)/g)].length
    if (members.length !== expected) {
      throw new Error(`GovInfo compact roster ${heading} completeness mismatch`)
    }
    records.push({
      chamber,
      classification: isSubcommittee ? "subcommittee" : "committee",
      name: heading,
      members,
      ...(isSubcommittee ? { parentName } : {})
    })
  }
  if (records.filter((record) => record.classification === "committee").length < 10) {
    throw new Error(`GovInfo compact ${chamber} roster failed its completeness threshold`)
  }
  const expectedSourceMembers = [...source.matchAll(/\((?!ph\))[a-z]{2}(?:-[a-z0-9]{1,2})?\)/gi)].length
  if (records.reduce((count, record) => count + record.members.length, 0) !== expectedSourceMembers) {
    throw new Error(`GovInfo compact ${chamber} source annotation completeness mismatch`)
  }
  return records
}

function precedingHeading(lines: readonly string[], index: number): string | undefined {
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const value = lines[previous]
    if (value?.startsWith("SUBCOMMITTEES\n")) {
      return value.slice("SUBCOMMITTEES\n".length).replaceAll(/\s+/g, " ").trim()
    }
    if (
      !value ||
      /^\d+$/.test(value) ||
      /^Room\b|^https?:|^Meets\b|^The Committee meets\b|^\[|^[SH]—|^COMMITTEE STAFF|^SUBCOMMITTEES|^SELECT AND SPECIAL|^OF THE\b/.test(
        value
      )
    ) {
      continue
    }
    if (/\(ph\)|\(f\)/.test(value)) {
      continue
    }
    if (/\([A-Z]{2}(?:-[A-Z0-9]{1,2})?\)|Staff|Office Building|The Committee|Director|Secretary/.test(value)) {
      return undefined
    }
    return value.replaceAll(/\s+/g, " ")
  }
  throw new Error("GovInfo compact member roster has no heading")
}
