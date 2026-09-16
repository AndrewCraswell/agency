import { fileURLToPath } from "node:url"
import { LegislationApiClient } from "@repo/legislation-core/api-client/client"
import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import invariant from "tiny-invariant"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { createLegalTextReader } from "./legal-text-read"
import { createLegalTextApiHandler } from "./legal-text-routes"
import { executeNextHttpApiHandler } from "./next/node-handler"

const databaseUrl = process.env.REGULATORY_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory integration checks require a local disposable regulations_test database")
  }
}

describe.skipIf(databaseUrl === undefined).sequential("canonical legal text reader", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 10_000 })
  const manifest = digest("canonical-reader-manifest")
  const artifact = digest("canonical-reader-artifact")
  const policy = JSON.stringify(officialFederalRights)

  beforeAll(async () => {
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await pool.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
      VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
  }, 60_000)

  beforeEach(async () => {
    await pool.query(`TRUNCATE legislation.regulatory_documents,legislation.legal_codes,legislation.legal_import_manifests,
      legislation.legal_sources,legislation.legal_rights_profiles,legislation.legal_artifacts CASCADE`)
    await pool.query(
      "INSERT INTO legislation.legal_rights_profiles(id,policy_hash,policy) VALUES('reader-rights',$1,$2)",
      [digest(policy), policy]
    )
    await pool.query(
      "INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES('ecfr','eCFR','official'),('govinfo-fr','GovInfo','official')"
    )
    await pool.query("INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,'{}')", [manifest])
    await pool.query(
      "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,1,'test',now())",
      [artifact]
    )
  })
  afterAll(async () => {
    await pool.end()
  })

  async function generation(source: string) {
    const id = digest(`reader-generation:${source}`)
    await pool.query(
      `INSERT INTO legislation.legal_import_generations
      (id,manifest_id,unit_key,source_id,jurisdiction_id,rights_profile_id,artifact_hash,parser_hash,contract,unit,summary,expected_records,state)
      VALUES($1,$2,'reader',$3,'jurisdiction:us','reader-rights',$4,$4,$5,'{}','{}',1,'published')`,
      [id, manifest, source, artifact, regulatoryParserContract]
    )
    return id
  }

  function blocks(body: string) {
    return JSON.stringify([{ ordinal: 0, tag: "P", kind: "text", text: body, xml: `<P>${body}</P>` }])
  }

  async function provision(body: string) {
    const generationId = await generation("ecfr")
    const code = z.uuid().parse(
      (
        await pool.query(`INSERT INTO legislation.legal_codes(jurisdiction_id,code_key,name,kind)
      VALUES('jurisdiction:us','reader','Reader','regulation') RETURNING id`)
      ).rows[0].id
    )
    const editionId = z.uuid().parse(
      (
        await pool.query(
          `INSERT INTO legislation.legal_editions
      (code_id,jurisdiction_id,source_id,generation_id,rights_profile_id,native_key,source_revision,currency_date,published_at)
      VALUES($1,'jurisdiction:us','ecfr',$2,'reader-rights','reader','reader','2026-01-01',now()) RETURNING id`,
          [code, generationId]
        )
      ).rows[0].id
    )
    const provisionId = z.uuid().parse(
      (
        await pool.query(
          `INSERT INTO legislation.legal_provisions(code_id,identity_key,identity_basis)
      VALUES($1,'reader','citation') RETURNING id`,
          [code]
        )
      ).rows[0].id
    )
    const id = z.uuid().parse(
      (
        await pool.query(
          `INSERT INTO legislation.legal_provision_versions
      (provision_id,code_id,content_hash,input_contract,heading,body,node_kind,blocks,language)
      VALUES($1,$2,$3,$4,'Reader',$5,'section',$6,'en') RETURNING id`,
          [provisionId, code, digest(body), regulatoryParserContract, body, blocks(body)]
        )
      ).rows[0].id
    )
    await pool.query(
      `INSERT INTO legislation.legal_edition_provisions
      (edition_id,code_id,provision_id,version_id,ordinal,source_locator,source_attributes,native_id)
      VALUES($1,$2,$3,$4,0,'/reader','{}','reader')`,
      [editionId, code, provisionId, id]
    )
    return { id, body, editionId }
  }

  async function publications() {
    const generationId = await generation("govinfo-fr")
    await pool.query(
      `INSERT INTO legislation.regulatory_publication_batches
      (generation_id,metadata_manifest_id,metadata_manifest,snapshot_hash,reconciliation)
      VALUES($1,$2,'{}',$2,'{}')`,
      [generationId, manifest]
    )
    for (const number of [1, 2]) {
      const body = `Publication ${number}`
      const document = z.uuid().parse(
        (
          await pool.query(
            `INSERT INTO legislation.regulatory_documents
        (jurisdiction_id,identity_namespace,native_number) VALUES('jurisdiction:us','reader',$1) RETURNING id`,
            [String(number)]
          )
        ).rows[0].id
      )
      const version = z.uuid().parse(
        (
          await pool.query(
            `INSERT INTO legislation.regulatory_document_versions
        (document_id,content_hash,input_contract,pdf_hash,heading,body,blocks,publication_kind)
        VALUES($1,$2,$3,$4,'Reader',$5,$6,'notice') RETURNING id`,
            [document, digest(body), regulatoryParserContract, artifact, body, blocks(body)]
          )
        ).rows[0].id
      )
      await pool.query(
        `INSERT INTO legislation.regulatory_document_observations
        (generation_id,document_id,version_id,source_id,jurisdiction_id,rights_profile_id,publication_date,metadata,source_locator,pdf_receipt,pdf_inspection)
        VALUES($1,$2,$3,'govinfo-fr','jurisdiction:us','reader-rights','2024-01-02','{}','/reader','{}','{}')`,
        [generationId, document, version]
      )
    }
    return z
      .array(z.object({ id: z.uuid(), version_id: z.uuid(), body: z.string() }))
      .parse(
        (
          await pool.query(
            "SELECT o.id,o.version_id,v.body FROM legislation.regulatory_document_observations o JOIN legislation.regulatory_document_versions v ON v.id=o.version_id ORDER BY o.id"
          )
        ).rows
      )
  }

  it("serves exact provision text through HTTP and the typed client, with account-bound continuation and live rights", async () => {
    const source = await provision("a".repeat(40_000))
    const reader = createLegalTextReader(pool, ["org-reader", "org-other"])
    let identity = { userId: "user-reader", organizationId: "org-reader" }
    const handler = createLegalTextApiHandler(reader)
    const api = new LegislationApiClient({
      baseUrl: "https://api.example",
      fetch: async (url, init) =>
        executeNextHttpApiHandler(new Request(url, init), handler, { requestContext: { identity } })
    })
    const first = await api.getLegalText(source.id, { editionId: source.editionId, limit: 1 })
    expect(first.data.selectedContext).toMatchObject({
      kind: "provision",
      editionId: source.editionId,
      versionId: source.id,
      basis: "observed_snapshot",
      selectedDate: null
    })
    invariant(first.data.nextCursor, "missing_test_cursor")
    let reconstructed = first.data.blocks.map((block) => block.text).join("")
    let cursor: string | null = first.data.nextCursor
    while (cursor) {
      const page = await api.getLegalText(source.id, { editionId: source.editionId, limit: 1, cursor })
      reconstructed += page.data.blocks.map((block) => block.text).join("")
      cursor = page.data.nextCursor
    }
    expect(reconstructed).toBe(source.body)
    identity = { ...identity, organizationId: "org-other" }
    await expect(
      api.getLegalText(source.id, { editionId: source.editionId, limit: 1, cursor: first.data.nextCursor })
    ).rejects.toMatchObject({ category: "conflict" })
    identity = { ...identity, organizationId: "org-reader" }
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(
      api.getLegalText(source.id, { editionId: source.editionId, limit: 1, cursor: first.data.nextCursor })
    ).rejects.toMatchObject({ category: "forbidden" })
    await expect(api.getLegalText(source.id, { editionId: source.editionId })).rejects.toMatchObject({
      category: "forbidden"
    })
  })

  it("reads exact Federal Register observation text and rejects incompatible version selection", async () => {
    const rows = await publications()
    invariant(rows[0] && rows[1], "missing_fr_test_observations")
    const first = rows[0]
    const second = rows[1]
    const reader = createLegalTextReader(pool, ["org-reader"])
    const context = { correlationId: "fr-reader", identity: { userId: "user-reader", organizationId: "org-reader" } }
    const window = await runWithRequestContext(context, () =>
      reader(first.version_id, { sourceObservationId: first.id, limit: 100 })
    )
    expect(window.blocks.map((block) => block.text).join("")).toBe(first.body)
    expect(window.selectedContext).toMatchObject({
      kind: "publication",
      sourceObservationId: first.id,
      versionId: first.version_id,
      publishedOn: "2024-01-02"
    })
    await expect(
      runWithRequestContext(context, () => reader(first.version_id, { sourceObservationId: second.id }))
    ).rejects.toMatchObject({ category: "not_found" })
    await expect(reader(first.version_id, { sourceObservationId: first.id })).rejects.toMatchObject({
      category: "unauthorized"
    })
  })
})
