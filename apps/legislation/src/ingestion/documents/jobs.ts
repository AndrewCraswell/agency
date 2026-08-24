import { createHash } from "node:crypto"
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { billDocuments, bills } from "../../db/schema/schema.js"
import { jurisdictionId } from "../../legislation/identifiers.js"
import { createJobCounts, mapConcurrent, type JobCounts } from "../job.js"
import { supportedOpenStatesJurisdictions } from "../openstates/coverage.js"
import { artifactPath, type ArtifactStore } from "./artifact-store.js"
import { detectDocumentContentType, downloadDocument } from "./download.js"
import { DocumentHostLeaseDeferredError, type DocumentHostLimiter } from "./host-limiter.js"
import { createPdfExtractionLimiter } from "./pdf-extraction-limiter.js"
import {
  classifyDocumentFailure,
  deferDocumentProcessing,
  markDocumentProcessingFailure,
  persistProcessedDocument,
  type DocumentFailureCategory
} from "./process.js"

const MAX_REPORTED_FAILURES = 20
const MAX_UPDATE_BATCH_SIZE = 1000
const RETRY_BASE_DELAY_MS = 5 * 60 * 1000
const RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000

/**
 * The 64 document lanes reserve one distinct lane for every canonical state,
 * district, territory, and federal jurisdiction presently in the corpus.
 * This keeps a large publisher such as California from sharing a worker with
 * another known jurisdiction. Unknown future jurisdictions use only the
 * remaining lanes, so they cannot collide with the reserved canonical lanes.
 */
export const DOCUMENT_BACKFILL_SHARD_COUNT = 64
const canonicalDocumentBackfillJurisdictionIds = [
  ...supportedOpenStatesJurisdictions.map((code) => jurisdictionId(code)),
  jurisdictionId("us")
] as const
const unknownDocumentBackfillLaneStart = canonicalDocumentBackfillJurisdictionIds.length
const unknownDocumentBackfillLaneCount = DOCUMENT_BACKFILL_SHARD_COUNT - unknownDocumentBackfillLaneStart

if (unknownDocumentBackfillLaneCount < 1) {
  throw new Error("Document backfill lanes must reserve capacity for unknown jurisdictions")
}

const documentBackfillLaneByJurisdictionId = new Map(
  canonicalDocumentBackfillJurisdictionIds.map((id, lane) => [id, lane])
)

/** Canonical jurisdiction IDs with dedicated 64-lane document workers. */
export const documentBackfillCanonicalJurisdictionIds = [...canonicalDocumentBackfillJurisdictionIds]

/**
 * Resolves the deterministic 64-lane assignment used by document backfills.
 * The SQL predicate below uses PostgreSQL's hash for unknown values; both
 * paths deliberately constrain unknown jurisdictions to the unreserved range.
 */
export function documentBackfillJurisdictionLane(jurisdiction: string): number {
  const knownLane = documentBackfillLaneByJurisdictionId.get(jurisdiction)
  if (knownLane !== undefined) {
    return knownLane
  }
  return unknownDocumentBackfillLaneStart + (stableStringHash(jurisdiction) % unknownDocumentBackfillLaneCount)
}

export const DOCUMENT_REMEDIATION_COHORTS = [
  "alaska-pdf-label",
  "arkansas-ftp",
  "california-bill-pdf",
  "colorado-legacy-acquia",
  "connecticut-ftp",
  "connecticut-tls",
  "district-of-columbia-lims-download",
  "hawaii-data-archive",
  "image-ocr",
  "image-ocr-missing-artifact",
  "image-ocr-stale-artifact",
  "inaccessible-hosts",
  "illinois-beta-host",
  "michigan-document-redirect",
  "michigan-tls",
  "minnesota-senate-resolutions",
  "mississippi-tls",
  "nebraska-rate-limited",
  "new-hampshire-legacy-amendments",
  "office-open-xml",
  "oklahoma-legacy-archive",
  "ohio-legislature-tls",
  "pennsylvania-fiscal-notes",
  "pennsylvania-legacy-bill-text",
  "rhode-island-legacy-bill-text",
  "texas-legacy-witness-list",
  "vermont-legacy-assets",
  "vermont-tls",
  "west-virginia-legacy-origin"
] as const
export type DocumentRemediationCohort = (typeof DOCUMENT_REMEDIATION_COHORTS)[number]

export interface DocumentJobResult {
  counts: JobCounts & { processed: number; unsupported: number }
  deferred?: number
  failures: Array<
    Readonly<{ category: DocumentFailureCategory; identifier?: string; message: string; retryable: boolean }>
  >
  ocrDocumentIds?: string[]
}

export function documentRetryAt(attempt: number, from = new Date()): Date {
  const exponent = Math.max(0, Math.min(attempt - 1, 30))
  const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS)
  return new Date(from.getTime() + delay)
}

/**
 * The legacy California publisher does not expose PDFs for these complete
 * pre-1999 session ranges. A live bounded sample returned the publisher
 * navigation page instead of a PDF. A failure becomes terminal only when the
 * same bill already has processed official billNavClient text; the remaining
 * records retain their retry path. This update is bounded and uses SKIP LOCKED
 * so parallel derived shards can safely run it.
 */
export async function classifyKnownUnavailableCaliforniaBillPdfs(
  database: Pick<LegislationDatabase, "execute">,
  limit = 10_000
): Promise<{ classified: number; identifiers: string[] }> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100_000)
  const result = await database.execute<{ classified: number; identifiers: string[] }>(sql`
    with candidates as materialized (
      select id
      from legislation.bill_documents failed_documents
      where failed_documents.processing_status = 'failed'
        and failed_documents.processing_error_category = 'download-transient'
        and failed_documents.source_url like 'https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?%'
        and failed_documents.bill_id ~ '^bill:ca:(19891990|19911992|19931994|19951996|19971998):'
        and exists (
          select 1
          from legislation.bill_documents alternate_documents
          where alternate_documents.bill_id = failed_documents.bill_id
            and alternate_documents.processing_status = 'processed'
            and alternate_documents.source_url like 'https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?%'
        )
      order by failed_documents.id
      limit ${boundedLimit}
      for update skip locked
    ), updated as (
      update legislation.bill_documents documents
      set next_attempt_at = null,
        processing_error = 'California publisher has no downloadable PDF for this pre-1999 session',
        processing_error_category = 'not-found',
        processing_status = 'unsupported',
        updated_at = now()
      from candidates
      where documents.id = candidates.id
      returning documents.id
    )
    select count(*)::int as classified,
      coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
    from updated
  `)
  return result.rows[0] ?? { classified: 0, identifiers: [] }
}

export async function prepareDocumentRemediation(
  database: LegislationDatabase,
  cohort: DocumentRemediationCohort,
  limit = 10_000
): Promise<{ identifiers: string[]; prepared: number }> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100_000)
  let result
  if (cohort === "california-bill-pdf") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
          with candidates as materialized (
            select id
            from legislation.bill_documents
            where source_url like 'https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?%'
              and (
                (
                  processing_status = 'processed'
                  and (
                    lower(btrim(coalesce(text, ''))) = 'download bill pdf'
                    or lower(coalesce(text, '')) like '%for full functionality of this site it is necessary to enable javascript%california legislative information%'
                  )
                )
                or (
                  processing_status = 'unsupported'
                  and (
                    coalesce(processing_error, '') ilike '%invalid pdf structure%'
                    or coalesce(processing_error, '') ilike '%publisher navigation%'
                  )
                )
              )
            limit ${boundedLimit}
            for update skip locked
          ), removed_sections as (
            delete from legislation.document_sections sections
            using candidates
            where sections.document_id = candidates.id
          ), updated as (
            update legislation.bill_documents documents
            set blob_path = null,
              content_hash = null,
              content_type = null,
              last_attempt_at = null,
              next_attempt_at = null,
              processing_attempts = 0,
              processing_error = null,
              processing_error_category = null,
              ocr_provider = null,
              ocr_completed_at = null,
              ocr_page_count = null,
              ocr_status = null,
              processing_status = 'pending',
              text = null,
              updated_at = now()
            from candidates
            where documents.id = candidates.id
            returning documents.id
          )
          select count(*)::int as prepared,
            coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
          from updated
        `)
  } else if (cohort === "alaska-pdf-label") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and (
                  lower(coalesce(content_type, '')) = 'pdf'
                  or processing_error ilike '%unsupported document content type: pdf%'
                )
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "arkansas-ftp") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsafe-url'
                and lower(source_url) like 'ftp://www.arkleg.state.ar.us/bills/%'
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
          select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "connecticut-ftp") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Keep the OpenStates-discovered FTP URL as document identity. The
            -- downloader maps only this fully observed legacy route grammar to
            -- Connecticut's official HTTPS archive at request time.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsafe-url'
                and source_url ~ '^ftp://ftp\.cga\.ct\.gov/(2017|2018)/tob/[hs]/[0-9]{4}[A-Z]{2}-[0-9]{5}-R[0-9]{2}-(HB|SB)\.htm$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "connecticut-tls") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- The server omits its issuing intermediate. Only reset the exact
            -- retryable fetch cohort served by the official HTTPS hostname.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^https://www\.cga\.ct\.gov/'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "colorado-legacy-acquia") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve the OpenStates URL as identity while requesting the
            -- same proven attachment path from Colorado's current host.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and lower(coalesce(processing_error, '')) like '%fetch failed%'
                and source_url ~* '^http://coga\\.prod\\.acquia-sites\\.com/sites/default/files/html-attachments/[^?#]+\\.pdf$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "district-of-columbia-lims-download") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve the provider URL as identity. The downloader changes
            -- only the retired LIMS hostname at request time and validates the
            -- publisher's legacy redirect before fetching from the live host.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'Document download failed with HTTP 522'
                and source_url ~* '^https?://lims\.dccouncil\.us/(Download/[0-9]+/[A-Za-z0-9][A-Za-z0-9._-]*\.pdf|downloads/LIMS/[0-9]+/([A-Za-z0-9][A-Za-z0-9._-]*/)+[A-Za-z0-9][A-Za-z0-9._-]*\.pdf)$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "illinois-beta-host") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- beta.ilga.gov was retired. The downloader retains this
            -- OpenStates URL as identity while requesting the equivalent
            -- path and query from the current official ilga.gov host.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^https?://beta\\.ilga\\.gov/'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "mississippi-tls") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve the original HTTP OpenStates pointer. The downloader
            -- already upgrades it to HTTPS; this exact document grammar
            -- excludes malformed docnotfound and root links.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^http://billstatus\.ls\.state\.ms\.us/documents/[0-9]{4}([12]E)?/(html|pdf)/[^?#]+\.(htm|pdf)$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "ohio-legislature-tls") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- The official Ohio host omits its Sectigo issuer. The downloader
            -- supplies that public intermediate only for this host; reset the
            -- observed numeric download-key route and retain source identity.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^https://www\\.legislature\\.ohio\\.gov//?download\\?key=[0-9]+$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "pennsylvania-legacy-bill-text") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- The legacy official endpoint still serves HTML and PDF bill
            -- texts. Exclude DOC: its current Palegis artifact is binary Word
            -- and needs an importer, not a retry.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~* '^https?://www\\.legis\\.state\\.pa\\.us/CFDOCS/Legis/PN/Public/btCheck\\.cfm\\?[^#]*'
                and source_url ~* '[?&]txtType=(HTM|PDF)(&|$)'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "pennsylvania-fiscal-notes") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- These first-party House and Senate fiscal-note PDFs remain
            -- available from the exact observed Pennsylvania session archive
            -- grammars.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^https?://www\\.legis\\.state\\.pa\\.us/WU01/LI/BI/(FN|SFN)/20[0-9]{2}/[0-9]+/[A-Z]{1,3}[0-9]+P[0-9]+\\.pdf$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "minnesota-senate-resolutions") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsafe-url'
                and processing_error = 'Document fetch failed (TypeError: Document redirect changed to an unsupported protocol)'
                and (
                  source_url ~ '^https://www\\.revisor\\.mn\\.gov/bills/text\\.php\\?number=SR[0-9]+&version=0&session=ls[0-9]{2}&session_year=(19|20)[0-9]{2}&session_number=[0-9]+&type=resolution(&format=pdf)?$'
                  or source_url ~ '^https://www\\.revisor\\.mn\\.gov/bills/[0-9]{2}/(19|20)[0-9]{2}/[0-9]+/SR/[0-9]+/versions/(resolution/)?0(/pdf)?/$'
                )
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "nebraska-rate-limited") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- These records exhausted their attempts before Nebraska's exact
            -- host was reduced to one request every five seconds. Retry only
            -- the publisher's explicit rate-limit responses under that
            -- durable host policy.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'Document download failed with HTTP 429'
                and source_url ~ '^https?://nebraskalegislature\\.gov/'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "new-hampshire-legacy-amendments") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Requeue only stable amendment identifiers. Numeric bill-text
            -- IDs are intentionally excluded because the publisher now
            -- returns documents for different bills under those old IDs.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and (
                  processing_error in ('fetch failed', 'The operation was aborted due to timeout')
                  or processing_error like 'Document fetch failed (%UND_ERR_SOCKET:%other side closed%)'
                )
                and (
                  source_url ~ '^http://www\\.gencourt\\.state\\.nh\\.us/bill_status/billText\\.aspx\\?sy=(2017|2018|2019|2020)&id=(2017|2018|2019|2020)-[0-9]{4}[hse]&txtFormat=amend$'
                  or source_url ~ '^http://www\\.gencourt\\.state\\.nh\\.us/bill_status/legacy/bs2016/billText\\.aspx\\?sy=(2021|2022)&id=(2021|2022)-[0-9]{4}[hse]&txtFormat=amend$'
                )
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "oklahoma-legacy-archive") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve OpenStates' retired hostname as document identity. The
            -- downloader rewrites only this observed session PDF archive to
            -- Oklahoma's current official Legislature host at request time.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^http://webserver1\.lsb\.state\.ok\.us/cf_pdf/[0-9]{4}-[0-9]{2}[^?#]*\.PDF$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "rhode-island-legacy-bill-text") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Keep the original legacy hostname as document identity. The
            -- downloader bypasses its invalid certificate by using only the
            -- matching General Assembly BillText archive route.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^http://webserver\.rilin\.state\.ri\.us/BillText/BillText([0-9]{2})/(House|Senate)Text\\1/[A-Za-z0-9_-]+\.pdf$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "west-virginia-legacy-origin") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve the OpenStates-discovered legacy URL as document
            -- identity. The downloader rewrites only these three proven
            -- West Virginia archive trees to the current official host.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^http://www\.legis\.state\.wv\.us/(Bill_Status|Bill_Text_HTML|legisdocs)/[^#]+$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "texas-legacy-witness-list") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve the OpenStates FTP URL as document identity. The
            -- downloader maps only this proven witness-list archive grammar
            -- to the equivalent official capitol.texas.gov artifact.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsafe-url'
                and processing_error = 'Document URL must use HTTPS'
                and source_url ~* '^ftp://ftp\.legis\.state\.tx\.us/bills/[0-9]{2}(R|[0-9])/witlistbill/html/(house|senate)_(bills|concurrent_resolutions|joint_resolutions|resolutions)/(HB|SB|HC|SC|HJ|SJ|HR|SR)[0-9]{5}_(HB|SB|HC|SC|HJ|SJ|HR|SR)[0-9]{5}/(HB|SB|HC|SC|HJ|SJ|HR|SR)[0-9]{5}[A-Za-z0-9_-]*\.(htm|html)$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "michigan-document-redirect") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Michigan's document endpoint redirects to the official artifact.
            -- Preserve the original OpenStates URL as identity and retry only
            -- the exact GetObject PDF cohort terminalized before redirects were
            -- followed by the trusted-intermediate transport.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'download-permanent'
                and processing_error = 'Document download failed with HTTP 302'
                and source_url ~* '^https://(www\\.)?legislature\\.mi\\.gov/Home/GetObject\\?objectName=[A-Za-z0-9_-]+\\.pdf$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "michigan-tls") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Michigan's official hosts omit the DigiCert intermediate. Keep
            -- the OpenStates URL as identity; the downloader upgrades HTTP
            -- and supplies the public issuer only for these exact hosts.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^https?://(www\\.)?legislature\\.mi\\.gov/'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "vermont-tls") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Vermont's official host omits the GlobalSign intermediate. Do
            -- not rewrite the source URL; reset only the observed TLS cohort.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'failed'
                and processing_error_category = 'download-transient'
                and processing_error = 'fetch failed'
                and source_url ~ '^https?://legislature\\.vermont\\.gov/'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "vermont-legacy-assets") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Vermont retired only the /assets prefix. The downloader maps the
            -- exact session document tree to /Documents, without rewriting
            -- source_url, so reset only its terminal 404 outcome.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'not-found'
                and processing_error = 'Document download failed with HTTP 404'
                and source_url ~ '^https://legislature\\.vermont\\.gov/assets/Documents/(19|20)[0-9]{2}/Docs/'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "hawaii-data-archive") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Preserve the URL discovered in the OpenStates archive. It is part
            -- of the deterministic document identity and must survive a fresh
            -- archive replay unchanged. The downloader resolves this legacy
            -- pointer to Hawaii's official data mirror at request time.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'download-permanent'
                and processing_error ~* 'document download failed with http 403'
                and source_url ~* '^https://(?:www\\.)?capitol\\.hawaii\\.gov/(?:sessions/)?session(?:19|20)[0-9]{2}/(?:bills|commreports|testimony)/[A-Za-z0-9][A-Za-z0-9._-]*\\.(?:htm|html|pdf)$'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "office-open-xml") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'unsupported-format'
                and (
                  lower(coalesce(content_type, '')) in (
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  )
                  or coalesce(processing_error, '') ~* 'unsupported document content type: application/vnd\\.openxmlformats-officedocument\\.(presentationml\\.presentation|spreadsheetml\\.sheet|wordprocessingml\\.document)'
                )
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "image-ocr-missing-artifact") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- Older workers classified image responses before persisting their
            -- source bytes. Re-run only OCR-required image rows that still
            -- lack a Blob artifact; the current downloader stores the bytes
            -- before classification and hands the resulting ID to OCR.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'ocr-required'
                and blob_path is null
                and coalesce(processing_error, '') ~* 'unsupported document content type: (image/)?(gif|jpe?g|png|tiff?|bmp|webp)'
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else if (cohort === "image-ocr-stale-artifact") {
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            -- The final OCR sweep proved that these legacy Blob references do
            -- not exist. Return only the exact attempt-eight, blank-error
            -- cohort to document download; current OCR workers self-heal a
            -- future typed ArtifactNotFoundError without operator repair.
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status = 'unsupported'
                and processing_error_category = 'ocr-required'
                and blob_path is not null
                and processing_attempts = 8
                and coalesce(processing_error, '') = ''
              order by id
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set blob_path = null,
                content_hash = null,
                text = null,
                last_attempt_at = null,
                next_attempt_at = null,
                processing_attempts = 0,
                processing_error = null,
                processing_error_category = null,
                processing_status = 'pending',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  } else {
    const terminalCategory = cohort === "image-ocr" ? "ocr-required" : "source-inaccessible"
    const terminalSelection =
      cohort === "image-ocr"
        ? sql`(
            coalesce(processing_error, '') ilike '%image-only%'
            or lower(coalesce(content_type, '')) like 'image/%'
            or coalesce(processing_error, '') ~* 'unsupported document content type: (image/)?(gif|jpe?g|png|tiff?|bmp|webp)'
          )`
        : sql`lower(split_part(split_part(source_url, '://', 2), '/', 1)) = 'alisondb.legislature.state.al.us'`
    result = await database.execute<{ identifiers: string[]; prepared: number }>(sql`
            with candidates as materialized (
              select id
              from legislation.bill_documents
              where processing_status in ('failed', 'unsupported')
                and processing_error_category is distinct from ${terminalCategory}
                and ${terminalSelection}
              limit ${boundedLimit}
              for update skip locked
            ), updated as (
              update legislation.bill_documents documents
              set next_attempt_at = null,
                processing_error_category = ${terminalCategory},
                processing_status = 'unsupported',
                updated_at = now()
              from candidates
              where documents.id = candidates.id
              returning documents.id
            )
            select count(*)::int as prepared,
              coalesce((array_agg(id order by id))[1:20], array[]::text[]) as identifiers
            from updated
          `)
  }
  return result.rows[0] ?? { identifiers: [], prepared: 0 }
}

export async function classifyTerminalDocumentFailures(
  database: LegislationDatabase,
  limit = 100_000
): Promise<{ inspected: number; retryable: number; terminal: number; updated: number }> {
  const records = await database
    .select({
      id: billDocuments.id,
      processingError: billDocuments.processingError,
      sourceUrl: billDocuments.sourceUrl
    })
    .from(billDocuments)
    .where(
      and(
        inArray(billDocuments.processingStatus, ["failed", "unsupported"]),
        isNull(billDocuments.processingErrorCategory),
        isNotNull(billDocuments.processingError)
      )
    )
    .orderBy(asc(billDocuments.id))
    .limit(Math.min(Math.max(limit, 1), 100_000))
  const classifiedByDisposition = Map.groupBy(
    records.flatMap((record) => {
      if (record.processingError === null) {
        return []
      }
      const failure = classifyDocumentFailure(record.processingError, record.sourceUrl)
      return [{ category: failure.category, id: record.id, retryable: failure.retryable }]
    }),
    (record) => `${record.retryable ? "retryable" : "terminal"}:${record.category}`
  )
  let updated = 0
  let retryable = 0
  let terminal = 0
  for (const recordsForDisposition of classifiedByDisposition.values()) {
    const first = recordsForDisposition[0]
    if (first === undefined) {
      continue
    }
    const ids = recordsForDisposition.map((record) => record.id)
    for (let offset = 0; offset < ids.length; offset += MAX_UPDATE_BATCH_SIZE) {
      const batch = ids.slice(offset, offset + MAX_UPDATE_BATCH_SIZE)
      await database
        .update(billDocuments)
        .set({
          nextAttemptAt: null,
          processingErrorCategory: first.category,
          processingStatus: first.retryable ? "failed" : "unsupported",
          updatedAt: new Date()
        })
        .where(inArray(billDocuments.id, batch))
      updated += batch.length
      if (first.retryable) {
        retryable += batch.length
      } else {
        terminal += batch.length
      }
    }
  }
  return { inspected: records.length, retryable, terminal, updated }
}

export async function requeueInterruptedDocuments(
  database: LegislationDatabase,
  before: Date,
  limit = 1_000,
  shard: Readonly<{ count: number; index: number }> = { count: 1, index: 0 },
  scope: Readonly<{
    documentPartitionCount?: number
    documentPartitionIndex?: number
    jurisdictionId?: string
  }> = {},
  after = new Date(0)
): Promise<number> {
  const boundedLimit = Math.min(Math.max(limit, 1), 10_000)
  const result = await database.execute<{ requeued: number }>(sql`
    with candidates as materialized (
      select id
      from legislation.bill_documents
      where processing_status = 'processing'
        and last_attempt_at >= ${after}
        and last_attempt_at < ${before}
        and ${documentJurisdictionSelection(scope.jurisdictionId) ?? sql`true`}
        and ${documentJurisdictionShardSelection(shard.count, shard.index) ?? sql`true`}
        and ${documentIdPartitionSelection(scope.documentPartitionCount, scope.documentPartitionIndex) ?? sql`true`}
      order by last_attempt_at
      limit ${boundedLimit}
      for update skip locked
    ), requeued as (
      update legislation.bill_documents
      set next_attempt_at = null,
        processing_attempts = greatest(processing_attempts - 1, 0),
        processing_error = null,
        processing_error_category = null,
        ocr_provider = null,
        ocr_completed_at = null,
        ocr_page_count = null,
        ocr_status = null,
        processing_status = 'pending',
        updated_at = now()
      from candidates
      where legislation.bill_documents.id = candidates.id
      returning legislation.bill_documents.id
    )
    select count(*)::int as requeued from requeued
  `)
  return result.rows[0]?.requeued ?? 0
}

export async function nextDocumentBackfillAttempt(
  database: LegislationDatabase,
  options: Readonly<{
    interruptedDocumentRecoveryAfter?: Date
    interruptedDocumentRecoveryDelayMs?: number
    documentPartitionCount?: number
    documentPartitionIndex?: number
    jurisdictionId?: string
    maximumAttempts: number
    shardCount: number
    shardIndex: number
  }>
): Promise<Readonly<{ hasWork: boolean; nextAttemptAt?: Date }>> {
  const records = await database
    .select({ nextAttemptAt: billDocuments.nextAttemptAt })
    .from(billDocuments)
    .where(
      and(
        inArray(billDocuments.processingStatus, ["pending", "failed"]),
        lt(billDocuments.processingAttempts, options.maximumAttempts),
        documentJurisdictionSelection(options.jurisdictionId),
        documentJurisdictionShardSelection(options.shardCount, options.shardIndex),
        documentIdPartitionSelection(options.documentPartitionCount, options.documentPartitionIndex)
      )
    )
    .orderBy(sql`${billDocuments.nextAttemptAt} nulls first`, asc(billDocuments.updatedAt), asc(billDocuments.id))
    .limit(1)
  const record = records[0]
  if (record === undefined) {
    return nextInterruptedDocumentRecovery(database, options)
  }
  return record.nextAttemptAt === null ? { hasWork: true } : { hasWork: true, nextAttemptAt: record.nextAttemptAt }
}

async function nextInterruptedDocumentRecovery(
  database: LegislationDatabase,
  options: Readonly<{
    interruptedDocumentRecoveryAfter?: Date
    interruptedDocumentRecoveryDelayMs?: number
    documentPartitionCount?: number
    documentPartitionIndex?: number
    jurisdictionId?: string
    shardCount: number
    shardIndex: number
  }>
): Promise<Readonly<{ hasWork: boolean; nextAttemptAt?: Date }>> {
  if (
    options.interruptedDocumentRecoveryAfter === undefined ||
    options.interruptedDocumentRecoveryDelayMs === undefined
  ) {
    return { hasWork: false }
  }
  const records = await database
    .select({ lastAttemptAt: billDocuments.lastAttemptAt })
    .from(billDocuments)
    .where(
      and(
        eq(billDocuments.processingStatus, "processing"),
        isNotNull(billDocuments.lastAttemptAt),
        documentJurisdictionSelection(options.jurisdictionId),
        documentJurisdictionShardSelection(options.shardCount, options.shardIndex),
        documentIdPartitionSelection(options.documentPartitionCount, options.documentPartitionIndex)
      )
    )
    .orderBy(asc(billDocuments.lastAttemptAt), asc(billDocuments.id))
    .limit(1)
  const record = records[0]
  if (record?.lastAttemptAt === undefined || record.lastAttemptAt === null) {
    return { hasWork: false }
  }
  if (record.lastAttemptAt < options.interruptedDocumentRecoveryAfter) {
    return { hasWork: true }
  }
  return {
    hasWork: true,
    nextAttemptAt: new Date(record.lastAttemptAt.getTime() + options.interruptedDocumentRecoveryDelayMs)
  }
}

export async function processPendingDocuments(
  database: LegislationDatabase,
  options: Readonly<{
    artifactStore: ArtifactStore
    billId?: string
    concurrency: number
    documentPartitionCount?: number
    documentPartitionIndex?: number
    documentId?: string
    failureCategory?: DocumentFailureCategory
    fetch?: typeof fetch
    force?: boolean
    hostLimiter?: DocumentHostLimiter
    jurisdictionId?: string
    limit?: number
    maximumAttempts: number
    shardCount?: number
    shardIndex?: number
    status?: "failed" | "pending" | "unsupported"
    timeoutMs?: number
  }>
): Promise<DocumentJobResult> {
  const limit = Math.min(options.limit ?? 100, 1000)
  const claimStartedAt = new Date()
  let processingSelection = inArray(billDocuments.processingStatus, ["pending", "failed"])
  if (options.documentId !== undefined) {
    processingSelection = eq(billDocuments.id, options.documentId)
  } else if (options.status !== undefined) {
    processingSelection = eq(billDocuments.processingStatus, options.status)
  }
  const records = await database.transaction(async (transaction) => {
    const selected = await transaction
      .select({
        blobPath: billDocuments.blobPath,
        contentType: billDocuments.contentType,
        id: billDocuments.id,
        processingAttempts: billDocuments.processingAttempts,
        processingStatus: billDocuments.processingStatus,
        sourceUrl: billDocuments.sourceUrl
      })
      .from(billDocuments)
      .where(
        and(
          processingSelection,
          options.billId === undefined ? undefined : eq(billDocuments.billId, options.billId),
          documentJurisdictionSelection(options.jurisdictionId),
          options.failureCategory === undefined
            ? undefined
            : eq(billDocuments.processingErrorCategory, options.failureCategory),
          options.force === true
            ? undefined
            : and(
                or(
                  eq(billDocuments.processingStatus, "processed"),
                  lt(billDocuments.processingAttempts, options.maximumAttempts)
                ),
                or(
                  eq(billDocuments.processingStatus, "processed"),
                  isNull(billDocuments.nextAttemptAt),
                  lte(billDocuments.nextAttemptAt, claimStartedAt)
                )
              ),
          documentJurisdictionShardSelection(options.shardCount ?? 1, options.shardIndex ?? 0),
          documentIdPartitionSelection(options.documentPartitionCount, options.documentPartitionIndex)
        )
      )
      // Deferrals update the record timestamp, moving a saturated host behind
      // untouched work in the same jurisdiction shard.
      .orderBy(asc(billDocuments.processingStatus), asc(billDocuments.updatedAt), asc(billDocuments.id))
      .limit(limit)
      .for("update", { skipLocked: true })
    const claimedIds = selected
      .filter((record) => record.processingStatus !== "processed" || options.force === true)
      .map((record) => record.id)
    if (claimedIds.length > 0) {
      await transaction
        .update(billDocuments)
        .set({
          lastAttemptAt: claimStartedAt,
          nextAttemptAt: null,
          ocrCompletedAt: null,
          ocrPageCount: null,
          ocrProvider: null,
          // This worker is downloading and extracting source content, not
          // performing OCR. Keep OCR unknown until extraction identifies an
          // image-only document and transfers it to the OCR queue.
          ocrStatus: null,
          processingAttempts: sql`${billDocuments.processingAttempts} + 1`,
          processingError: null,
          processingErrorCategory: null,
          processingStatus: "processing",
          updatedAt: claimStartedAt
        })
        .where(inArray(billDocuments.id, claimedIds))
    }
    return selected
  })
  const counts = { ...createJobCounts({ discovered: records.length }), processed: 0, unsupported: 0 }
  let deferred = 0
  const failures: DocumentJobResult["failures"] = []
  const ocrDocumentIds: string[] = []
  // Retain concurrent network acquisition, but serialize PDF.js extraction in
  // each worker. A 25 MiB compressed PDF can expand substantially in PDF.js;
  // four simultaneous extractions were enough to OOM the Ohio lane.
  const pdfExtractionLimiter = createPdfExtractionLimiter()

  await mapConcurrent(records, options.concurrency, async (record) => {
    if (record.processingStatus === "processed" && options.force !== true) {
      counts.skipped += 1
      counts.unchanged += 1
      return
    }
    let persistedArtifact: { blobPath: string; contentType: string } | undefined
    try {
      const existingArtifactPath = options.force === true ? null : record.blobPath
      const hasArtifact = existingArtifactPath !== null && (await options.artifactStore.exists(existingArtifactPath))
      const downloaded = hasArtifact
        ? await options.artifactStore.read(existingArtifactPath).then((bytes) => ({
            bytes,
            contentType: detectDocumentContentType(bytes, record.contentType ?? ""),
            sourceUrl: record.sourceUrl
          }))
        : await downloadWithHostLease(options.hostLimiter, record.sourceUrl, () =>
            downloadDocument(record.sourceUrl, { fetch: options.fetch, timeoutMs: options.timeoutMs })
          )
      const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex")
      const path = artifactPath("documents", record.id, contentHash, downloaded.sourceUrl)
      if (!hasArtifact) {
        await options.artifactStore.put(path, downloaded.bytes)
      }
      persistedArtifact = { blobPath: path, contentType: downloaded.contentType }
      const outcome = await pdfExtractionLimiter.run(
        downloaded.contentType,
        async () =>
          await persistProcessedDocument(
            database,
            {
              blobPath: path,
              bytes: downloaded.bytes,
              contentType: downloaded.contentType,
              documentId: record.id
            },
            { skipUnchangedCheck: true }
          )
      )
      counts.read += 1
      if (outcome === "unchanged") {
        counts.unchanged += 1
      } else {
        counts.processed += 1
        counts.updated += 1
      }
    } catch (error) {
      if (error instanceof DocumentHostLeaseDeferredError) {
        await deferDocumentProcessing(database, record.id, documentDeferralAt(record.id))
        counts.skipped += 1
        deferred += 1
        return
      }
      const failure = classifyDocumentFailure(error, record.sourceUrl)
      const attempt = record.processingAttempts + 1
      const retryable = failure.retryable && attempt < options.maximumAttempts
      const unsupported = !failure.retryable
      await markDocumentProcessingFailure(database, record.id, {
        ...persistedArtifact,
        category: failure.category,
        nextAttemptAt: retryable ? documentRetryAt(attempt) : undefined,
        processingError: failure.message,
        status: unsupported ? "unsupported" : "failed"
      })
      counts.failed += 1
      if (unsupported) {
        counts.unsupported += 1
      }
      if (failures.length < MAX_REPORTED_FAILURES) {
        failures.push({
          category: failure.category,
          identifier: record.id,
          message: failure.message,
          retryable
        })
      }
      if (failure.category === "ocr-required") {
        ocrDocumentIds.push(record.id)
      }
    }
  })
  return { counts, deferred, failures, ocrDocumentIds }
}

/**
 * Assigns every document for a jurisdiction to exactly one shard. Sharding by
 * document ID makes historical state-prefixed IDs cluster together, causing all
 * workers to contend for the same publisher lease. At 64 lanes, each known
 * canonical jurisdiction has an explicit lane; unknown jurisdictions are
 * confined to the remaining lanes. The canonical bill foreign key makes this
 * lookup stable, and its primary-key index keeps the correlated lookup bounded
 * while bill_documents remains the locked relation.
 *
 * Targeted and unsharded calls pass one shard and retain all-documents
 * behavior.
 */
function documentJurisdictionShardSelection(shardCount: number, shardIndex: number) {
  if (shardCount === 1) {
    return undefined
  }
  if (shardCount === DOCUMENT_BACKFILL_SHARD_COUNT) {
    const knownLanes = canonicalDocumentBackfillJurisdictionIds.map(
      (jurisdiction, lane) => sql`when ${bills.jurisdictionId} = ${jurisdiction} then ${lane}`
    )
    return sql`exists (
      select 1
      from ${bills}
      where ${bills.id} = ${billDocuments.billId}
        and (
          case
            ${sql.join(knownLanes, sql.raw(" "))}
            else ${unknownDocumentBackfillLaneStart} +
              (((hashtextextended(${bills.jurisdictionId}, 0) % ${unknownDocumentBackfillLaneCount}) + ${unknownDocumentBackfillLaneCount}) % ${unknownDocumentBackfillLaneCount})
          end
        ) = ${shardIndex}
    )`
  }
  return sql`exists (
    select 1
    from ${bills}
    where ${bills.id} = ${billDocuments.billId}
      and ((hashtextextended(${bills.jurisdictionId}, 0) % ${shardCount}) + ${shardCount}) % ${shardCount} = ${shardIndex}
  )`
}

function documentJurisdictionSelection(jurisdiction: string | undefined) {
  if (jurisdiction === undefined) {
    return undefined
  }
  return sql`exists (
    select 1
    from ${bills}
    where ${bills.id} = ${billDocuments.billId}
      and ${bills.jurisdictionId} = ${jurisdiction}
  )`
}

/**
 * An opt-in exact-jurisdiction drain can divide one canonical 64-lane worker
 * into a small number of independent workers. PostgreSQL hashes the stable
 * document primary key, so every document belongs to exactly one partition
 * without changing the established jurisdiction-to-lane assignment.
 */
function documentIdPartitionSelection(partitionCount: number | undefined, partitionIndex: number | undefined) {
  if (partitionCount === undefined && partitionIndex === undefined) {
    return undefined
  }
  if (partitionCount === undefined || partitionIndex === undefined) {
    throw new Error("Document partition count and index must be configured together")
  }
  if (!Number.isSafeInteger(partitionCount) || partitionCount < 1 || partitionCount > 8) {
    throw new Error("Document partition count must be a positive integer no greater than 8")
  }
  if (!Number.isSafeInteger(partitionIndex) || partitionIndex < 0 || partitionIndex >= partitionCount) {
    throw new Error("Document partition index must be a zero-based integer smaller than partition count")
  }
  if (partitionCount === 1) {
    return undefined
  }
  return sql`(
    ((hashtextextended(${billDocuments.id}, 0) % ${partitionCount}) + ${partitionCount}) % ${partitionCount}
  ) = ${partitionIndex}`
}

function stableStringHash(value: string): number {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2_147_483_647
  }
  return hash
}

function documentDeferralAt(documentId: string, from = new Date()): Date {
  let value = 0
  for (const character of documentId) {
    value = (value * 31 + character.charCodeAt(0)) % 20_000
  }
  return new Date(from.getTime() + 5_000 + (value % 15_000))
}

async function downloadWithHostLease<Result>(
  limiter: DocumentHostLimiter | undefined,
  sourceUrl: string,
  download: () => Promise<Result>
): Promise<Result> {
  return limiter === undefined ? download() : limiter.withLease(sourceUrl, download)
}
