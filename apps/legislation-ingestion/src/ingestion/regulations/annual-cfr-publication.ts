import { acquisitionUnitSchema, validateManifest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type { RegulatoryLease } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { assessAnnualCfrEdition } from "./annual-cfr-edition.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "./storage.js"

/** All volumes become visible together. Annual volumes never replace the eCFR current-title pointer. */
export async function publishAnnualCfrEdition(
  pool: pg.Pool,
  input: {
    manifestId: string
    year: number
    title: number
    generationIds: string[]
  }
) {
  const ids = z
    .array(z.string().regex(/^[a-f0-9]{64}$/))
    .min(1)
    .max(200)
    .parse(input.generationIds)
    .sort()
  invariant(new Set(ids).size === ids.length, "annual_duplicate_generation")
  const leases: RegulatoryLease[] = []
  try {
    for (const id of ids) {
      leases.push(await claimRegulatoryLease(pool, id))
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='60s'")
      const stored = await client.query<{ body: unknown }>(
        "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
        [input.manifestId]
      )
      const manifest = validateManifest(stored.rows[0]?.body)
      invariant(manifest.id === input.manifestId, "annual_manifest_identity_mismatch")
      const members = []
      for (const lease of leases) {
        const rows = await client.query(
          `SELECT g.*,e.id AS edition_id,e.code_id FROM legislation.legal_import_generations g
          JOIN legislation.legal_editions e ON e.generation_id=g.id
          WHERE g.id=$1 AND g.lease_token=$2 AND g.fence=$3 AND g.lease_expires_at>clock_timestamp() FOR UPDATE OF g,e`,
          [lease.generationId, lease.token, lease.fence]
        )
        const row = z
          .object({
            id: z.string(),
            manifest_id: z.string(),
            source_id: z.literal("govinfo-cfr"),
            state: z.enum(["materialized", "published"]),
            unit: acquisitionUnitSchema,
            summary: regulatoryParseSummarySchema,
            artifact_hash: z.string(),
            expected_records: z.int().positive(),
            edition_id: z.uuid(),
            code_id: z.uuid(),
            rights_profile_id: z.string()
          })
          .parse(rows.rows[0])
        invariant(
          row.manifest_id === manifest.id &&
            row.artifact_hash === row.summary.inputHash &&
            row.expected_records === row.summary.records,
          "annual_member_provenance_mismatch"
        )
        invariant(
          manifest.units.some((unit) => JSON.stringify(unit) === JSON.stringify(row.unit)),
          "annual_member_unit_mismatch"
        )
        await requireRights(client, row.rights_profile_id, "displayText")
        await requireRights(client, row.rights_profile_id, "localSearch")
        const count = await client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM legislation.legal_edition_provisions WHERE edition_id=$1",
          [row.edition_id]
        )
        invariant(count.rows[0]?.count === row.expected_records, "annual_volume_membership_incomplete")
        members.push(row)
      }
      const report = assessAnnualCfrEdition({
        manifest,
        year: input.year,
        title: input.title,
        members: members.map((row) => ({ generationId: row.id, unitKey: row.unit.key, summary: row.summary }))
      })
      invariant(report.isComplete && report.revisionDate, "annual_title_incomplete_or_date_conflict")
      const codeId = members[0]?.code_id
      invariant(codeId && members.every((row) => row.code_id === codeId), "annual_mixed_codes")
      const duplicates = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM (SELECT provision_id FROM legislation.legal_edition_provisions
        WHERE edition_id=ANY($1::uuid[]) GROUP BY provision_id HAVING count(*)>1) duplicates`,
        [members.map((row) => row.edition_id)]
      )
      invariant(duplicates.rows[0]?.count === 0, "annual_duplicate_provision_across_volumes")
      const inserted = await client.query(
        `INSERT INTO legislation.legal_annual_editions(id,manifest_id,code_id,package_year,revision_date,expected_volumes,coverage)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
        [report.id, manifest.id, codeId, report.year, report.revisionDate, report.expectedVolumes, report]
      )
      for (const volume of report.volumes) {
        const member = members.find((row) => row.id === volume.generationId)
        invariant(member, "annual_member_missing")
        await client.query(
          `INSERT INTO legislation.legal_annual_edition_volumes(annual_edition_id,code_id,volume,edition_id)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [report.id, codeId, volume.volume, member.edition_id]
        )
        await client.query(
          "UPDATE legislation.legal_editions SET published_at=coalesce(published_at,clock_timestamp()) WHERE id=$1",
          [member.edition_id]
        )
        await client.query(
          "INSERT INTO legislation.legal_derived_outbox(edition_id,operation) VALUES($1,'lexical') ON CONFLICT DO NOTHING",
          [member.edition_id]
        )
      }
      for (const lease of leases) {
        const updated = await client.query(
          `UPDATE legislation.legal_import_generations SET state='published'
          WHERE id=$1 AND lease_token=$2 AND fence=$3 AND lease_expires_at>clock_timestamp()`,
          [lease.generationId, lease.token, lease.fence]
        )
        invariant(updated.rowCount === 1, "lease_lost")
      }
      await client.query("COMMIT")
      return {
        annualEditionId: report.id,
        volumes: report.expectedVolumes,
        revisionDate: report.revisionDate,
        reused: inserted.rowCount === 0,
        state: "published"
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } finally {
    for (const lease of leases) {
      await releaseRegulatoryLease(pool, lease)
    }
  }
}
