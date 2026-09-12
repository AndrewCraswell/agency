import { z } from "zod"
import { replicatePassageDocuments, type ReplicationConnection } from "./passage-search-replication.js"

const eventSchema = z.object({
  id: z.string().regex(/^\d+$/),
  entity_kind: z.enum(["document", "bill"]),
  entity_id: z.string(),
  after_document_id: z.string().nullable()
})

export async function countReadyPassageChanges(source: ReplicationConnection) {
  const response = await queueQuery(
    source,
    `select count(*)::integer count from (
    select id from legislation.passage_search_changes where retry_at<=statement_timestamp() limit 500
  ) pending`
  )
  return z.object({ count: z.number().int().nonnegative() }).parse(response.rows[0]).count
}

async function queueQuery(source: ReplicationConnection, text: string, values?: unknown[]) {
  await source.query("begin")
  try {
    await source.query("set local statement_timeout='15s'")
    await source.query("set local lock_timeout='1s'")
    const result = await source.query(text, values)
    await source.query("commit")
    return result
  } catch (error) {
    await source.query("rollback")
    throw error
  }
}

/**
 * Source queue locks are short-lived; no source write transaction spans network
 * copy. Duplicate consumers are safe because replacement locks live on target.
 */
export async function drainPassageChanges(
  source: ReplicationConnection,
  target: ReplicationConnection,
  options: { budgetMs?: number; now?: () => number } = {}
) {
  const budgetMs = options.budgetMs ?? 240_000
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1000 || budgetMs > 300_000) {
    throw new Error("Invalid passage drain budget")
  }
  const now = options.now ?? Date.now
  const deadline = now() + budgetMs
  const result = await queueQuery(
    source,
    `select id::text,entity_kind,entity_id,after_document_id
    from legislation.passage_search_changes where retry_at<=statement_timestamp() order by id limit 100`
  )
  const events = z.array(eventSchema).parse(result.rows)
  let sections = 0
  let copiedDocuments = 0
  let deferred = 0
  const documents = new Map<string, string[]>()
  const defer = async (ids: string[]) => {
    await queueQuery(
      source,
      `update legislation.passage_search_changes
      set retry_at=clock_timestamp()+interval '15 minutes',attempts=attempts+1,error_category='replication_failed'
      where id=any($1::bigint[])`,
      [ids]
    )
    deferred += ids.length
  }
  for (const event of events) {
    if (deadline - now() < 1000) {
      break
    }
    if (event.entity_kind === "document") {
      const ids = documents.get(event.entity_id) ?? []
      ids.push(event.id)
      documents.set(event.entity_id, ids)
      continue
    }
    // Lock/re-read the event inside the single expansion statement. A racing
    // worker cannot overwrite a newer cursor or resurrect an acknowledged event.
    try {
      await queueQuery(
        source,
        `with event as materialized (
      select id,entity_id,after_document_id from legislation.passage_search_changes
      where id=$1::bigint for update
    ), page as materialized (
      select d.id from event e join legislation.bill_documents d on d.bill_id=e.entity_id
      where e.after_document_id is null or d.id > e.after_document_id order by d.id limit 250
    ), inserted as (
      insert into legislation.passage_search_changes(entity_kind,entity_id)
      select 'document',id from page returning id
    ), advanced as (
      update legislation.passage_search_changes set after_document_id=(select max(id) from page)
      where id in (select id from event) and (select count(*) from page)=250 returning id
    ) delete from legislation.passage_search_changes
      where id in (select id from event) and (select count(*) from page)<250`,
        [event.id]
      )
    } catch {
      await defer([event.id])
    }
  }
  const copy = async (entries: [string, string[]][]): Promise<void> => {
    if (entries.length === 0 || deadline - now() < 1000) {
      return
    }
    let copied: { sections: number }
    try {
      copied = await replicatePassageDocuments(
        source,
        target,
        entries.map(([id]) => id),
        {
          budgetMs: Math.min(60_000, Math.floor(deadline - now())),
          now
        }
      )
    } catch {
      if (entries.length === 1) {
        await defer(entries.flatMap(([, ids]) => ids))
      } else {
        // Go directly to leaves: repeatedly spending the full timeout on
        // binary-tree ancestors can exhaust every invocation before isolating
        // the first oversized document, permanently blocking the same batch.
        for (const entry of entries) {
          await copy([entry])
        }
      }
      return
    }
    sections += copied.sections
    copiedDocuments += entries.length
    // Exact observed IDs, not <= max(id): a lower sequence may commit later.
    await queueQuery(source, "delete from legislation.passage_search_changes where id=any($1::bigint[])", [
      entries.flatMap(([, ids]) => ids)
    ])
  }
  await copy([...documents])
  return { events: events.length, documents: copiedDocuments, sections, deferred }
}

/** One short, atomic page. Capture must be installed before enumeration starts. */
export async function enqueuePassageBackfill(source: ReplicationConnection) {
  await queueQuery(
    source,
    `insert into legislation.passage_search_backfill(name) values('documents') on conflict do nothing`
  )
  const result = await queueQuery(
    source,
    `with checkpoint as materialized (
    select after_document_id from legislation.passage_search_backfill
    where name='documents' and completed_at is null for update
  ), page as materialized (
    select d.id from checkpoint c cross join legislation.bill_documents d
    where c.after_document_id is null or d.id > c.after_document_id order by d.id limit 250
  ), inserted as (
    insert into legislation.passage_search_changes(entity_kind,entity_id)
    select 'document',id from page returning id
  ) update legislation.passage_search_backfill set
    after_document_id=coalesce((select max(id) from page),after_document_id),
    completed_at=case when (select count(*) from page)<250 then clock_timestamp() end
  where name='documents' and exists(select 1 from checkpoint)
  returning (select count(*)::integer from page) enqueued`
  )
  const rows = z.array(z.object({ enqueued: z.number().int().nonnegative() })).parse(result.rows)
  return rows[0]?.enqueued ?? 0
}
