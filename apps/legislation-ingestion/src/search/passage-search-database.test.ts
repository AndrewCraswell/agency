import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { drainPassageChanges, enqueuePassageBackfill } from "./passage-search-queue.js"
import { replicatePassageDocuments } from "./passage-search-replication.js"

const sourceUrl = process.env.PASSAGE_SEARCH_TEST_SOURCE_URL
const targetUrl = process.env.PASSAGE_SEARCH_DATABASE_URL
const hasDatabase = sourceUrl !== undefined && targetUrl !== undefined

describe.skipIf(!hasDatabase)("passage search database synchronization", () => {
  const source = new pg.Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10_000 })
  const target = new pg.Client({ connectionString: targetUrl, connectionTimeoutMillis: 10_000 })
  const reader = new pg.Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10_000 })
  const prefix = `passage-test:${randomUUID()}`
  const billId = `${prefix}:bill`
  const documentId = `${prefix}:document`
  const sectionId = `${prefix}:section`

  beforeAll(async () => {
    if (
      !sourceUrl ||
      !targetUrl ||
      new URL(sourceUrl).pathname !== "/legislation_passage_source_test" ||
      new URL(targetUrl).pathname !== "/legislation_passage_search"
    ) {
      throw new Error("Only isolated passage test databases are allowed")
    }
    await source.connect()
    await reader.connect()
    await target.connect()
    const identity = await source.query("select current_database() name")
    if (identity.rows[0]?.name !== "legislation_passage_source_test") {
      throw new Error("Refusing to reset a non-fixture database")
    }
    // Only this disposable fixture database is reset, never the canonical DB.
    await source.query("drop schema if exists legislation cascade")
    {
      await source.query(`create schema legislation;
        create table legislation.bills(id text primary key,jurisdiction_id text,session_id text,
          classification text[],status text,subjects text[],introduced_at date,updated_at timestamptz);
        create table legislation.bill_documents(id text primary key,bill_id text references legislation.bills on delete cascade,
          title text,processing_status text,classification text,version_code text,document_date date,updated_at timestamptz);
        create table legislation.bill_sponsors(id text primary key,bill_id text references legislation.bills on delete cascade,person_id text);
        create table legislation.document_sections(id text primary key,document_id text references legislation.bill_documents on delete cascade,
          heading text,text text,content_hash text,page_start integer,page_end integer);`)
      await source.query("begin")
      await source.query(
        await readFile(
          new URL(
            "./migrations/0047_passage_search_changes.sql",
            import.meta.resolve("@repo/legislation-core/database/migrate")
          ),
          "utf8"
        )
      )
      await source.query("commit")
    }
    await source.query("delete from legislation.passage_search_backfill where name='documents'")
    await source.query(
      `insert into legislation.bills values($1,'us','119',array['bill'],'introduced',array['Health'],'2025-01-01',now())`,
      [billId]
    )
    await source.query(
      `insert into legislation.bill_documents values($1,$2,'Health bill','processed','bill','ih','2025-01-02',now())`,
      [documentId, billId]
    )
    await source.query(
      `insert into legislation.document_sections values($1,$2,'Insurance','health insurance',repeat('a',64),1,2)`,
      [sectionId, documentId]
    )
  }, 60_000)

  afterAll(async () => {
    try {
      if (hasDatabase) {
        await source.query("delete from legislation.bills where id=$1", [billId])
        await target.query("delete from legislation.document_sections where document_id=$1", [documentId])
        await source.query("delete from legislation.passage_search_changes where entity_id=any($1::text[])", [
          [billId, documentId]
        ])
      }
    } finally {
      await Promise.allSettled([source.end(), target.end(), reader.end()])
    }
  }, 30_000)

  it("captures inserts and bill filters, and replays batches without duplicates", async () => {
    await drainPassageChanges(source, target)
    await drainPassageChanges(source, target)
    await replicatePassageDocuments(source, target, [documentId])
    const rows = await target.query(
      "select id,text,search_metadata from legislation.document_sections where document_id=$1",
      [documentId]
    )
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]).toMatchObject({
      id: sectionId,
      text: "health insurance",
      search_metadata: { sessionIds: ["119"] }
    })
  }, 60_000)

  it("captures OCR text replacement, bill metadata and sponsor changes", async () => {
    await source.query(
      "update legislation.document_sections set text='corrected insurance text',content_hash=repeat('b',64) where id=$1",
      [sectionId]
    )
    await source.query("update legislation.bills set session_id='118' where id=$1", [billId])
    await source.query("insert into legislation.bill_sponsors values($1,$2,'person-canary')", [
      `${prefix}:sponsor`,
      billId
    ])
    for (let i = 0; i < 3; i++) {
      await drainPassageChanges(source, target)
    }
    const rows = await target.query("select text,search_metadata from legislation.document_sections where id=$1", [
      sectionId
    ])
    expect(rows.rows[0]).toMatchObject({
      text: "corrected insurance text",
      search_metadata: { sessionIds: ["118"], sponsorIds: ["person-canary"] }
    })
  }, 60_000)

  it("coalesces repeated section changes in one source transaction", async () => {
    await source.query("begin")
    await source.query("update legislation.document_sections set text='first revision' where id=$1", [sectionId])
    await source.query("update legislation.document_sections set text='second revision' where id=$1", [sectionId])
    const events = await source.query("select id from legislation.passage_search_changes where entity_id=$1", [
      documentId
    ])
    expect(events.rows).toHaveLength(1)
    await source.query("commit")
    await drainPassageChanges(source, target)
  }, 60_000)

  it("refreshes a moved section before its old owner without a uniqueness failure", async () => {
    const destination = `${prefix}:destination`
    await source.query(
      "insert into legislation.bill_documents select $1,bill_id,title,processing_status,classification,version_code,document_date,updated_at from legislation.bill_documents where id=$2",
      [destination, documentId]
    )
    await source.query("update legislation.document_sections set document_id=$1 where id=$2", [destination, sectionId])
    await replicatePassageDocuments(source, target, [destination, documentId], { readers: [reader] })
    expect(
      (await target.query("select document_id from legislation.document_sections where id=$1", [sectionId])).rows[0]
        ?.document_id
    ).toBe(destination)
    await replicatePassageDocuments(source, target, [documentId])
    await source.query("update legislation.document_sections set document_id=$1 where id=$2", [documentId, sectionId])
    await drainPassageChanges(source, target)
    await source.query("delete from legislation.bill_documents where id=$1", [destination])
    await drainPassageChanges(source, target)
  }, 60_000)

  it("keeps concurrent edits out of every reader until the next atomic publication", async () => {
    const editor = new pg.Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10_000 })
    await editor.connect()
    try {
      const original = (await editor.query("select text from legislation.document_sections where id=$1", [sectionId]))
        .rows[0]?.text
      const delayedReader = {
        query: async (text: string, values?: unknown[]) => {
          const result = await reader.query(text, values)
          if (text.startsWith("set transaction snapshot")) {
            await editor.query("update legislation.document_sections set text='concurrent revision' where id=$1", [
              sectionId
            ])
          }
          return result
        }
      }
      await replicatePassageDocuments(source, target, [`${prefix}:missing`, documentId], { readers: [delayedReader] })
      expect(
        (await target.query("select text from legislation.document_sections where id=$1", [sectionId])).rows[0]?.text
      ).toBe(original)
      await replicatePassageDocuments(source, target, [`${prefix}:missing`, documentId], { readers: [reader] })
      expect(
        (await target.query("select text from legislation.document_sections where id=$1", [sectionId])).rows[0]?.text
      ).toBe("concurrent revision")
    } finally {
      await editor.end()
    }
  }, 60_000)

  it("retains late-committing low sequence events instead of skipping them", async () => {
    const late = new pg.Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10_000 })
    await late.connect()
    try {
      await late.query("begin")
      const earlier = await late.query(
        "insert into legislation.passage_search_changes(entity_kind,entity_id) values('document',$1) returning id::text",
        [documentId]
      )
      await source.query(
        "insert into legislation.passage_search_changes(entity_kind,entity_id) values('document',$1)",
        [documentId]
      )
      await drainPassageChanges(source, target)
      await late.query("commit")
      const pending = await source.query("select id::text from legislation.passage_search_changes where id=$1", [
        earlier.rows[0]?.id
      ])
      expect(pending.rows).toHaveLength(1)
      await drainPassageChanges(source, target)
      expect(
        (await source.query("select id from legislation.passage_search_changes where id=$1", [earlier.rows[0]?.id]))
          .rows
      ).toHaveLength(0)
    } finally {
      await late.end()
    }
  }, 60_000)

  it("checkpoints backfill and removes search data when processing status changes", async () => {
    expect(await enqueuePassageBackfill(source)).toBeGreaterThanOrEqual(1)
    expect(await enqueuePassageBackfill(source)).toBe(0)
    await source.query("update legislation.bill_documents set processing_status='failed' where id=$1", [documentId])
    await drainPassageChanges(source, target)
    expect(
      (await target.query("select id from legislation.document_sections where document_id=$1", [documentId])).rows
    ).toHaveLength(0)
  }, 60_000)

  it("handles document deletion after restoring a processed document", async () => {
    await source.query("update legislation.bill_documents set processing_status='processed' where id=$1", [documentId])
    await drainPassageChanges(source, target)
    expect(
      (await target.query("select id from legislation.document_sections where document_id=$1", [documentId])).rows
    ).toHaveLength(1)
    await source.query("delete from legislation.bill_documents where id=$1", [documentId])
    await drainPassageChanges(source, target)
    expect(
      (await target.query("select id from legislation.document_sections where document_id=$1", [documentId])).rows
    ).toHaveLength(0)
  }, 60_000)
})
