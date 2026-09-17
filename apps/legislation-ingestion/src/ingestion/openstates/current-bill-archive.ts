import { legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"
import type { SourceStore } from "../source-store.js"
import { openStatesBillSchema } from "./normalize.js"

const archiveInputSchema = z.object({
  from: z.date(),
  jurisdiction: z.string().regex(/^[a-z]{2}$/),
  jurisdictionName: z.string().trim().min(1),
  page: z.number().int().positive(),
  providerEndpoint: z.url({ protocol: /^https$/ }),
  retrievedAt: z.date()
})

export type RetainedOpenStatesBillPage = Readonly<{
  contentHash: string
  records: readonly unknown[]
  session: string
  stream: string
}>

/**
 * Retain each incremental Open States bill page before it can change canonical state.
 *
 * Pages are partitioned by canonical session so a later provenance replay can reject
 * cross-session evidence without discarding an otherwise valid provider response.
 */
export async function retainOpenStatesBillPage(
  store: SourceStore,
  records: readonly unknown[],
  input: {
    from: Date
    jurisdiction: string
    jurisdictionName: string
    page: number
    providerEndpoint: string
    retrievedAt: Date
  }
): Promise<readonly RetainedOpenStatesBillPage[]> {
  const parsed = archiveInputSchema.parse(input)
  const bySession = new Map<string, unknown[]>()
  for (const record of records) {
    const bill = openStatesBillSchema.parse(record)
    const sourceSession = bill.session ?? bill.legislative_session
    if (sourceSession === undefined) {
      throw new Error("Open States bill response is missing its legislative session")
    }
    const session = legislativeSessionId(parsed.jurisdiction, sourceSession).split(":").at(-1)
    if (session === undefined) {
      throw new Error("Open States bill session could not be canonicalized")
    }
    const values = bySession.get(session) ?? []
    values.push(record)
    bySession.set(session, values)
  }

  const retained: RetainedOpenStatesBillPage[] = []
  const fromIdentity = parsed.from
    .toISOString()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
  for (const [session, sessionRecords] of [...bySession].sort(([left], [right]) => left.localeCompare(right))) {
    const stream = `api-${parsed.jurisdiction}-${session}-${fromIdentity}-${parsed.page}`
    const bytes = new TextEncoder().encode(JSON.stringify(sessionRecords))
    const stored = await store.put("openstates", stream, bytes, {
      from: parsed.from.toISOString(),
      jurisdiction: parsed.jurisdiction,
      jurisdictionName: parsed.jurisdictionName,
      page: parsed.page,
      providerEndpoint: parsed.providerEndpoint,
      records: sessionRecords.length,
      retrievedAt: parsed.retrievedAt.toISOString(),
      session
    })
    retained.push({ contentHash: stored.contentHash, records: sessionRecords, session, stream })
  }
  return retained
}
