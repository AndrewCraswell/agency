import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { parseDocument } from "yaml"
import { z } from "zod"
import type { PeopleRepositoryFile } from "./people-repository.js"
import reviewedRoles from "./review-data/people-roles.json" with { type: "json" }

const role = z.strictObject({
  type: z.enum(["upper", "lower"]),
  jurisdiction: z.string().min(1),
  district: z.string().min(1),
  start_date: z.iso.date(),
  end_date: z.iso.date().optional()
})
const review = z.strictObject({
  state: z.string().regex(/^[a-z]{2}$/),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  path: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  personId: z.string().startsWith("ocd-person/"),
  changes: z
    .array(
      z.strictObject({
        before: role,
        after: role.nullable(),
        evidenceUrls: z.array(z.url()).min(1),
        reason: z.string().min(1)
      })
    )
    .min(1)
})

/** Scope refresh invalidation to the reviewed jurisdiction and immutable upstream revision. */
export function peopleRoleReviewDigest(state: string, revision: string, data: unknown = reviewedRoles) {
  const selected = z
    .array(review)
    .parse(data)
    .filter((entry) => entry.state === state && entry.revision === revision)
    .map((entry) => JSON.stringify(entry))
    .sort()
  return createHash("sha256").update(JSON.stringify(selected)).digest("hex")
}

/** Trusted reviewed data only; no names, date guesses, or source-supplied overrides. */
export function applyReviewedPeopleRoles(
  file: PeopleRepositoryFile,
  state: string,
  revision: string,
  data: unknown = reviewedRoles
) {
  const matches = z
    .array(review)
    .parse(data)
    .filter((entry) => entry.state === state && entry.revision === revision && entry.path === file.path)
  if (matches.length === 0) return { file, review: null }
  if (matches.length !== 1) throw new Error("Duplicate people role review")
  const selected = matches[0]!
  if (createHash("sha256").update(file.content).digest("hex") !== selected.sourceSha256) {
    throw new Error("People role review source fingerprint mismatch")
  }
  const document = parseDocument(file.content, { uniqueKeys: true })
  if (document.errors.length) throw new Error("Invalid reviewed people YAML")
  const person = z
    .looseObject({ id: z.string(), roles: z.array(z.unknown()) })
    .parse(document.toJS({ maxAliasCount: 0 }))
  if (person.id !== selected.personId) throw new Error("People role review identity mismatch")
  const replacements = new Map<number, z.infer<typeof role> | null>()
  for (const change of selected.changes) {
    const indexes = person.roles.flatMap((value, index) => (isDeepStrictEqual(value, change.before) ? [index] : []))
    if (indexes.length !== 1 || replacements.has(indexes[0]!)) throw new Error("People role review target is ambiguous")
    if (
      change.before.jurisdiction !== `ocd-jurisdiction/country:us/state:${state}/government` ||
      (change.after && change.after.jurisdiction !== change.before.jurisdiction)
    ) {
      throw new Error("People role review jurisdiction mismatch")
    }
    if (change.after?.end_date && change.after.end_date < change.after.start_date) {
      throw new Error("People role review reverses service dates")
    }
    replacements.set(indexes[0]!, change.after)
  }
  const roles = person.roles.flatMap((value, index) => {
    if (!replacements.has(index)) return [value]
    const replacement = replacements.get(index)
    return replacement === null ? [] : [replacement]
  })
  return { file: { ...file, content: JSON.stringify({ ...person, roles }) }, review: selected }
}
