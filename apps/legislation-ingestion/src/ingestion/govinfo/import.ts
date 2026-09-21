import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { bills, syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { federalBillId } from "@repo/legislation-core/domain/identifiers"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { and, eq, inArray } from "drizzle-orm"
import { upsertBillAggregates } from "../../persistence/bill-aggregates.js"
import { ingestionErrorSummary } from "../errors.js"
import { ProviderHttpError } from "../http-client.js"
import { createJobCounts } from "../job-result.js"
import type { JobCounts } from "../job.js"
import type { SourceStore } from "../source-store.js"
import type { GovInfoBillStatusPackage, GovInfoClient } from "./client.js"
import { normalizeGovInfoBillStatus } from "./normalize.js"

export interface GovInfoImportResult {
  checkpoint: Readonly<Record<string, unknown>>
  counts: JobCounts
  failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>>
}

export type GovInfoPackageClient = Pick<GovInfoClient, "getBillStatus">

type ImportFailure = { failure: { identifier: string; message: string; retryable: boolean }; status: "failed" }
type PreparedPackage = { aggregate: CanonicalBillAggregate; source: GovInfoBillStatusPackage }
type SkippedPackage = { source: GovInfoBillStatusPackage; status: "skipped" }
type PersistResult =
  | ImportFailure
  | SkippedPackage
  | { source: GovInfoBillStatusPackage; status: "inserted" | "prepared" | "updated" }

function packageBillId(source: GovInfoBillStatusPackage): string | undefined {
  const match = /^BILLSTATUS-(\d+)([a-z]+)(\d+)$/i.exec(source.packageId)
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return undefined
  }
  return federalBillId(Number(match[1]), match[2], match[3])
}

export async function importGovInfoPackages(
  database: LegislationDatabase,
  client: GovInfoPackageClient,
  packages: readonly GovInfoBillStatusPackage[],
  options: Readonly<{
    concurrency?: number
    force?: boolean
    persistCheckpoint?: boolean
    sourceStore?: SourceStore
    stream: string
  }>
): Promise<GovInfoImportResult> {
  const counts = createJobCounts({ discovered: packages.length })
  const failures: GovInfoImportResult["failures"] = []
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "govinfo"), eq(syncCheckpoints.stream, options.stream))
  })
  const startIndex =
    options.force === true || typeof checkpoint?.cursor.index !== "number"
      ? 0
      : Math.min(checkpoint.cursor.index, packages.length)
  counts.skipped = startIndex
  let canAdvanceCheckpoint = true
  let durableIndex = startIndex

  const concurrency = Math.max(1, options.concurrency ?? 1)
  for (let chunkStart = startIndex; chunkStart < packages.length; chunkStart += concurrency) {
    const chunk = packages.slice(chunkStart, chunkStart + concurrency)
    const candidateIds =
      options.force === true ? [] : chunk.map(packageBillId).filter((id): id is string => id !== undefined)
    const existingIds =
      candidateIds.length === 0
        ? new Set<string>()
        : new Set(
            (await database.select({ id: bills.id }).from(bills).where(inArray(bills.id, candidateIds))).map(
              (record) => record.id
            )
          )
    const prepared: Array<ImportFailure | PreparedPackage | SkippedPackage> = await Promise.all(
      chunk.map(async (source): Promise<ImportFailure | PreparedPackage | SkippedPackage> => {
        const canonicalId = packageBillId(source)
        if (options.force !== true && canonicalId !== undefined && existingIds.has(canonicalId)) {
          return { source, status: "skipped" }
        }
        try {
          const xml = await client.getBillStatus(source)
          await options.sourceStore?.put("govinfo", options.stream, new TextEncoder().encode(xml), {
            packageId: source.packageId,
            sourceUrl: source.url.href
          })
          try {
            return {
              aggregate: normalizeGovInfoBillStatus(xml, { retrievedAt: new Date(), sourceUrl: source.url.href }),
              source
            }
          } catch (error) {
            return {
              failure: {
                identifier: source.packageId,
                message: ingestionErrorSummary(error),
                retryable: false
              },
              status: "failed"
            }
          }
        } catch (error) {
          return {
            failure: {
              identifier: source.packageId,
              message: ingestionErrorSummary(error),
              retryable: error instanceof ProviderHttpError && error.retryable
            },
            status: "failed" as const
          }
        }
      })
    )
    const results: PersistResult[] = prepared.map((result) => {
      if ("aggregate" in result) {
        return { source: result.source, status: "prepared" as const }
      }
      return result
    })
    const successful = prepared.filter((result): result is PreparedPackage => "aggregate" in result)
    await persistPrepared(database, successful, results)
    for (const result of results) {
      if (result.status === "failed") {
        counts.failed += 1
        if (result.failure !== undefined) {
          failures.push(result.failure)
        }
      } else if (result.status === "skipped") {
        counts.skipped += 1
      } else if (result.status !== "prepared") {
        counts.read += 1
        counts[result.status] += 1
      }
    }
    if (canAdvanceCheckpoint && results.every((result) => result.status !== "failed")) {
      durableIndex = chunkStart + chunk.length
    } else {
      canAdvanceCheckpoint = false
    }
    if (options.persistCheckpoint !== false) {
      await saveCheckpoint(database, options.stream, durableIndex, false)
    }
  }

  const complete = failures.length === 0
  const completed = { complete, index: complete ? packages.length : durableIndex }
  if (options.persistCheckpoint !== false) {
    await saveCheckpoint(database, options.stream, completed.index, complete)
  }
  return { checkpoint: completed, counts, failures }
}

async function persistPrepared(
  database: LegislationDatabase,
  prepared: readonly PreparedPackage[],
  results: PersistResult[]
): Promise<void> {
  if (prepared.length === 0) {
    return
  }
  try {
    const existing = await upsertBillAggregates(
      database,
      prepared.map((item) => item.aggregate)
    )
    for (const item of prepared) {
      const result = results.find((candidate) => "source" in candidate && candidate.source === item.source)
      if (result !== undefined && "source" in result) {
        result.status = existing.has(item.aggregate.bill.id) ? "updated" : "inserted"
      }
    }
  } catch (error) {
    if (prepared.length > 1) {
      const midpoint = Math.ceil(prepared.length / 2)
      await persistPrepared(database, prepared.slice(0, midpoint), results)
      await persistPrepared(database, prepared.slice(midpoint), results)
      return
    }
    const item = prepared[0]
    if (item === undefined) {
      return
    }
    const index = results.findIndex((candidate) => "source" in candidate && candidate.source === item.source)
    if (index >= 0) {
      results[index] = {
        failure: {
          identifier: item.source.packageId,
          message: ingestionErrorSummary(error),
          retryable: false
        },
        status: "failed"
      }
    }
  }
}

async function saveCheckpoint(database: LegislationDatabase, stream: string, index: number, complete: boolean) {
  const cursor = { complete, index }
  await database
    .insert(syncCheckpoints)
    .values({ cursor, source: "govinfo", stream })
    .onConflictDoUpdate({
      set: { cursor, updatedAt: new Date() },
      target: [syncCheckpoints.source, syncCheckpoints.stream]
    })
}
