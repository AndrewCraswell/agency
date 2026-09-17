import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalDiscoveryStageSchema } from "./discovery-dispatch.js"
import { validateLegalDiscoveryManifest } from "./discovery-registration.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const legalDiscoveryManifestCompletionSchema = z.strictObject({ manifestId: hashSchema })
const unitStateSchema = z.enum(["pending", "registered", "acquired", "parsed", "published", "quarantined"])
const unitSchema = z.object({
  unit_key: hashSchema,
  state: unitStateSchema,
  artifact_hash: hashSchema.nullable(),
  parser_hash: hashSchema.nullable(),
  publication_generation_id: hashSchema.nullable(),
  edition_id: z.uuid().nullable(),
  rights_profile_id: z.string().nullable(),
  lexical_state: z.enum(["pending", "acknowledged"]).nullable(),
  lexical_delayed: z.boolean()
})
const dispatchSchema = z.object({
  unit_key: hashSchema,
  stage: legalDiscoveryStageSchema,
  completed_at: z.date().nullable(),
  lease_active: z.boolean(),
  submission_uncertain: z.boolean(),
  remote_state_mismatch: z.boolean(),
  failed_attempts: z.int().nonnegative(),
  cancelled_attempts: z.int().nonnegative()
})
const stages = legalDiscoveryStageSchema.options

/** Reconciles one immutable bounded source manifest without advancing or dispatching any stage. */
export async function inspectLegalDiscoveryManifestCompletion(pool: pg.Pool, value: unknown) {
  const input = legalDiscoveryManifestCompletionSchema.parse(value)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='15s'")
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
      "legal_discovery_manifest_wrong_database"
    )
    const manifestResult = await client.query("SELECT body FROM legislation.legal_import_manifests WHERE id=$1", [
      input.manifestId
    ])
    invariant(manifestResult.rowCount === 1, "legal_discovery_manifest_not_found")
    const manifest = validateLegalDiscoveryManifest(manifestResult.rows[0]?.body)
    const units = z
      .array(unitSchema)
      .max(100)
      .parse(
        (
          await client.query(
            `SELECT unit.unit_key,unit.state,unit.artifact_hash,unit.parser_hash,
           unit.publication_generation_id,unit.edition_id,edition.rights_profile_id,outbox.state lexical_state,
           COALESCE(outbox.state='pending' AND outbox.retry_at>transaction_timestamp(),false) lexical_delayed
           FROM legislation.legal_discovery_units unit
           LEFT JOIN legislation.legal_editions edition ON edition.id=unit.edition_id
           LEFT JOIN legislation.legal_derived_outbox outbox
             ON outbox.edition_id=unit.edition_id AND outbox.operation='lexical'
           WHERE unit.manifest_id=$1 ORDER BY unit.unit_key`,
            [input.manifestId]
          )
        ).rows
      )
    const rightsProfiles = [
      ...new Set(units.map((unit) => unit.rights_profile_id).filter((profile) => profile !== null))
    ]
    const availableProfiles = z
      .array(z.object({ id: z.string().min(1), is_active: z.boolean() }))
      .parse(
        (
          await client.query("SELECT id,is_active FROM legislation.legal_rights_profiles WHERE id=ANY($1::text[])", [
            rightsProfiles
          ])
        ).rows
      )
    const activeProfiles = new Set(
      availableProfiles.filter((profile) => profile.is_active).map((profile) => profile.id)
    )
    const rightsUnavailable = units.filter(
      (unit) =>
        unit.state === "published" && (unit.rights_profile_id === null || !activeProfiles.has(unit.rights_profile_id))
    ).length
    for (const profile of activeProfiles) {
      await requireRights(client, profile, "displayText")
      await requireRights(client, profile, "localSearch")
    }
    const dispatches = z
      .array(dispatchSchema)
      .max(300)
      .parse(
        (
          await client.query(
            `SELECT unit_key,stage,completed_at,
           COALESCE(lease_token IS NOT NULL AND lease_expires_at>transaction_timestamp(),false) lease_active,
           COALESCE(last_error='submission_uncertain',false) submission_uncertain,
           COALESCE(last_error='completed_without_stage_advance',false) remote_state_mismatch,
           (SELECT count(*)::integer FROM jsonb_array_elements(run_history) history
             WHERE history->>'status' IN ('CRASHED','EXPIRED','FAILED','SYSTEM_FAILURE','TIMED_OUT')) failed_attempts,
           (SELECT count(*)::integer FROM jsonb_array_elements(run_history) history
             WHERE history->>'status'='CANCELED') cancelled_attempts
           FROM legislation.legal_discovery_dispatches WHERE manifest_id=$1 ORDER BY unit_key,stage`,
            [input.manifestId]
          )
        ).rows
      )
    const expectedKeys = manifest.units.map((unit) => unit.key).sort()
    const actualKeys = units.map((unit) => unit.unit_key)
    const missingUnits = expectedKeys.filter((key) => !actualKeys.includes(key))
    const unexpectedUnits = actualKeys.filter((key) => !expectedKeys.includes(key))
    const exactInventory = missingUnits.length === 0 && unexpectedUnits.length === 0
    const stateCounts = Object.fromEntries(unitStateSchema.options.map((state) => [state, 0])) as Record<
      z.infer<typeof unitStateSchema>,
      number
    >
    for (const unit of units) stateCounts[unit.state] += 1
    const dispatchByUnit = new Map<string, Set<string>>()
    const stageCounts = Object.fromEntries(stages.map((stage) => [stage, 0])) as Record<
      z.infer<typeof legalDiscoveryStageSchema>,
      number
    >
    let completedDispatches = 0
    let activeDispatches = 0
    let submissionUncertain = 0
    let remoteStateMismatch = 0
    let failedAttempts = 0
    let cancelledAttempts = 0
    for (const dispatch of dispatches) {
      stageCounts[dispatch.stage] += 1
      if (dispatch.completed_at !== null) completedDispatches += 1
      if (dispatch.lease_active) activeDispatches += 1
      if (dispatch.submission_uncertain) submissionUncertain += 1
      if (dispatch.remote_state_mismatch) remoteStateMismatch += 1
      failedAttempts += dispatch.failed_attempts
      cancelledAttempts += dispatch.cancelled_attempts
      const registered = dispatchByUnit.get(dispatch.unit_key) ?? new Set<string>()
      registered.add(dispatch.stage)
      dispatchByUnit.set(dispatch.unit_key, registered)
    }
    const publishedMissingStages = units.filter(
      (unit) =>
        unit.state === "published" &&
        stages.some((stage) => !(dispatchByUnit.get(unit.unit_key) ?? new Set<string>()).has(stage))
    ).length
    const publishedMissingCanonical = units.filter(
      (unit) =>
        unit.state === "published" &&
        (unit.artifact_hash === null ||
          unit.parser_hash === null ||
          unit.publication_generation_id === null ||
          unit.edition_id === null)
    ).length
    const lexicalMissing = units.filter((unit) => unit.state === "published" && unit.lexical_state === null).length
    const lexicalPending = units.filter((unit) => unit.lexical_state === "pending").length
    const lexicalDelayed = units.filter((unit) => unit.lexical_delayed).length
    const lexicalAcknowledged = units.filter((unit) => unit.lexical_state === "acknowledged").length
    const terminalUnits = stateCounts.published + stateCounts.quarantined
    const incompleteDispatches = dispatches.length - completedDispatches
    const accounted =
      exactInventory &&
      terminalUnits === expectedKeys.length &&
      incompleteDispatches === 0 &&
      publishedMissingStages === 0
    const ready =
      accounted &&
      expectedKeys.length > 0 &&
      stateCounts.published === expectedKeys.length &&
      stateCounts.quarantined === 0 &&
      dispatches.length === expectedKeys.length * stages.length &&
      publishedMissingCanonical === 0 &&
      lexicalMissing === 0 &&
      lexicalDelayed === 0 &&
      submissionUncertain === 0 &&
      remoteStateMismatch === 0 &&
      rightsUnavailable === 0 &&
      activeDispatches === 0
    await client.query("COMMIT")
    return {
      manifestId: manifest.id,
      sourceId: manifest.sourceId,
      scopeKey: manifest.scopeKey,
      expectedUnits: expectedKeys.length,
      actualUnits: actualKeys.length,
      exactInventory,
      missingUnits,
      unexpectedUnits,
      units: stateCounts,
      dispatch: {
        registered: dispatches.length,
        completed: completedDispatches,
        incomplete: incompleteDispatches,
        active: activeDispatches,
        submissionUncertain,
        remoteStateMismatch,
        failedAttempts,
        cancelledAttempts,
        stages: stageCounts,
        publishedMissingStages
      },
      publication: { missingCanonical: publishedMissingCanonical },
      lexical: {
        missing: lexicalMissing,
        pending: lexicalPending,
        delayed: lexicalDelayed,
        acknowledged: lexicalAcknowledged
      },
      rights: { profiles: rightsProfiles.length, unavailable: rightsUnavailable },
      accounted,
      ready,
      canonicalWrites: false as const,
      dispatched: false as const
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
