import { z } from "zod"
import {
  projectEntityResult,
  ResultExpiredError,
  type EntityPage,
  type EntityCard,
  type EntityKind
} from "./entityResults"
import { entityCardSchema, entityKindSchema } from "./entityResults"
import { resultPersistence } from "./resultPersistence.server"

export const retainedResultSchema = z.object({
  sessionKey: z.uuid(),
  toolName: z.string(),
  kind: entityKindSchema,
  presentation: z.enum(["card", "list"]),
  items: z.array(entityCardSchema).max(1000),
  warnings: z.array(z.string()),
  nextCursor: z.string().optional(),
  query: z.string().optional(),
  expiresAt: z.number(),
  pageStarts: z.array(z.number().int().nonnegative()),
  pageEnds: z.array(z.number().int().nonnegative()),
  input: z.record(z.string(), z.unknown()).optional()
})
export type RetainedResult = z.infer<typeof retainedResultSchema>
export type ResultPersistence = {
  save: (id: string, value: RetainedResult) => Promise<void>
  read: (sessionKey: string, id: string) => Promise<unknown>
  load: (tool: string, input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>
}

type Snapshot = {
  sessionKey: string
  toolName: string
  kind: EntityKind
  presentation: EntityPage["presentation"]
  items: EntityCard[]
  warnings: string[]
  nextCursor?: string
  query?: string
  expiresAt: number
  pending?: Promise<void>
  load: (cursor: string, signal: AbortSignal) => Promise<unknown>
  pageStarts: number[]
  pageEnds: number[]
  input?: Record<string, unknown>
}

export function createResultStore(now = Date.now, persistence?: ResultPersistence) {
  const snapshots = new Map<string, Snapshot>()
  async function persist(id: string) {
    const snapshot = snapshots.get(id)
    if (persistence && snapshot) {
      await persistence.save(id, retainedResultSchema.parse(snapshot))
    }
  }
  async function recover(sessionKey: string, id: string) {
    prune()
    if (snapshots.has(id)) {
      return
    }
    if (!persistence) {
      throw new ResultExpiredError()
    }
    const saved = retainedResultSchema.safeParse(await persistence.read(sessionKey, id))
    if (!saved.success || saved.data.sessionKey !== sessionKey || saved.data.expiresAt <= now()) {
      throw new ResultExpiredError()
    }
    const snapshot = saved.data
    snapshots.set(id, {
      ...snapshot,
      load: async (cursor, signal) => {
        if (!snapshot.input) {
          throw new ResultExpiredError()
        }
        return await persistence.load(snapshot.toolName, { ...snapshot.input, cursor }, signal)
      }
    })
  }
  function prune() {
    for (const [id, snapshot] of snapshots) {
      if (snapshot.expiresAt <= now()) {
        snapshots.delete(id)
      }
    }
  }
  function render(id: string, snapshot: Snapshot, page: number): EntityPage {
    const offset = snapshot.pageStarts[page] ?? 0
    const end = snapshot.pageEnds[page] ?? offset
    const items = snapshot.items.slice(offset, end)
    return {
      id,
      kind: snapshot.kind,
      presentation: snapshot.presentation,
      page,
      items,
      start: items.length ? offset + 1 : 0,
      end: offset + items.length,
      hasPrevious: page > 0,
      hasNext: end < snapshot.items.length || snapshot.nextCursor !== undefined,
      warnings: snapshot.warnings,
      query: snapshot.query
    }
  }
  function create(
    sessionKey: string,
    toolName: string,
    data: unknown,
    query: string | undefined,
    load: Snapshot["load"],
    input?: Record<string, unknown>
  ) {
    prune()
    const result = projectEntityResult(toolName, data)
    if (!result) {
      return undefined
    }
    if (snapshots.size >= 256) {
      snapshots.delete(snapshots.keys().next().value ?? "")
    }
    const id = crypto.randomUUID()
    const snapshot: Snapshot = {
      sessionKey,
      toolName,
      ...result,
      query,
      load,
      input,
      pageStarts: [0],
      pageEnds: [Math.min(result.items.length, 5)],
      expiresAt: now() + (persistence ? 24 * 60 : 15) * 60 * 1000
    }
    snapshots.set(id, snapshot)
    return render(id, snapshot, 0)
  }
  async function page(sessionKey: string, id: string, page: number, signal: AbortSignal) {
    signal.throwIfAborted()
    prune()
    if (!snapshots.has(id)) {
      await recover(sessionKey, id)
    }
    const snapshot = snapshots.get(id)
    if (!snapshot || snapshot.sessionKey !== sessionKey) {
      throw new ResultExpiredError()
    }
    if (!Number.isInteger(page) || page < 0 || page > snapshot.pageStarts.length) {
      throw new Error("Invalid result page")
    }
    if (snapshot.pageEnds[page] !== undefined) {
      return render(id, snapshot, page)
    }
    const offset = snapshot.pageEnds[page - 1] ?? 0
    const visitedCursors = new Set<string>()
    while (offset + 5 > snapshot.items.length && snapshot.nextCursor) {
      if (visitedCursors.has(snapshot.nextCursor) || visitedCursors.size >= 5) {
        throw new Error("Result pagination did not advance")
      }
      visitedCursors.add(snapshot.nextCursor)
      if (!snapshot.pending) {
        const cursor = snapshot.nextCursor
        snapshot.pending = (async () => {
          signal.throwIfAborted()
          const data = await snapshot.load(cursor, signal)
          signal.throwIfAborted()
          const next = projectEntityResult(snapshot.toolName, data)
          if (!next || next.nextCursor === cursor || (next.items.length === 0 && next.nextCursor)) {
            throw new Error("Unreadable result page")
          }
          if (snapshot.items.length + next.items.length > 1000) {
            throw new Error("Result limit reached")
          }
          snapshot.items.push(...next.items)
          snapshot.nextCursor = next.nextCursor
          snapshot.warnings = [...new Set([...snapshot.warnings, ...next.warnings])]
        })().finally(() => {
          snapshot.pending = undefined
        })
      }
      await snapshot.pending
    }
    if (offset >= snapshot.items.length && page > 0) {
      return render(id, snapshot, page - 1)
    }
    snapshot.pageStarts[page] = offset
    snapshot.pageEnds[page] = Math.min(offset + 5, snapshot.items.length)
    await persist(id)
    return render(id, snapshot, page)
  }
  function record(sessionKey: string, id: string, recordId: string) {
    prune()
    const snapshot = snapshots.get(id)
    if (!snapshot || snapshot.sessionKey !== sessionKey) {
      throw new ResultExpiredError()
    }
    const item = snapshot.items.find((candidate) => candidate.id === recordId)
    if (!item) {
      throw new Error("Record is not in this result")
    }
    return structuredClone(item)
  }
  function references(sessionKey: string, requested: readonly { resultId: string; recordId: string }[]) {
    const seen = new Set<string>()
    return requested
      .map((reference) => record(sessionKey, reference.resultId, reference.recordId))
      .filter((item) => {
        const key = `${item.kind}:${item.id}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
      .map((item) => ({ id: item.id, kind: item.kind, title: item.title }))
  }
  return { create, page, record, references, persist, recover }
}

export const resultStore = createResultStore(Date.now, resultPersistence)
