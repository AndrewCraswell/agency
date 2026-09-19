import { createHash } from "node:crypto"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { scraperBillProfiles } from "./scraper-bill-profiles.js"
import { washingtonEventWindow } from "./scraper-event-window.js"

const revision = "d43f853796ceeeb49205f7d144790647764ce105"
const runIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,100}$/)
const artifactPath = z.string().regex(/^_data\/(nc|ak|wa)\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.json$/)

/** The filesystem reader and immutable manifest must admit exactly the same portable data paths. */
export function isScraperDataArtifactPath(path: string) {
  return artifactPath.safeParse(path).success
}

const fileSchema = z.strictObject({
  path: artifactPath,
  bytes: z
    .number()
    .int()
    .nonnegative()
    .max(64 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
})
const requestSchema = z
  .strictObject({
    jurisdiction: z.enum(["nc", "ak", "wa"]),
    domain: z.enum(["bills", "events"]),
    session: z
      .string()
      .regex(/^(\d{4}(E\d+)?|34|2025-2026)$/)
      .nullable(),
    timeout_seconds: z.number().int().min(1).max(1500),
    // Older immutable canary evidence predates batching; this reader does not authorize execution.
    bill_ids: z.array(z.string().min(1)).min(1).max(10).nullable().optional(),
    revision: z.literal(revision),
    event_window: washingtonEventWindow.optional(),
    event_keys: z
      .array(z.string().regex(/^[HSJ]:[A-Z0-9&]+:[0-9T:+.-]+$/))
      .min(1)
      .max(10)
      .optional()
  })
  .refine((request) =>
    request.domain === "bills" || request.jurisdiction !== "nc" ? request.session !== null : request.session === null
  )
  .refine((request) =>
    request.jurisdiction === "wa"
      ? request.session === scraperBillProfiles.wa.session &&
        (request.domain === "bills"
          ? !!request.bill_ids?.every((id) => scraperBillProfiles.wa.identifier.test(id))
          : request.bill_ids === null && request.event_window !== undefined)
      : request.jurisdiction === "ak"
        ? request.session === "34" &&
          (request.domain === "events"
            ? request.bill_ids === null &&
              request.event_keys !== undefined &&
              new Set(request.event_keys).size === request.event_keys.length
            : !!request.bill_ids?.every((id) => /^[HS](?:B|R|JR|J|CR|SC|SCR)[1-9][0-9]{0,4}$/.test(id)))
        : request.session !== "34" &&
          request.session !== "2025-2026" &&
          (request.bill_ids?.every((id) => scraperBillProfiles.nc.identifier.test(id)) ?? true)
  )
  .refine(
    (request) => request.event_window === undefined || (request.jurisdiction === "wa" && request.domain === "events")
  )
  .refine(
    (request) => request.event_keys === undefined || (request.jurisdiction === "ak" && request.domain === "events")
  )
  .refine(
    (request) =>
      request.bill_ids === undefined ||
      (request.domain === "events"
        ? request.bill_ids === null
        : request.bill_ids !== null &&
          new Set(request.bill_ids).size === request.bill_ids.length &&
          new Set(request.bill_ids.map((id) => id[0])).size === 1)
  )
const resultSchema = z
  .strictObject({
    status: z.enum(["extracted", "failed", "timed_out", "rejected"]),
    exit_code: z.number().int().nullable(),
    revision: z.literal(revision),
    canonical_writes: z.literal(false),
    // Historical evidence remains readable, but a missing fingerprint is never trusted for corrected clocks.
    build_inputs_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    request: requestSchema,
    reason: z
      .enum([
        "execution_deadline",
        "process_start_or_wait_failed",
        "source_timeout",
        "source_tls_failure",
        "source_http_failure",
        "source_http_rate_limited",
        "source_http_access_denied",
        "source_http_not_found",
        "source_http_server_error",
        "source_parse_failure",
        "source_validation_failure",
        "subprocess_failure",
        "missing_output",
        "linked_output",
        "unexpected_output",
        "output_size_limit",
        "output_file_limit",
        "output_unreadable"
      ])
      .nullable(),
    files: z.array(fileSchema).max(100_000),
    semantically_validated: z.literal(false)
  })
  .superRefine((attempt, context) => {
    if (attempt.files.some((file) => !file.path.startsWith(`_data/${attempt.request.jurisdiction}/`))) {
      context.addIssue({ code: "custom", message: "Cross-jurisdiction scraper inventory" })
    }
    if (
      new Set(attempt.files.map((file) => file.path)).size !== attempt.files.length ||
      attempt.files.reduce((sum, file) => sum + file.bytes, 0) > 2 * 1024 * 1024 * 1024
    ) {
      context.addIssue({ code: "custom", message: "Invalid scraper file inventory" })
    }
    if (
      attempt.status === "extracted" &&
      (attempt.exit_code !== 0 || attempt.reason !== null || attempt.files.length === 0)
    ) {
      context.addIssue({ code: "custom", message: "Inconsistent scraper success" })
    }
  })
const retainedSchema = z.strictObject({ runId: runIdSchema, attempt: resultSchema })

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}
function parseJson(bytes: Uint8Array) {
  const value: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"))
  return value
}
function checked(bytes: Uint8Array, entry: z.infer<typeof fileSchema>) {
  if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
    throw new Error("Scraper artifact checksum mismatch")
  }
  return bytes
}

/** Retain evidence only. An archive marker is never permission to promote canonical data. */
export async function archiveScraperAttempt(source: Pick<ArtifactStore, "read">, target: ArtifactStore, runId: string) {
  runIdSchema.parse(runId)
  // The machine-local work path is never trusted for reads or exposed in the retained manifest.
  const input = z
    .object({ work_directory: z.string() })
    .passthrough()
    .parse(parseJson(await source.read("attempt.json")))
  const { work_directory: _workDirectory, ...rest } = input
  const attempt = resultSchema.parse(rest)
  const prefix = `openstates/scrapers/${revision}/${attempt.request.jurisdiction}/${attempt.request.domain}/${runId}`
  // Validate the complete inventory before publishing any completion marker; uploads can be retried.
  for (const entry of attempt.files) {
    checked(await source.read(entry.path), entry)
  }
  for (const entry of attempt.files) {
    const bytes = checked(await source.read(entry.path), entry)
    const path = `${prefix}/files/${entry.path}`
    await target.put(path, bytes)
    checked(await target.read(path), entry)
  }
  const manifestPath = `${prefix}/retained.json`
  const bytes = Buffer.from(JSON.stringify({ runId, attempt }))
  await target.put(manifestPath, bytes)
  if (digest(await target.read(manifestPath)) !== digest(bytes)) {
    throw new Error("Scraper attempt archive conflict")
  }
  return { manifestPath, status: attempt.status, files: attempt.files.length, canonicalWrites: false as const }
}

export async function readArchivedScraperAttempt(store: Pick<ArtifactStore, "read">, manifestPath: string) {
  const match =
    /^openstates\/scrapers\/([a-f0-9]{40})\/(nc|ak|wa)\/(bills|events)\/([a-zA-Z0-9][a-zA-Z0-9-]{0,100})\/retained\.json$/.exec(
      manifestPath
    )
  if (!match || match[1] !== revision) {
    throw new Error("Invalid scraper archive path")
  }
  const manifestBytes = await store.read(manifestPath)
  const manifest = retainedSchema.parse(parseJson(manifestBytes))
  if (
    manifest.runId !== match[4] ||
    manifest.attempt.request.domain !== match[3] ||
    manifest.attempt.request.jurisdiction !== match[2]
  ) {
    throw new Error("Scraper archive identity mismatch")
  }
  const prefix = manifestPath.slice(0, -"retained.json".length)
  const records: Array<{ path: string; value: unknown }> = []
  for (const entry of manifest.attempt.files) {
    const bytes = checked(await store.read(`${prefix}files/${entry.path}`), entry)
    records.push({ path: entry.path, value: parseJson(bytes) })
  }
  return { ...manifest, manifestSha256: digest(manifestBytes), records }
}
