import { createHash } from "node:crypto"
import type { billDocuments } from "@repo/legislation-core/database/schema/schema"
import type { PoolClient } from "pg"
import { documentTransportUrl } from "../ingestion/documents/transport-url.js"

type Document = typeof billDocuments.$inferSelect
type AliasRow = Pick<
  Document,
  | "id"
  | "billId"
  | "classification"
  | "sourceUrl"
  | "contentHash"
  | "processingStatus"
  | "processingAttempts"
  | "text"
  | "blobPath"
  | "ocrStatus"
  | "ocrProvider"
  | "ocrCompletedAt"
  | "ocrPageCount"
>

/** Provisional candidates: application still requires fresh bytes and locked revalidation. */
export function planUntouchedDocumentAliases(rows: readonly AliasRow[]) {
  const groups = new Map<string, AliasRow[]>()
  for (const row of rows) {
    const url = URL.parse(row.sourceUrl)
    if (!url || !["http:", "https:"].includes(url.protocol)) continue
    const key = JSON.stringify([row.billId, row.classification, documentTransportUrl(url).href])
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  const candidates: { billId: string; keepId: string; removeId: string; sourceUrl: string }[] = []
  const held: string[][] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const keep = group.find((row) => row.processingStatus === "processed")
    const remove = group.find((row) => row.processingStatus === "pending")
    try {
      if (group.length !== 2 || !keep || !remove) throw new Error("Ambiguous or processed copies")
      assertUntouchedDocumentAlias(keep, remove, keep.contentHash ?? "")
      candidates.push({ billId: keep.billId, keepId: keep.id, removeId: remove.id, sourceUrl: keep.sourceUrl })
    } catch {
      held.push(group.map((row) => row.id).sort())
    }
  }
  return { candidates: candidates.sort((a, b) => a.removeId.localeCompare(b.removeId)), held }
}

/** Only an untouched pending alias may be removed; a fresh byte hash proves current content equivalence. */
export function assertUntouchedDocumentAlias(keep: AliasRow, remove: AliasRow, downloadedHash: string) {
  if (
    keep.id === remove.id ||
    keep.billId !== remove.billId ||
    keep.classification !== remove.classification ||
    keep.sourceUrl === remove.sourceUrl ||
    documentTransportUrl(keep.sourceUrl).href !== documentTransportUrl(remove.sourceUrl).href
  ) {
    throw new Error("Documents are not distinct transport aliases within the same bill and collection")
  }
  if (
    keep.processingStatus !== "processed" ||
    !/^[a-f0-9]{64}$/.test(downloadedHash) ||
    keep.contentHash !== downloadedHash
  ) {
    throw new Error("Fresh source bytes do not prove equivalence to the processed document")
  }
  if (
    remove.processingStatus !== "pending" ||
    remove.processingAttempts !== 0 ||
    remove.contentHash !== null ||
    remove.text !== null ||
    remove.blobPath !== null ||
    ![null, "pending"].includes(remove.ocrStatus) ||
    remove.ocrProvider !== null ||
    remove.ocrCompletedAt !== null ||
    remove.ocrPageCount !== null
  ) {
    throw new Error("Duplicate has processing evidence and cannot be removed as an untouched alias")
  }
}

/** Caller supplies freshly downloaded bytes; this transaction rechecks state under the ordinary parent lock. */
export async function reconcileUntouchedDocumentAlias(
  client: PoolClient,
  input: {
    billId: string
    keepId: string
    removeId: string
    sourceUrl: string
    bytes: Uint8Array
    apply: boolean
  }
) {
  const hash = createHash("sha256").update(input.bytes).digest("hex")
  const stream = `untouched-document-alias:${input.removeId}`
  await client.query(input.apply ? "begin" : "begin read only")
  try {
    await client.query("set local statement_timeout='15s'")
    await client.query("set local lock_timeout='3s'")
    const parent = await client.query(
      `select id from legislation.bills where id=$1 ${input.apply ? "for update" : ""}`,
      [input.billId]
    )
    if (parent.rowCount !== 1) throw new Error("Canonical parent is missing")
    const rows = await client.query<AliasRow & { snapshot: unknown }>(
      `select id,bill_id as "billId",classification,source_url as "sourceUrl",content_hash as "contentHash",
       processing_status as "processingStatus",processing_attempts as "processingAttempts",text,blob_path as "blobPath",
       ocr_status as "ocrStatus",ocr_provider as "ocrProvider",ocr_completed_at as "ocrCompletedAt",ocr_page_count as "ocrPageCount",
       to_jsonb(d) snapshot from legislation.bill_documents d where bill_id=$1 and id=any($2::text[]) order by id ${input.apply ? "for update" : ""}`,
      [input.billId, [input.keepId, input.removeId]]
    )
    const keep = rows.rows.find((row) => row.id === input.keepId)
    const remove = rows.rows.find((row) => row.id === input.removeId)
    if (
      !keep ||
      documentTransportUrl(input.sourceUrl).href !== documentTransportUrl(keep.sourceUrl).href ||
      keep.contentHash !== hash
    ) {
      throw new Error("Retained target no longer matches the downloaded source")
    }
    if (!remove) {
      const receipt = await client.query(
        "select cursor from legislation.sync_checkpoints where source='document-alias-reconciliation' and stream=$1",
        [stream]
      )
      if (receipt.rows[0]?.cursor?.keepId !== input.keepId || receipt.rows[0]?.cursor?.downloadedHash !== hash)
        throw new Error("Alias disappeared without matching reconciliation evidence")
      await client.query(input.apply ? "commit" : "rollback")
      return { status: "already_reconciled" as const, keepId: keep.id, removedId: input.removeId, downloadedHash: hash }
    }
    assertUntouchedDocumentAlias(keep, remove, hash)
    // Fail closed if the schema gains another cascade/reference that this repair does not understand.
    const references = await client.query<{ name: string }>(
      "select n.nspname || '.' || c.relname name from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace where f.contype='f' and f.confrelid='legislation.bill_documents'::regclass"
    )
    if (
      references.rows.some(
        ({ name }) => !["legislation.document_sections", "legislation.amendment_section_search"].includes(name)
      )
    ) {
      throw new Error("Document has an unreviewed referencing table")
    }
    const dependents = await client.query(
      "select exists(select 1 from legislation.document_sections where document_id=$1) or exists(select 1 from legislation.amendment_section_search where document_id=$1) present",
      [remove.id]
    )
    if (dependents.rows[0]?.present !== false) throw new Error("Pending alias has dependent content")
    if (input.apply) {
      await client.query(
        "insert into legislation.sync_checkpoints(source,stream,cursor) values('document-alias-reconciliation',$1,$2::jsonb)",
        [
          stream,
          JSON.stringify({
            billId: input.billId,
            keepId: keep.id,
            removedId: remove.id,
            downloadedHash: hash,
            sourceUrl: input.sourceUrl,
            removedRow: remove.snapshot
          })
        ]
      )
      const deleted = await client.query(
        "delete from legislation.bill_documents where id=$1 and bill_id=$2 returning id",
        [remove.id, input.billId]
      )
      if (deleted.rowCount !== 1) throw new Error("Alias changed during reconciliation")
    }
    await client.query(input.apply ? "commit" : "rollback")
    return {
      status: input.apply ? ("reconciled" as const) : ("eligible" as const),
      keepId: keep.id,
      removedId: remove.id,
      downloadedHash: hash
    }
  } catch (error) {
    await client.query("rollback")
    throw error
  }
}
