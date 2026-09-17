import type { PoolClient } from "pg"
import { z } from "zod"
import { parseActionProvenanceSessionScope, planActionProvenance } from "../../persistence/action-provenance.js"
import { decodeArchiveRecords } from "../archive.js"
import { normalizeOpenStatesBill } from "./normalize.js"

const batchLimit = z.number().int().min(1).max(50)

type ActionEvidence = {
  actionDate: string | null
  classification: string[]
  description: string
  id: string
  ordinal: number
  sourceUrl: string | null
}

type StoredAction = ActionEvidence & { billId: string }

export interface BillActionEvidence {
  actions: ActionEvidence[]
  billId: string
}

/** Normalize one immutable session archive and reject duplicate/out-of-scope bill identities. */
export function prepareActionProvenanceEvidence(content: Uint8Array, input: { state: string; session: string }) {
  const scope = parseActionProvenanceSessionScope(input)
  const evidence = decodeArchiveRecords(content).map((record) => {
    const aggregate = normalizeOpenStatesBill(record, {
      jurisdictionCode: scope.state,
      jurisdictionName: scope.jurisdictionName
    }).aggregate
    if (!aggregate.bill.id.startsWith(`bill:${scope.state}:${scope.session}:`)) {
      throw new Error("Retained archive contains a bill outside the requested state and session")
    }
    return {
      billId: aggregate.bill.id,
      actions: (aggregate.actions ?? []).map((action) => ({
        actionDate: action.actionDate ?? null,
        classification: action.classification ?? [],
        description: action.description,
        id: action.id,
        ordinal: action.ordinal,
        sourceUrl: action.sourceUrl ?? null
      }))
    } satisfies BillActionEvidence
  })
  evidence.sort((left, right) => left.billId.localeCompare(right.billId))
  if (evidence.length === 0 || new Set(evidence.map((bill) => bill.billId)).size !== evidence.length) {
    throw new Error("Retained archive has no bills or duplicate bill identities")
  }
  return evidence
}

export function selectActionProvenanceBatch(
  evidence: readonly BillActionEvidence[],
  input: { afterBillId?: string; limit?: number }
) {
  const limit = batchLimit.parse(input.limit ?? 50)
  if (input.afterBillId !== undefined && !evidence.some((bill) => bill.billId === input.afterBillId)) {
    throw new Error("Action provenance cursor is not present in the immutable archive")
  }
  const pending = evidence.filter((bill) => input.afterBillId === undefined || bill.billId > input.afterBillId)
  const selected = pending.slice(0, limit)
  return {
    selected,
    complete: selected.length === pending.length,
    nextAfterBillId: selected.at(-1)?.billId ?? input.afterBillId ?? null,
    remaining: Math.max(0, pending.length - selected.length),
    total: evidence.length
  }
}

/** Fill only null URLs for exact timelines; changed or absent timelines are reported and left untouched. */
export async function reconcileActionProvenanceBatch(
  client: PoolClient,
  evidence: readonly BillActionEvidence[],
  input: { afterBillId?: string; apply: boolean; limit?: number }
) {
  const batch = selectActionProvenanceBatch(evidence, input)
  await client.query(input.apply ? "begin" : "begin read only")
  try {
    await client.query("set local statement_timeout='30s'")
    await client.query("set local lock_timeout='3s'")
    const selectedIds = batch.selected.map((bill) => bill.billId)
    const parentRows = await client.query<{ id: string }>(
      `select id from legislation.bills where id=any($1::text[]) order by id ${input.apply ? "for update" : ""}`,
      [selectedIds]
    )
    const parentIds = new Set(parentRows.rows.map((row) => row.id))
    const storedRows = await client.query<StoredAction>(
      `select bill_id as "billId",id,ordinal,description,classification,action_date::text as "actionDate",source_url as "sourceUrl"
       from legislation.bill_actions where bill_id=any($1::text[]) order by bill_id,ordinal ${input.apply ? "for update" : ""}`,
      [selectedIds]
    )
    const actionsByBill = new Map<string, StoredAction[]>()
    for (const action of storedRows.rows) {
      const actions = actionsByBill.get(action.billId) ?? []
      actions.push(action)
      actionsByBill.set(action.billId, actions)
    }
    const results = []
    let updateCount = 0
    const plannedUpdates: Array<{ billId: string; id: string; sourceUrl: string }> = []
    for (const source of batch.selected) {
      if (!parentIds.has(source.billId)) {
        results.push({ billId: source.billId, status: "held" as const, reason: "canonical_bill_missing" })
        continue
      }
      const stored = actionsByBill.get(source.billId) ?? []
      let updates: ReturnType<typeof planActionProvenance>
      try {
        updates = planActionProvenance(source.actions, stored)
      } catch (error) {
        results.push({
          billId: source.billId,
          status: "held" as const,
          reason: error instanceof Error ? error.message : "unknown_timeline_mismatch"
        })
        continue
      }
      plannedUpdates.push(...updates.map((update) => ({ ...update, billId: source.billId })))
      updateCount += updates.length
      results.push({
        billId: source.billId,
        status: "matched" as const,
        actions: stored.length,
        updates: updates.length
      })
    }
    if (input.apply && plannedUpdates.length > 0) {
      if (new Set(plannedUpdates.map((update) => update.id)).size !== plannedUpdates.length) {
        throw new Error("Action repair plan contains duplicate identities")
      }
      const changed = await client.query(
        `update legislation.bill_actions as action set source_url=repair.source_url
         from unnest($1::text[],$2::text[],$3::text[]) as repair(id,bill_id,source_url)
         where action.id=repair.id and action.bill_id=repair.bill_id and action.source_url is null returning action.id`,
        [
          plannedUpdates.map((update) => update.id),
          plannedUpdates.map((update) => update.billId),
          plannedUpdates.map((update) => update.sourceUrl)
        ]
      )
      if (changed.rowCount !== plannedUpdates.length) throw new Error("Action changed during reconciliation")
    }
    await client.query(input.apply ? "commit" : "rollback")
    return {
      ...batch,
      applied: input.apply,
      matched: results.filter((result) => result.status === "matched").length,
      held: results.filter((result) => result.status === "held").length,
      updates: updateCount,
      results
    }
  } catch (error) {
    await client.query("rollback")
    throw error
  }
}
