import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import invariant from "tiny-invariant"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { createLegalEditionSearch } from "./legal-edition-search.js"

const sourceUrl = process.env.REGULATORY_TEST_DATABASE_URL
const targetUrl = process.env.REGULATORY_SEARCH_TEST_DATABASE_URL
for (const [value, database] of [
  [sourceUrl, "/regulations_test"],
  [targetUrl, "/legislation_passage_search"]
]) {
  if (value !== undefined) {
    const url = new URL(value)
    invariant(
      url.pathname === database && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
      "Legal reader integration checks require local disposable databases"
    )
  }
}

const codeId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const observationId = digest("reader observation")
const preparationId = digest("reader preparation")
const inventoryHash = digest("reader inventory")
const rightsId = "reader-official"
const codeName = "Code of Federal Regulations, title 1"
const publisher = "Office of the Federal Register / GPO"
const publisherUrl = "https://www.ecfr.gov/api/versioner/v1/full/2026-09-11/title-1.xml"
const retrievedAt = "2026-09-15T00:00:00.000000Z"
const publishedAt = "2026-09-15T01:00:00.000000Z"
const identity = { userId: "reader-user", organizationId: "reader-org" }
const fixtures = [0, 1].map((ordinal) => {
  const provisionId = `00000000-0000-4000-8000-${String(10 + ordinal).padStart(12, "0")}`
  const versionId = `00000000-0000-4000-8000-${String(20 + ordinal).padStart(12, "0")}`
  const generationId = digest(`reader generation ${ordinal}`)
  const passageId = digest(JSON.stringify([generationId, 0]))
  const body = `Ethical conduct standards for office ${ordinal + 1}.`
  const heading = `Office ${ordinal + 1}`
  const nativeId = `cfr:1:section:1.${ordinal + 1}`
  const context = ["jurisdiction:us", codeName, nativeId, heading].join("\n")
  const inputText = `${context}\n${body}`
  const data = {
    id: passageId,
    versionId,
    ordinal: 0,
    start: 0,
    end: body.length,
    text: body,
    inputText,
    tokenCount: 20,
    readerSpans: [],
    contextSpans: [],
    inputHash: digest(inputText),
    rowContinuation: null
  }
  const metadata = {
    id: generationId,
    provision_version_id: versionId,
    document_version_id: null,
    contract: "reader-sql-fixture",
    body_hash: digest(body),
    tokenizer_id: "reader-sql-fixture",
    context,
    manifest_hash: digest(JSON.stringify([data])),
    passage_count: 1,
    eligibility: "eligible"
  }
  return { ordinal, provisionId, versionId, generationId, passageId, body, heading, nativeId, context, data, metadata }
})

const suite = sourceUrl === undefined || targetUrl === undefined ? describe.skip : describe
suite.sequential("legal edition reader on real PostgreSQL", () => {
  const source = new pg.Pool({ connectionString: sourceUrl, max: 2, connectionTimeoutMillis: 10_000 })
  const target = new pg.Pool({ connectionString: targetUrl, max: 2, connectionTimeoutMillis: 10_000 })
  const search = createLegalEditionSearch(source, target, [identity.organizationId])
  function read(input: { cursor?: string; query?: string; limit?: number } = {}, userId = identity.userId) {
    return runWithRequestContext({ correlationId: "reader-integration", identity: { ...identity, userId } }, () =>
      search({ editionIds: [editionId], query: "ethical", ...input })
    )
  }

  beforeAll(async () => {
    invariant(
      (await source.query("SELECT current_database() AS name")).rows[0].name === "regulations_test",
      "Legal reader source must use the regulations_test database"
    )
    invariant(
      (await target.query("SELECT current_database() AS name")).rows[0].name === "legislation_passage_search",
      "Legal reader target must use the legislation_passage_search database"
    )
    await migrate(drizzle(source), {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await source.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
      VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
    if (!(await target.query("SELECT to_regclass('legislation.legal_search_generations') AS name")).rows[0].name) {
      await target.query(
        await readFile(new URL(import.meta.resolve("@repo/legislation-core/infra/passage-search/legal.sql")), "utf8")
      )
    }
  }, 60_000)

  beforeEach(async () => {
    await target.query(`TRUNCATE legislation.legal_search_generations,legislation.legal_search_scopes,
      legislation.legal_search_revocations,legislation.legal_search_results CASCADE`)
    await source.query(`TRUNCATE legislation.regulatory_documents,legislation.legal_codes,
      legislation.legal_import_manifests,legislation.legal_sources,legislation.legal_rights_profiles,
      legislation.legal_artifacts CASCADE`)
    await source.query("INSERT INTO legislation.legal_rights_profiles(id,policy_hash,policy) VALUES($1,$2,$3::jsonb)", [
      rightsId,
      digest(JSON.stringify(officialFederalRights)),
      JSON.stringify(officialFederalRights)
    ])
    await source.query("INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES('ecfr',$1,'official')", [
      publisher
    ])
    await source.query("INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,'{}')", [observationId])
    await source.query(
      "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,100,'reader-fixture',$2)",
      [observationId, retrievedAt]
    )
    await source.query(
      `INSERT INTO legislation.legal_import_generations
      (id,manifest_id,unit_key,source_id,jurisdiction_id,rights_profile_id,artifact_hash,parser_hash,
        contract,unit,summary,expected_records,state)
      VALUES($1,$1,'reader-fixture','ecfr','jurisdiction:us',$2,$1,$1,'reader-sql-fixture',$3::jsonb,'{}',2,'published')`,
      [observationId, rightsId, JSON.stringify({ sourceUrl: publisherUrl })]
    )
    await source.query(
      `INSERT INTO legislation.legal_codes(id,jurisdiction_id,code_key,name,kind)
      VALUES($1,'jurisdiction:us','cfr:1',$2,'regulation')`,
      [codeId, codeName]
    )
    await source.query(
      `INSERT INTO legislation.legal_editions
      (id,code_id,jurisdiction_id,source_id,generation_id,rights_profile_id,native_key,source_revision,
        issue_date,currency_date,published_at)
      VALUES($1,$2,'jurisdiction:us','ecfr',$3,$4,'2026-09-11','reader-revision','2026-09-10','2026-09-11',$5)`,
      [editionId, codeId, observationId, rightsId, publishedAt]
    )
    await source.query(
      "INSERT INTO legislation.legal_derived_outbox(edition_id,operation,state) VALUES($1,'lexical','acknowledged')",
      [editionId]
    )
    await source.query(
      `INSERT INTO legislation.legal_passage_preparations(id,edition_id,tokenizer_id,inventory_hash,expected_count,state)
      VALUES($1,$2,'reader-sql-fixture',$3,2,'prepared')`,
      [preparationId, editionId, inventoryHash]
    )
    await target.query(
      `INSERT INTO legislation.legal_search_scopes
      (scope_kind,scope_id,preparation_id,inventory_hash,generation_count,passage_count) VALUES('edition',$1,$2,$3,2,2)`,
      [editionId, preparationId, inventoryHash]
    )
    for (const fixture of fixtures) {
      await source.query(
        "INSERT INTO legislation.legal_provisions(id,code_id,identity_key,identity_basis) VALUES($1,$2,$3,'citation')",
        [fixture.provisionId, codeId, fixture.nativeId]
      )
      await source.query(
        `INSERT INTO legislation.legal_provision_versions
        (id,provision_id,code_id,content_hash,input_contract,heading,body,node_kind,blocks,language)
        VALUES($1,$2,$3,$4,'reader-sql-fixture',$5,$6,'section','[]','en')`,
        [fixture.versionId, fixture.provisionId, codeId, digest(fixture.body), fixture.heading, fixture.body]
      )
      await source.query(
        `INSERT INTO legislation.legal_edition_provisions
        (edition_id,code_id,provision_id,version_id,parent_id,ordinal,source_locator,source_attributes,native_id)
        VALUES($1,$2,$3,$4,NULL,$5,$6,'{}',$7)`,
        [
          editionId,
          codeId,
          fixture.provisionId,
          fixture.versionId,
          fixture.ordinal,
          `/SECTION[${fixture.ordinal + 1}]`,
          fixture.nativeId
        ]
      )
      await source.query(
        `INSERT INTO legislation.legal_passage_generations
        (id,provision_version_id,contract,body_hash,tokenizer_id,context,manifest_hash,passage_count,eligibility)
        VALUES($1,$2,'reader-sql-fixture',$3,'reader-sql-fixture',$4,$5,1,'eligible')`,
        [
          fixture.generationId,
          fixture.versionId,
          fixture.metadata.body_hash,
          fixture.context,
          fixture.metadata.manifest_hash
        ]
      )
      const passageValues = [
        fixture.passageId,
        fixture.generationId,
        fixture.body,
        fixture.data.inputText,
        JSON.stringify(fixture.data)
      ]
      await source.query(
        "INSERT INTO legislation.legal_passages(id,generation_id,ordinal,body,input_text,data) VALUES($1,$2,0,$3,$4,$5::jsonb)",
        passageValues
      )
      await source.query(
        `INSERT INTO legislation.legal_passage_preparation_items(preparation_id,ordinal,version_id,context,generation_id)
        VALUES($1,$2,$3,$4,$5)`,
        [preparationId, fixture.ordinal, fixture.versionId, fixture.context, fixture.generationId]
      )
      await target.query("INSERT INTO legislation.legal_search_generations(id,metadata) VALUES($1,$2::jsonb)", [
        fixture.generationId,
        JSON.stringify(fixture.metadata)
      ])
      await target.query(
        "INSERT INTO legislation.legal_search_passages(id,generation_id,ordinal,body,input_text,data) VALUES($1,$2,0,$3,$4,$5::jsonb)",
        passageValues
      )
      await target.query(
        "INSERT INTO legislation.legal_search_memberships(scope_kind,scope_id,generation_id) VALUES('edition',$1,$2)",
        [editionId, fixture.generationId]
      )
      const revision = z.coerce
        .bigint()
        .parse(
          (
            await source.query("SELECT revision FROM legislation.legal_copy_revisions WHERE generation_id=$1", [
              fixture.generationId
            ])
          ).rows[0].revision
        )
      await target.query(
        `INSERT INTO legislation.legal_search_scope_revisions(scope_kind,scope_id,generation_id,source_revision,target_revision)
        SELECT 'edition',$1,generation_id,$3,revision FROM legislation.legal_copy_revisions WHERE generation_id=$2`,
        [editionId, fixture.generationId, revision.toString()]
      )
    }
  })

  afterAll(async () => {
    await Promise.all([source.end(), target.end()])
  })

  it("hydrates exact source versions with publisher, rights and edition metadata", async () => {
    const result = await read()
    expect(result).toMatchObject({ selectedEditions: [editionId], mode: "lexical", nextCursor: null, truncated: false })
    expect(result.hits).toHaveLength(2)
    for (const fixture of fixtures) {
      expect(result.hits.find((hit) => hit.versionId === fixture.versionId)).toEqual({
        passageId: fixture.passageId,
        provisionId: fixture.provisionId,
        versionId: fixture.versionId,
        editionId,
        codeId,
        nativeId: fixture.nativeId,
        heading: fixture.heading,
        sourceLocator: `/SECTION[${fixture.ordinal + 1}]`,
        sourceId: "ecfr",
        sourceCurrencyDate: "2026-09-11",
        issueDate: "2026-09-10",
        rightsPolicyHash: digest(JSON.stringify(officialFederalRights)),
        codeName,
        sourceObservationId: observationId,
        sourceUrl: publisherUrl,
        publisher,
        attribution: officialFederalRights.attribution,
        retrievedAt,
        updatedAt: publishedAt,
        parentId: null,
        versionHash: digest(fixture.body),
        textUrl: `/api/legal/versions/${fixture.versionId}/text?editionId=${editionId}`,
        score: expect.any(Number),
        passage: fixture.data
      })
    }
  })

  it("persists a frozen ranking, replays pages, and binds continuation to caller and query", async () => {
    const first = await read({ limit: 1 })
    invariant(first.nextCursor, "missing_reader_cursor")
    const snapshots = await target.query("SELECT candidates,candidate_hash FROM legislation.legal_search_results")
    expect(snapshots.rows).toHaveLength(1)
    const snapshot = z
      .object({
        candidates: z.array(
          z.strictObject({
            id: z.string(),
            editionId: z.uuid(),
            generationId: z.string(),
            versionId: z.uuid(),
            score: z.number()
          })
        ),
        candidate_hash: z.string()
      })
      .parse(snapshots.rows[0])
    expect(snapshot.candidate_hash).toBe(digest(JSON.stringify(snapshot.candidates)))
    const continuation = { limit: 1, cursor: first.nextCursor }
    const second = await read(continuation)
    expect(await read(continuation)).toEqual(second)
    expect(second).toMatchObject({ nextCursor: null, truncated: false, generation: first.generation })
    expect([...first.hits, ...second.hits].map((hit) => ({ id: hit.passageId, score: hit.score }))).toEqual(
      snapshot.candidates.map(({ id, score }) => ({ id, score }))
    )
    expect(new Set([...first.hits, ...second.hits].map((hit) => hit.versionId)).size).toBe(2)
    await expect(read({ ...continuation, query: "standards" })).rejects.toMatchObject({ category: "conflict" })
    await expect(read(continuation, "other-user")).rejects.toMatchObject({ category: "conflict" })
    await expect(read({ ...continuation, limit: 2 })).rejects.toMatchObject({ category: "conflict" })
    await target.query(`UPDATE legislation.legal_search_results
      SET created_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 minute'`)
    await expect(read(continuation)).rejects.toMatchObject({ category: "conflict" })
  })

  it("invalidates a frozen continuation when edition metadata changes", async () => {
    const first = await read({ limit: 1 })
    invariant(first.nextCursor, "missing_reader_cursor")
    await source.query("UPDATE legislation.legal_editions SET currency_date='2026-09-12' WHERE id=$1", [editionId])
    await expect(read({ limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ category: "conflict" })
    expect((await read()).hits.every((hit) => hit.sourceCurrencyDate === "2026-09-12")).toBe(true)
  })

  it("checks revoked source rights before connecting to the retained search copy", async () => {
    await source.query("UPDATE legislation.legal_rights_profiles SET is_active=false WHERE id=$1", [rightsId])
    const closedTarget = new pg.Pool({ connectionString: targetUrl })
    await closedTarget.end()
    const denied = createLegalEditionSearch(source, closedTarget, [identity.organizationId])
    await expect(
      runWithRequestContext({ correlationId: "denied", identity }, () =>
        denied({ editionIds: [editionId], query: "ethical" })
      )
    ).rejects.toMatchObject({ category: "forbidden" })
  })

  it.each(["context", "membership", "source_revision", "target_revision"])(
    "rejects changed %s before serving frozen or empty result pages",
    async (change) => {
      const first = await read({ limit: 1 })
      invariant(first.nextCursor, "missing_reader_cursor")
      if (change === "context") {
        await source.query("UPDATE legislation.legal_codes SET name=name||' changed context' WHERE id=$1", [codeId])
      } else if (change === "membership") {
        await source.query(
          `WITH provision AS (
            INSERT INTO legislation.legal_provisions(code_id,identity_key,identity_basis)
            VALUES($1,'extra-reader-member','citation') RETURNING id
          ), version AS (
            INSERT INTO legislation.legal_provision_versions
            (provision_id,code_id,content_hash,input_contract,heading,body,node_kind,blocks,language)
            SELECT id,$1,$3,'reader-sql-fixture','Extra','Extra','section','[]','en' FROM provision
            RETURNING id,provision_id
          ) INSERT INTO legislation.legal_edition_provisions
            (edition_id,code_id,provision_id,version_id,parent_id,ordinal,source_locator,source_attributes,native_id)
            SELECT $2,$1,provision_id,id,NULL,2,'/SECTION[3]','{}','extra-reader-member' FROM version`,
          [codeId, editionId, digest("Extra")]
        )
      } else if (change === "source_revision") {
        await source.query("UPDATE legislation.legal_provision_versions SET body=body WHERE code_id=$1", [codeId])
      } else {
        await target.query("UPDATE legislation.legal_search_generations SET metadata=metadata")
      }
      await expect(read({ limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({
        category: "dependency_unavailable"
      })
      await expect(read({ query: "unmatchedterm" })).rejects.toMatchObject({ category: "dependency_unavailable" })
    }
  )

  it("rechecks copied text against the canonical passage even with refreshed revision receipts", async () => {
    await target.query(`UPDATE legislation.legal_search_passages
      SET body=body||' tampered',data=jsonb_set(data,'{text}',to_jsonb(body||' tampered'))`)
    await target.query(`UPDATE legislation.legal_search_scope_revisions receipt SET target_revision=current.revision
      FROM legislation.legal_copy_revisions current WHERE current.generation_id=receipt.generation_id`)
    await expect(read()).rejects.toThrow("legal_search_candidate_mismatch")
  })
})
