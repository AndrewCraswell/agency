import { createHash } from "node:crypto"
import { XMLParser, XMLValidator } from "fast-xml-parser"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"

const bienniumSchema = z
  .string()
  .regex(/^20[0-9]{2}-[0-9]{2}$/)
  .refine(
    (value) => Number(value.slice(0, 4)) % 2 === 1 && (Number(value.slice(0, 4)) + 1) % 100 === Number(value.slice(5))
  )
const committeeSchema = z.object({
  Id: z.string().regex(/^-?[1-9][0-9]*$/),
  Agency: z.enum(["House", "Senate", "Joint"]),
  Acronym: z.string().regex(/^[A-Z0-9&]+$/)
})
const digest = (text: string) => createHash("sha256").update(text).digest("hex")
export function washingtonCommitteeInventoryUrl(biennium: string) {
  return `https://wslwebservices.leg.wa.gov/CommitteeService.asmx/GetCommittees?biennium=${bienniumSchema.parse(biennium)}`
}

/** Numeric publisher identities are scoped to the source biennium, never inferred from names. */
export function parseWashingtonCommitteeInventory(xml: string, biennium: string) {
  const sourceUrl = washingtonCommitteeInventoryUrl(biennium)
  if (
    Buffer.byteLength(xml) > 2 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new Error("Unsafe Washington committee inventory")
  const parsed: unknown = new XMLParser({ parseTagValue: false, isArray: (name) => name === "Committee" }).parse(xml)
  const rows = z
    .object({ ArrayOfCommittee: z.object({ Committee: z.array(committeeSchema).min(1).max(500) }) })
    .parse(parsed).ArrayOfCommittee.Committee
  const entries = rows.map((row) => ({
    identifier: `waCommitteeId:${biennium}:${row.Agency.toLowerCase()}:${row.Id}`,
    reference: `waCommittee:${row.Agency.toLowerCase()}:${row.Acronym}`,
    sourceUrl
  }))
  if (
    new Set(entries.map((entry) => entry.identifier)).size !== entries.length ||
    new Set(entries.map((entry) => entry.reference)).size !== entries.length
  )
    throw new Error("Ambiguous Washington committee inventory")
  return { biennium, sha256: digest(xml), sourceUrl, entries }
}

export async function retainWashingtonCommitteeInventory(store: ArtifactStore, xml: string, biennium: string) {
  const inventory = parseWashingtonCommitteeInventory(xml, biennium)
  const path = `openstates/committee-inventories/wa/${biennium}/${inventory.sha256}.xml`
  await store.put(path, Buffer.from(xml))
  if (digest(Buffer.from(await store.read(path)).toString("utf8")) !== inventory.sha256)
    throw new Error("Retained committee inventory checksum mismatch")
  return { path, inventory }
}

export async function readWashingtonCommitteeInventory(store: Pick<ArtifactStore, "read">, path: string) {
  const match = /^openstates\/committee-inventories\/wa\/(20[0-9]{2}-[0-9]{2})\/([a-f0-9]{64})\.xml$/.exec(path)
  if (!match?.[1]) throw new Error("Invalid committee inventory path")
  const inventory = parseWashingtonCommitteeInventory(Buffer.from(await store.read(path)).toString("utf8"), match[1])
  if (inventory.sha256 !== match[2]) throw new Error("Retained committee inventory checksum mismatch")
  return inventory
}

/** Enrich only unique, already accepted source identities; never create organizations or overwrite conflicts. */
export function bindCommitteeInventory<T extends { id: string; upstreamIds?: Record<string, unknown> | null }>(
  organizations: readonly T[],
  entries: readonly { identifier: string; reference: string; sourceUrl: string }[]
) {
  const additions = new Map<string, Record<string, string>>()
  for (const entry of entries) {
    const matches = organizations.filter((organization) =>
      Object.hasOwn(organization.upstreamIds ?? {}, entry.reference)
    )
    const owners = organizations.filter((organization) =>
      Object.hasOwn(organization.upstreamIds ?? {}, entry.identifier)
    )
    if (matches.length !== 1 || owners.some((owner) => owner.id !== matches[0]?.id))
      throw new Error(`Committee inventory identity is missing or ambiguous: ${entry.reference}`)
    const match = matches[0]!
    const identifiers = additions.get(match.id) ?? {}
    identifiers[entry.identifier] = entry.sourceUrl
    additions.set(match.id, identifiers)
  }
  return organizations.map((organization) => ({
    ...organization,
    upstreamIds: { ...organization.upstreamIds, ...additions.get(organization.id) }
  }))
}
