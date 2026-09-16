import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { assessAnnualCfrDates } from "./annual-cfr-dates.js"
import { acquisitionUnitSchema } from "./contracts.js"
import { regulatoryParseSummarySchema } from "./parser-contract.js"
import type { RegulatoryLease } from "./storage-contract.js"
import { requireRights, withLease } from "./storage.js"

const observationSchema = z.object({
  generationId: z.string(),
  anchorEditionId: z.uuid(),
  packageYear: z.int(),
  revisionDate: z.iso.date(),
  sourceUrl: z.url(),
  disposition: z.literal("duplicate_revision")
})

/** A source observation is explicitly separate from a published package-year edition. */
export async function readAnnualCfrSourceObservation(connection: pg.Pool | pg.PoolClient, generationId: string) {
  const rows = await connection.query(
    `SELECT o.generation_id AS "generationId",o.anchor_edition_id AS "anchorEditionId",
      o.package_year AS "packageYear",o.revision_date::text AS "revisionDate",
      g.unit->>'sourceUrl' AS "sourceUrl",o.disposition
    FROM legislation.legal_annual_source_observations o
    JOIN legislation.legal_import_generations g ON g.id=o.generation_id AND g.state='observed'
    JOIN legislation.legal_editions e ON e.id=o.anchor_edition_id AND e.published_at IS NOT NULL
    JOIN legislation.legal_import_generations a ON a.id=e.generation_id AND a.state='published'
    JOIN legislation.legal_rights_profiles r ON r.id=g.rights_profile_id AND r.is_active
    JOIN legislation.legal_rights_profiles ar ON ar.id=a.rights_profile_id AND ar.is_active
    WHERE o.generation_id=$1 AND EXISTS
      (SELECT 1 FROM legislation.legal_annual_edition_volumes v WHERE v.edition_id=e.id)`,
    [generationId]
  )
  const row = rows.rows[0]
  return row === undefined ? null : { ...observationSchema.parse(row), canCreatePackageYearEdition: false as const }
}

/** Resolve only an exact copy of a verified, atomically published annual volume. No edition or outbox writes. */
export async function resolveAnnualCfrObservation(pool: pg.Pool, lease: RegulatoryLease) {
  return withLease(pool, lease, async (client, generation) => {
    invariant(generation.unit.sourceId === "govinfo-cfr", "annual_observation_source_required")
    const existing =
      generation.state === "observed" ? await readAnnualCfrSourceObservation(client, lease.generationId) : null
    invariant(generation.state !== "observed" || existing, "annual_observation_anchor_unavailable")
    invariant(
      generation.state === "blocked" || generation.state === "observed",
      "annual_observation_requires_date_block"
    )
    const summary = generation.summary
    const dates = summary.sourceDates.filter((row) => row.kind === "printed_revision").map((row) => row.value)
    const revision = dates[0]
    const native = /^CFR-(\d{4})-title([1-9][0-9]*)-vol([1-9][0-9]*)$/.exec(generation.unit.nativeId)
    if (
      !native ||
      !revision ||
      dates.some((date) => date !== revision) ||
      Number(native[1]) !== Number(generation.unit.edition) ||
      Number(native[1]) <= Number(revision.slice(0, 4)) ||
      summary.warnings.length === 0 ||
      summary.warnings.some((warning) => warning.code !== "source_date_mismatch")
    ) {
      return null
    }
    const anchorNative = `CFR-${revision.slice(0, 4)}-title${native[2]}-vol${native[3]}`
    const candidates = await client.query(
      `SELECT a.id,a.unit,a.summary,e.id AS edition_id,e.code_id,a.rights_profile_id,
        coalesce(a.lease_expires_at>clock_timestamp(),false) AS busy
      FROM legislation.legal_import_generations a
      JOIN legislation.legal_editions e ON e.generation_id=a.id AND e.published_at IS NOT NULL
      WHERE a.source_id='govinfo-cfr' AND a.state='published' AND a.artifact_hash=$1
        AND a.parser_hash=$2 AND a.unit->>'nativeId'=$3 AND e.issue_date=$4::date AND e.currency_date=$4::date
        AND EXISTS (SELECT 1 FROM legislation.legal_annual_edition_volumes v
          JOIN legislation.legal_annual_editions t ON t.id=v.annual_edition_id
          WHERE v.edition_id=e.id AND t.revision_date=$4::date AND t.package_year=$5)
      ORDER BY a.id LIMIT 2 FOR SHARE OF a,e`,
      [generation.artifact_hash, summary.parserCodeHash, anchorNative, revision, Number(revision.slice(0, 4))]
    )
    if (candidates.rows.length !== 1) {
      return null
    }
    const anchor = z
      .object({
        id: z.string(),
        unit: acquisitionUnitSchema,
        summary: regulatoryParseSummarySchema,
        edition_id: z.uuid(),
        code_id: z.uuid(),
        rights_profile_id: z.string(),
        busy: z.boolean()
      })
      .parse(candidates.rows[0])
    if (
      anchor.busy ||
      anchor.summary.warnings.length > 0 ||
      anchor.summary.inputHash !== generation.artifact_hash ||
      anchor.summary.records !== summary.records ||
      anchor.summary.sourceRecords !== summary.sourceRecords
    ) {
      return null
    }
    await requireRights(client, anchor.rights_profile_id, "retainRaw")
    const assessment = assessAnnualCfrDates(
      [generation, { ...generation, unit: anchor.unit, summary: anchor.summary }].map((item) => ({
        unitKey: item.unit.key,
        nativeId: item.unit.nativeId,
        packageYear: Number(item.unit.edition),
        artifactHash: generation.artifact_hash,
        printedRevisionDates: item.summary.sourceDates
          .filter((date) => date.kind === "printed_revision")
          .map((date) => date.value)
      }))
    ).units[0]
    invariant(assessment?.disposition === "retain_duplicate_revision_observation", "annual_observation_date_unverified")
    // Compare every staged payload, including retained quote/table XML, after removing acquisition-local IDs.
    // Parent locators and canonical anchor bodies are compared independently; matching counts alone cannot pass.
    const comparison = await client.query<{ count: number; mismatches: number }>(
      `WITH source AS (SELECT * FROM legislation.legal_import_records WHERE generation_id=$1),
      anchor AS (SELECT * FROM legislation.legal_import_records WHERE generation_id=$2)
      SELECT count(*)::int AS count,count(*) FILTER (WHERE NOT coalesce(
        s.payload-ARRAY['recordKey','parentKey','nativeId','provenance'] = a.payload-ARRAY['recordKey','parentKey','nativeId','provenance']
        AND s.native_id=CASE WHEN a.payload->>'identityBasis'='source_locator'
          THEN $4||':'||a.source_locator ELSE a.native_id END
        AND sp.source_locator IS NOT DISTINCT FROM ap.source_locator
        AND (s.parent_key IS NULL OR sp.record_key IS NOT NULL)
        AND (a.parent_key IS NULL OR ap.record_key IS NOT NULL)
        AND v.heading=a.payload->>'heading' AND v.body=a.payload->>'text' AND v.blocks=a.payload->'blocks'
        AND m.ordinal=a.ordinal AND m.source_locator=a.source_locator AND m.native_id=a.native_id
        AND m.parent_id IS NOT DISTINCT FROM pp.id,
        false))::int AS mismatches
      FROM source s FULL JOIN anchor a ON a.source_locator=s.source_locator
      LEFT JOIN source sp ON sp.record_key=s.parent_key LEFT JOIN anchor ap ON ap.record_key=a.parent_key
      LEFT JOIN legislation.legal_provisions p ON p.identity_key=a.identity_key AND p.code_id=$5
      LEFT JOIN legislation.legal_provisions pp ON pp.identity_key=ap.identity_key AND pp.code_id=$5
      LEFT JOIN legislation.legal_edition_provisions m ON m.provision_id=p.id AND m.edition_id=$3
      LEFT JOIN legislation.legal_provision_versions v ON v.id=m.version_id`,
      [lease.generationId, anchor.id, anchor.edition_id, generation.unit.nativeId, anchor.code_id]
    )
    invariant(
      comparison.rows[0]?.count === summary.records && comparison.rows[0].mismatches === 0,
      "annual_observation_content_mismatch"
    )
    if (existing) {
      invariant(
        existing.anchorEditionId === anchor.edition_id &&
          existing.revisionDate === revision &&
          existing.packageYear === Number(generation.unit.edition),
        "annual_observation_evidence_changed"
      )
      return { ...existing, reused: true }
    }
    await client.query(
      `INSERT INTO legislation.legal_annual_source_observations
      (generation_id,anchor_edition_id,package_year,revision_date,disposition,evidence)
      VALUES($1,$2,$3,$4,'duplicate_revision',$5)`,
      [lease.generationId, anchor.edition_id, Number(generation.unit.edition), revision, assessment]
    )
    await client.query(
      "UPDATE legislation.legal_import_generations SET state='observed',blocked_reason=NULL WHERE id=$1",
      [lease.generationId]
    )
    const observation = await readAnnualCfrSourceObservation(client, lease.generationId)
    invariant(observation, "annual_observation_missing")
    return { ...observation, reused: false }
  })
}
