import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { digest } from "../legal-text/contracts.js"

const databaseUrl = process.env.LEGISLATION_CORE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/legislation_core_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("LEGISLATION_CORE_TEST_DATABASE_URL must target a local disposable legislation_core_test database")
  }
}

describe.skipIf(databaseUrl === undefined).sequential("canonical legal storage constraints", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
  beforeAll(async () => {
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(new URL("./migrations/", import.meta.url)),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  }, 60_000)
  afterAll(async () => {
    await pool.end()
  })

  it("enforces code/version and edition/parent foreign keys in PostgreSQL", async () => {
    const client = await pool.connect()
    const identity = randomUUID()
    const hash = digest(identity)
    const codeId = randomUUID()
    const otherCodeId = randomUUID()
    const editionId = randomUUID()
    try {
      await client.query("BEGIN")
      await client.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
        VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
      await client.query("INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES($1,'Test','official')", [
        identity
      ])
      await client.query("INSERT INTO legislation.legal_rights_profiles(id,policy_hash,policy) VALUES($1,$2,'{}')", [
        identity,
        hash
      ])
      await client.query("INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,'{}')", [hash])
      await client.query(
        "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,1,'test',now())",
        [hash]
      )
      await client.query(
        `INSERT INTO legislation.legal_import_generations
        (id,manifest_id,unit_key,source_id,jurisdiction_id,rights_profile_id,artifact_hash,parser_hash,contract,unit,summary,expected_records)
        VALUES($1,$1,'test',$2,'jurisdiction:us',$2,$1,$1,'test','{}','{}',3)`,
        [hash, identity]
      )
      await client.query(
        `INSERT INTO legislation.legal_codes(id,jurisdiction_id,code_key,name,kind)
        VALUES($1,'jurisdiction:us',$3,'Test','regulation'),($2,'jurisdiction:us',$4,'Other','regulation')`,
        [codeId, otherCodeId, identity, `${identity}:other`]
      )
      await client.query(
        `INSERT INTO legislation.legal_editions
        (id,code_id,jurisdiction_id,source_id,generation_id,rights_profile_id,native_key,source_revision,published_at)
        VALUES($1,$2,'jurisdiction:us',$3,$4,$3,'test','test',now())`,
        [editionId, codeId, identity, hash]
      )
      const parentId = randomUUID()
      for (const ordinal of [0, 1, 2]) {
        const provisionId = ordinal === 0 ? parentId : randomUUID()
        const versionId = randomUUID()
        await client.query(
          "INSERT INTO legislation.legal_provisions(id,code_id,identity_key,identity_basis) VALUES($1,$2,$3,'test')",
          [provisionId, codeId, String(ordinal)]
        )
        await client.query(
          `INSERT INTO legislation.legal_provision_versions
          (id,provision_id,code_id,content_hash,input_contract,heading,body,node_kind,blocks,language)
          VALUES($1,$2,$3,$4,'test','Test','Test','section','[]','en')`,
          [versionId, provisionId, codeId, hash]
        )
        await client.query(
          `INSERT INTO legislation.legal_edition_provisions
          (edition_id,code_id,provision_id,version_id,parent_id,ordinal,source_locator,source_attributes,native_id)
          VALUES($1,$2,$3,$4,$5,$6,'/test','{}',$7)`,
          [editionId, codeId, provisionId, versionId, ordinal === 0 ? null : parentId, ordinal, String(ordinal)]
        )
      }
      await client.query("SAVEPOINT constraints")
      await expect(
        client.query("UPDATE legislation.legal_edition_provisions SET code_id=$1 WHERE edition_id=$2", [
          otherCodeId,
          editionId
        ])
      ).rejects.toMatchObject({ code: "23503" })
      await client.query("ROLLBACK TO SAVEPOINT constraints")
      await expect(
        client.query(
          "UPDATE legislation.legal_edition_provisions SET parent_id=gen_random_uuid() WHERE edition_id=$1 AND ordinal=1",
          [editionId]
        )
      ).rejects.toMatchObject({ code: "23503" })
      await client.query("ROLLBACK TO SAVEPOINT constraints")
      await expect(
        client.query(
          "UPDATE legislation.legal_edition_provisions SET parent_id=provision_id WHERE edition_id=$1 AND ordinal=1",
          [editionId]
        )
      ).rejects.toMatchObject({ code: "23514" })
      await client.query("ROLLBACK TO SAVEPOINT constraints")
      expect(
        (
          await client.query(
            "SELECT count(*)::integer AS count FROM legislation.legal_edition_provisions WHERE edition_id=$1",
            [editionId]
          )
        ).rows[0].count
      ).toBe(3)
    } finally {
      await client.query("ROLLBACK")
      client.release()
    }
  })
})
