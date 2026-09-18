import { z } from "zod"
import { type ReplicationConnection } from "./passage-search-replication.js"

const bucketSchema = z.object({
  bucket: z.number().int().nonnegative(),
  checksum: z
    .string()
    .regex(/^-?\d+$/)
    .nullable(),
  documents: z.string().regex(/^\d+$/),
  rows: z.string().regex(/^\d+$/)
})

export type PassageCorpusBucket = z.infer<typeof bucketSchema>

export type PassageCorpusSide = {
  buckets: PassageCorpusBucket[]
  documents: number
  rows: number
}

export type PassageCorpusParity = {
  jurisdictionId: string
  jurisdictionName: string
  mismatchedBuckets: number[]
  source: PassageCorpusSide
  target: PassageCorpusSide
  matches: boolean
}

const bucketExpression = (documentId: string) =>
  `mod(mod(hashtextextended(${documentId},17),$2::integer)+$2::integer,$2::integer)::integer`

const checksumExpression = (title: string) => `bit_xor(hashtextextended(concat_ws(chr(31),
  id,document_id,content_hash,coalesce(heading,''),coalesce(page_start::text,''),
  coalesce(page_end::text,''),${title}),31))::text`

const sourceBucketsSql = `with state_documents as materialized (
  select d.id,d.title
  from legislation.bill_documents d
  join legislation.bills b on b.id=d.bill_id
  where b.jurisdiction_id=$1 and d.processing_status='processed'
), corpus as (
  select s.id,s.document_id,s.content_hash,s.heading,s.page_start,s.page_end,
    coalesce(d.title,'') search_document_title,
    ${bucketExpression("s.document_id")} bucket
  from legislation.document_sections s
  join state_documents d on d.id=s.document_id
) select bucket,count(*)::text rows,count(distinct document_id)::text documents,
  ${checksumExpression("search_document_title")} checksum
from corpus group by bucket order by bucket`

const targetBucketsSql = `with corpus as (
  select id,document_id,content_hash,heading,page_start,page_end,search_document_title,
    ${bucketExpression("document_id")} bucket
  from legislation.document_sections
  where id @@@ pdb.parse(
    'search_metadata.jurisdictionIds:' || to_json($1::text)::text,
    lenient => false,
    conjunction_mode => true
  )::pdb.const(0)
) select bucket,count(*)::text rows,count(distinct document_id)::text documents,
  ${checksumExpression("search_document_title")} checksum
from corpus group by bucket order by bucket`

function summarize(buckets: PassageCorpusBucket[]): PassageCorpusSide {
  return {
    buckets,
    documents: buckets.reduce((sum, bucket) => sum + Number(bucket.documents), 0),
    rows: buckets.reduce((sum, bucket) => sum + Number(bucket.rows), 0)
  }
}

export function comparePassageCorpusBuckets(
  jurisdictionId: string,
  jurisdictionName: string,
  sourceRows: unknown[],
  targetRows: unknown[]
): PassageCorpusParity {
  const sourceBuckets = z.array(bucketSchema).parse(sourceRows)
  const targetBuckets = z.array(bucketSchema).parse(targetRows)
  const sourceByBucket = new Map(sourceBuckets.map((bucket) => [bucket.bucket, bucket]))
  const targetByBucket = new Map(targetBuckets.map((bucket) => [bucket.bucket, bucket]))
  const bucketIds = [...new Set([...sourceByBucket.keys(), ...targetByBucket.keys()])].sort((a, b) => a - b)
  const mismatchedBuckets = bucketIds.filter((bucketId) => {
    const source = sourceByBucket.get(bucketId)
    const target = targetByBucket.get(bucketId)
    return (
      source === undefined ||
      target === undefined ||
      source.rows !== target.rows ||
      source.documents !== target.documents ||
      source.checksum !== target.checksum
    )
  })
  return {
    jurisdictionId,
    jurisdictionName,
    mismatchedBuckets,
    source: summarize(sourceBuckets),
    target: summarize(targetBuckets),
    matches: mismatchedBuckets.length === 0
  }
}

/**
 * Compares every eligible passage for one jurisdiction. Buckets are based on
 * document IDs, so document totals remain additive while a 64-bit checksum
 * detects stale IDs, content hashes, headings, pages, or titles within a bucket.
 */
export async function inspectPassageCorpusParity(
  source: ReplicationConnection,
  target: ReplicationConnection,
  jurisdictionName: string,
  bucketCount = 256
): Promise<PassageCorpusParity> {
  if (source === target || !Number.isSafeInteger(bucketCount) || bucketCount < 16 || bucketCount > 4096) {
    throw new Error("Invalid passage corpus parity request")
  }
  const jurisdiction = z
    .object({ id: z.string().min(1), name: z.string().min(1) })
    .parse(
      (
        await source.query(
          "select id,name from legislation.jurisdictions where lower(name)=lower($1) order by id limit 1",
          [jurisdictionName]
        )
      ).rows[0]
    )
  await source.query("begin isolation level repeatable read read only")
  await target.query("begin isolation level repeatable read read only")
  try {
    await source.query("set local statement_timeout='5min'")
    await target.query("set local statement_timeout='5min'")
    const [sourceResult, targetResult] = await Promise.all([
      source.query(sourceBucketsSql, [jurisdiction.id, bucketCount]),
      target.query(targetBucketsSql, [jurisdiction.id, bucketCount])
    ])
    return comparePassageCorpusBuckets(jurisdiction.id, jurisdiction.name, sourceResult.rows, targetResult.rows)
  } finally {
    await Promise.allSettled([source.query("rollback"), target.query("rollback")])
  }
}
