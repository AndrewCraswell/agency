import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import type { LegislationDatabase } from "../../db/database.js"
import { resolveApprovedDocumentUrl } from "./download.js"

/**
 * A durable per-origin slot lease. Trigger runs do not share memory, so a
 * process-local semaphore would let every shard overload the same publisher.
 *
 * Slots are deliberately short lived: a lease protects exactly one download
 * (including the California form POST) and is released in finally. Expiry
 * recovers capacity after a worker crash without needing a cleanup service.
 */
export interface DocumentHostLimiter {
  withLease<Result>(sourceUrl: string, operation: () => Promise<Result>): Promise<Result>
}

export interface DocumentHostLimiterEvent {
  host: string
  slot?: number
  type: "acquired" | "released" | "release-failed" | "renewal-failed" | "timed-out"
  waitMs: number
}

/**
 * This is deliberate backpressure, not a publisher or document failure. The
 * document worker returns the record to its queue without consuming a retry.
 */
export class DocumentHostLeaseDeferredError extends Error {
  readonly host: string

  constructor(host: string) {
    super(`Document host limiter deferred download until a slot is available: ${host}`)
    this.name = "DocumentHostLeaseDeferredError"
    this.host = host
  }
}

export interface DocumentHostLimiterOptions {
  acquireTimeoutMs?: number
  defaultSlots?: number
  leaseDurationMs?: number
  onEvent?: (event: DocumentHostLimiterEvent) => void
  pollIntervalMs?: number
}

export const DOCUMENT_HOST_LIMITER_DEFAULTS = {
  acquireTimeoutMs: 120_000,
  defaultSlots: 2,
  leaseDurationMs: 90_000,
  pollIntervalMs: 250
} as const

const CALIBRATED_SINGLE_SLOT_HOSTS = new Set([
  "gc.nh.gov",
  "leg.colorado.gov",
  "nebraskalegislature.gov",
  "search-prod.lis.state.oh.us",
  "sdlegislature.gov",
  "www.gencourt.state.nh.us",
  "www.legislature.ohio.gov",
  // Two simultaneous Minnesota connections produced a sustained burst of
  // UND_ERR_CONNECT_TIMEOUT failures during the two-partition canary. Keep
  // extraction partitioned, but serialize downloads across those workers.
  "www.revisor.mn.gov"
])
const CALIBRATED_HOST_COOLDOWNS_MS = new Map([
  // The one-second two-slot tail initially stayed clean, then produced a
  // sustained 429 cohort. Preserve latency overlap while returning to the
  // publisher-safe two-second aggregate request cadence.
  ["flsenate.gov", 1_500],
  // One-second production traffic still caused sustained socket-close bursts
  // after the single-slot repair. Give both sides of the official redirect a
  // five-second recovery interval before another document request.
  ["gc.nh.gov", 5_000],
  ["leg.colorado.gov", 1_000],
  ["nebraskalegislature.gov", 5_000],
  // Four simultaneous Senate archive requests produced sustained connection
  // refusals while bounded single-request probes remained healthy.
  ["legislation.nysenate.gov", 1_000],
  // Every approved Pennsylvania bill-text rewrite resolves to Palegis. Keep
  // both origins at one in-flight request. The two-second production soak then
  // completed 4,800 attempts with two retryable HTTP 500 responses and no 429,
  // so the final bounded tail canary uses 1.5 seconds between request starts.
  ["www.legis.state.pa.us", 1_500],
  ["www.gencourt.state.nh.us", 5_000],
  ["www.palegis.us", 1_500],
  // Ohio returns occasional 429 responses even with a single in-flight
  // download. The Legislature origin also returned bursts of HTTP 500 at the
  // one-second canary pace, so give that publisher a longer recovery interval.
  ["search-prod.lis.state.oh.us", 1_000],
  ["sdlegislature.gov", 1_000],
  ["www.legislature.ohio.gov", 5_000]
])

// These publishers use two in-flight slots only to overlap network latency.
// The host-wide start gate preserves the already proven one-slot request pace
// and prevents both slots from starting a request in the same burst.
const CALIBRATED_HOST_START_INTERVALS_MS = new Map([
  // The short material calibration tolerated eight aggregate in-flight
  // requests, but sustained production traffic eventually produced 429s on
  // both Congress.gov origins. Retain four latency-overlap slots while
  // limiting the two aliases to about five aggregate request starts per
  // second. The 500 ms canary eliminated 429s but reduced terminal material
  // throughput to roughly 7,000 records/hour; 400 ms remained clean but held
  // the 15-minute terminal rate near 9,000/hour and produced ordinary
  // host-wait deferrals. A bounded 300 ms canary keeps starts smooth at no more
  // than about 6.7 aggregate requests/second across the two aliases.
  ["congress.gov", 300],
  ["flsenate.gov", 1_500],
  ["www.legis.state.pa.us", 1_500],
  ["www.palegis.us", 1_500],
  ["www.congress.gov", 300]
])
const CALIBRATED_FOUR_SLOT_HOSTS = new Set([
  "capitol.texas.gov",
  // Supporting materials are distributed across 24 extraction shards but are
  // almost entirely hosted by Congress.gov. A production-corpus calibration
  // returned 48/48 HTTP 200 responses at aggregate concurrency 2, 4, and 8,
  // with the eight-request wave completing at 29.8 requests/second. Four
  // durable slots per observed origin lets parsing overlap without allowing
  // an unbounded shard-level burst.
  "congress.gov",
  "ilga.gov",
  "www.congress.gov",
  "www.govinfo.gov",
  "www.nysenate.gov"
])
const CALIBRATED_TWO_SLOT_HOSTS = new Set([
  // California was stable at two slots. Both the four-slot and three-slot
  // production canaries produced sustained connection-timeout bursts, so keep
  // the publisher at the proven cap even if the global default later changes.
  "leginfo.legislature.ca.gov",
  "legislation.nysenate.gov",
  "flsenate.gov",
  "www.legis.state.pa.us",
  "www.palegis.us"
])

export interface DocumentHostLeaseRepository {
  acquire(
    input: Readonly<{
      host: string
      leaseDurationMs: number
      minimumStartIntervalMs: number
      ownerId: string
      slots: number
    }>
  ): Promise<number | undefined>
  release(input: Readonly<{ cooldownMs: number; host: string; ownerId: string; slot: number }>): Promise<void>
  renew(input: Readonly<{ host: string; leaseDurationMs: number; ownerId: string; slot: number }>): Promise<boolean>
}

class DatabaseDocumentHostLeaseRepository implements DocumentHostLeaseRepository {
  readonly #database: LegislationDatabase

  constructor(database: LegislationDatabase) {
    this.#database = database
  }

  async acquire(
    input: Readonly<{
      host: string
      leaseDurationMs: number
      minimumStartIntervalMs: number
      ownerId: string
      slots: number
    }>
  ): Promise<number | undefined> {
    // Selecting and claiming happen in the same statement. Concurrent workers
    // may choose the same vacant slot, but ON CONFLICT only allows one owner to
    // win; losers retry after a short bounded pause.
    const result = await this.#database.execute<{ slot: number }>(sql`
      with candidate as (
        select candidates.slot
        from generate_series(1, ${input.slots}) as candidates(slot)
        left join legislation.document_download_leases leases
          on leases.host = ${input.host} and leases.slot = candidates.slot
        where (leases.expires_at is null or leases.expires_at < now())
          and not exists (
            select 1
            from legislation.document_download_leases recent
            where recent.host = ${input.host}
              and recent.acquired_at >
                now() - (${input.minimumStartIntervalMs} * interval '1 millisecond')
          )
        order by candidates.slot
        limit 1
      )
      insert into legislation.document_download_leases (host, slot, owner_id, expires_at, acquired_at)
      select ${input.host}, candidate.slot, ${input.ownerId}::uuid,
        now() + (${input.leaseDurationMs} * interval '1 millisecond'), now()
      from candidate
      on conflict (host, slot) do update
        set owner_id = excluded.owner_id,
          expires_at = excluded.expires_at,
          acquired_at = excluded.acquired_at
        where legislation.document_download_leases.expires_at < now()
      returning slot
    `)
    return result.rows[0]?.slot
  }

  async release(input: Readonly<{ cooldownMs: number; host: string; ownerId: string; slot: number }>): Promise<void> {
    await this.#database.execute(sql`
      update legislation.document_download_leases
      set owner_id = null, expires_at = now() + (${input.cooldownMs} * interval '1 millisecond')
      where host = ${input.host} and slot = ${input.slot} and owner_id = ${input.ownerId}::uuid
    `)
  }

  async renew(
    input: Readonly<{ host: string; leaseDurationMs: number; ownerId: string; slot: number }>
  ): Promise<boolean> {
    const result = await this.#database.execute<{ slot: number }>(sql`
      update legislation.document_download_leases
      set expires_at = now() + (${input.leaseDurationMs} * interval '1 millisecond')
      where host = ${input.host} and slot = ${input.slot} and owner_id = ${input.ownerId}::uuid
      returning slot
    `)
    return result.rows.length === 1
  }
}

class DurableDocumentHostLimiter implements DocumentHostLimiter {
  readonly #options: Required<Omit<DocumentHostLimiterOptions, "onEvent">> & Pick<DocumentHostLimiterOptions, "onEvent">
  readonly #repository: DocumentHostLeaseRepository

  constructor(repository: DocumentHostLeaseRepository, options: DocumentHostLimiterOptions) {
    this.#repository = repository
    this.#options = {
      acquireTimeoutMs: positiveInteger(options.acquireTimeoutMs ?? DOCUMENT_HOST_LIMITER_DEFAULTS.acquireTimeoutMs),
      defaultSlots: positiveInteger(options.defaultSlots ?? DOCUMENT_HOST_LIMITER_DEFAULTS.defaultSlots),
      leaseDurationMs: positiveInteger(options.leaseDurationMs ?? DOCUMENT_HOST_LIMITER_DEFAULTS.leaseDurationMs),
      onEvent: options.onEvent,
      pollIntervalMs: positiveInteger(options.pollIntervalMs ?? DOCUMENT_HOST_LIMITER_DEFAULTS.pollIntervalMs)
    }
  }

  async withLease<Result>(sourceUrl: string, operation: () => Promise<Result>): Promise<Result> {
    const host = normalizedDocumentHost(sourceUrl)
    const startedAt = Date.now()
    const ownerId = randomUUID()
    const slots = slotsForDocumentHost(host, this.#options.defaultSlots)
    let slot: number | undefined
    while (slot === undefined) {
      slot = await this.#repository.acquire({
        host,
        leaseDurationMs: this.#options.leaseDurationMs,
        minimumStartIntervalMs: minimumStartIntervalForDocumentHost(host),
        ownerId,
        slots
      })
      if (slot !== undefined) {
        break
      }
      const waitMs = Date.now() - startedAt
      if (waitMs >= this.#options.acquireTimeoutMs) {
        this.#options.onEvent?.({ host, type: "timed-out", waitMs })
        throw new DocumentHostLeaseDeferredError(host)
      }
      await delay(Math.min(this.#options.pollIntervalMs, this.#options.acquireTimeoutMs - waitMs))
    }
    const waitMs = Date.now() - startedAt
    this.#options.onEvent?.({ host, slot, type: "acquired", waitMs })
    let renewalInFlight: Promise<void> | undefined
    const renewalInterval = setInterval(
      () => {
        if (renewalInFlight !== undefined) {
          return
        }
        renewalInFlight = this.#repository
          .renew({ host, leaseDurationMs: this.#options.leaseDurationMs, ownerId, slot })
          .then((renewed) => {
            if (!renewed) {
              this.#options.onEvent?.({ host, slot, type: "renewal-failed", waitMs: Date.now() - startedAt })
            }
          })
          .catch(() => {
            this.#options.onEvent?.({ host, slot, type: "renewal-failed", waitMs: Date.now() - startedAt })
          })
          .finally(() => {
            renewalInFlight = undefined
          })
      },
      Math.max(1_000, Math.floor(this.#options.leaseDurationMs / 3))
    )
    renewalInterval.unref()
    try {
      return await operation()
    } finally {
      clearInterval(renewalInterval)
      await renewalInFlight
      try {
        await this.#repository.release({ cooldownMs: cooldownForDocumentHost(host), host, ownerId, slot })
        this.#options.onEvent?.({ host, slot, type: "released", waitMs: Date.now() - startedAt })
      } catch {
        // Release failure only wastes a slot until its renewable lease expires.
        // Never hide a successful download or replace its publisher failure.
        this.#options.onEvent?.({ host, slot, type: "release-failed", waitMs: Date.now() - startedAt })
      }
    }
  }
}

export function createDatabaseDocumentHostLimiter(
  database: LegislationDatabase,
  options: DocumentHostLimiterOptions = {}
): DocumentHostLimiter {
  return new DurableDocumentHostLimiter(new DatabaseDocumentHostLeaseRepository(database), options)
}

export function normalizedDocumentHost(sourceUrl: string): string {
  const url = resolveApprovedDocumentUrl(sourceUrl)
  if (url.hostname === "") {
    throw new Error("Document host limiter requires a URL host")
  }
  return url.hostname.toLowerCase()
}

export function slotsForDocumentHost(
  host: string,
  defaultSlots: number = DOCUMENT_HOST_LIMITER_DEFAULTS.defaultSlots
): number {
  const normalizedHost = host.toLowerCase()
  if (CALIBRATED_SINGLE_SLOT_HOSTS.has(normalizedHost)) {
    return 1
  }
  if (CALIBRATED_TWO_SLOT_HOSTS.has(normalizedHost)) {
    return 2
  }
  return CALIBRATED_FOUR_SLOT_HOSTS.has(normalizedHost) ? 4 : positiveInteger(defaultSlots)
}

export function cooldownForDocumentHost(host: string): number {
  return CALIBRATED_HOST_COOLDOWNS_MS.get(host.toLowerCase()) ?? 0
}

export function minimumStartIntervalForDocumentHost(host: string): number {
  return CALIBRATED_HOST_START_INTERVALS_MS.get(host.toLowerCase()) ?? 0
}

export function createDocumentHostLimiterForTest(
  repository: DocumentHostLeaseRepository,
  options: DocumentHostLimiterOptions = {}
): DocumentHostLimiter {
  return new DurableDocumentHostLimiter(repository, options)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function positiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Document host limiter settings must be positive integers")
  }
  return value
}
