import { z } from "zod"

/** One checked-out connection per side; never pass a pool that can switch sessions. */
export type ReplicationConnection = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>
}

const sectionSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1),
  heading: z.string().nullable(),
  text: z.string(),
  content_hash: z.string(),
  page_start: z.number().int().nullable(),
  page_end: z.number().int().nullable(),
  search_document_title: z.string(),
  search_metadata: z.record(z.string(), z.unknown())
})

const sectionPageSql = `select s.id,s.document_id,s.heading,s.text,s.content_hash,s.page_start,s.page_end,
  coalesce(d.title,'') search_document_title,
  jsonb_build_object('processingStatus',d.processing_status,
    'billIds',jsonb_build_array(b.id),'jurisdictionIds',jsonb_build_array(b.jurisdiction_id),
    'sessionIds',jsonb_build_array(b.session_id),'classifications',b.classification,
    'statuses',jsonb_build_array(b.status),'subjects',b.subjects,
    'sponsorIds',coalesce((select jsonb_agg(sp.person_id) from legislation.bill_sponsors sp where sp.bill_id=b.id),'[]'::jsonb),
    'documentClassifications',jsonb_build_array(d.classification),'versionCodes',jsonb_build_array(d.version_code),
    'introducedAt',extract(epoch from b.introduced_at::timestamptz)*1000,
    'updatedAt',extract(epoch from b.updated_at)*1000,
    'submittedAt',extract(epoch from d.document_date::timestamptz)*1000,
    'documentUpdatedAt',extract(epoch from d.updated_at)*1000) search_metadata
  from legislation.document_sections s
  join legislation.bill_documents d on d.id=s.document_id
  join legislation.bills b on b.id=d.bill_id
  where s.document_id=any($1::text[]) and ($2::text is null or s.id > $2) and d.processing_status='processed'
  order by s.id limit $3`

const insertSectionPageSql = `insert into legislation.document_sections
  (id,document_id,heading,text,content_hash,page_start,page_end,search_document_title,search_metadata)
  select id,document_id,heading,text,content_hash,page_start,page_end,search_document_title,search_metadata
  from jsonb_to_recordset($1::jsonb) as r(id text,document_id text,heading text,text text,
    content_hash text,page_start integer,page_end integer,search_document_title text,search_metadata jsonb)
  on conflict(id) do update set document_id=excluded.document_id,heading=excluded.heading,
    text=excluded.text,content_hash=excluded.content_hash,page_start=excluded.page_start,
    page_end=excluded.page_end,search_document_title=excluded.search_document_title,
    search_metadata=excluded.search_metadata`

/**
 * Atomic, replayable document replacement. Target serialization precedes source
 * snapshot acquisition, so a delayed worker cannot resurrect an older snapshot.
 * The caller acknowledges its exact queue events only after this resolves.
 */
export async function replicatePassageDocument(
  source: ReplicationConnection,
  target: ReplicationConnection,
  documentId: string,
  options: { batchSize?: number; budgetMs?: number; now?: () => number } = {}
) {
  const result = await replicatePassageDocuments(source, target, [documentId], options)
  return { documentId, sections: result.sections }
}

/** Batch refresh amortizes network round trips during the full corpus backfill. */
export async function replicatePassageDocuments(
  source: ReplicationConnection,
  target: ReplicationConnection,
  documentIds: readonly string[],
  options: { batchSize?: number; budgetMs?: number; now?: () => number } = {}
) {
  const batchSize = options.batchSize ?? 250
  const budgetMs = options.budgetMs ?? 60_000
  const now = options.now ?? Date.now
  if (
    documentIds.length === 0 ||
    documentIds.length > 100 ||
    documentIds.some((id) => id.length === 0) ||
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 1000 ||
    !Number.isSafeInteger(budgetMs) ||
    budgetMs < 1000 ||
    budgetMs > 120_000
  ) {
    throw new Error("Invalid passage replication request")
  }
  const deadline = now() + budgetMs
  let hasSourceTransaction = false
  let hasTargetTransaction = false
  let copied = 0
  let after: string | null = null
  const remaining = () => {
    const milliseconds = Math.floor(deadline - now())
    if (milliseconds < 1) {
      throw new Error("Passage document replication exceeded its time budget")
    }
    return Math.min(milliseconds, 15_000)
  }
  const setDeadline = async (connection: ReplicationConnection) => {
    await connection.query("select set_config('statement_timeout',$1,true)", [String(remaining())])
  }
  try {
    await target.query("begin")
    hasTargetTransaction = true
    await setDeadline(target)
    await target.query("set local lock_timeout='1s'")
    // One publisher also orders cross-document section moves. Per-document
    // locks alone allow an old owner's snapshot to overwrite the new owner.
    await target.query("select pg_advisory_xact_lock(hashtextextended('legislation-passage-search-replication',0))")
    await source.query("begin isolation level repeatable read read only")
    hasSourceTransaction = true
    await source.query("set local lock_timeout='1s'")
    await setDeadline(target)
    await target.query("delete from legislation.document_sections where document_id=any($1::text[])", [documentIds])
    for (;;) {
      await setDeadline(source)
      const response = await source.query(sectionPageSql, [documentIds, after, batchSize])
      const rows = z.array(sectionSchema).max(batchSize).parse(response.rows)
      if (rows.some((row) => !documentIds.includes(row.document_id))) {
        throw new Error("Passage replication returned another document")
      }
      if (rows.length > 0) {
        const lastId = rows.at(-1)?.id
        if (lastId === undefined || lastId === after) {
          throw new Error("Passage replication cursor did not advance")
        }
        await setDeadline(target)
        await target.query(insertSectionPageSql, [JSON.stringify(rows)])
        copied += rows.length
        after = lastId
      }
      if (rows.length < batchSize) {
        break
      }
    }
    await setDeadline(source)
    await source.query("commit")
    hasSourceTransaction = false
    await setDeadline(target)
    await target.query("commit")
    hasTargetTransaction = false
    return { sections: copied }
  } finally {
    // Attempt both rollbacks even if one connection has failed. A failed/unknown
    // COMMIT is not an acknowledgement; retry reads canonical state again.
    try {
      if (hasSourceTransaction) {
        await source.query("rollback")
      }
    } finally {
      if (hasTargetTransaction) {
        await target.query("rollback")
      }
    }
  }
}
