import type pg from "pg"
import { z } from "zod"
import { DeferredHttpRequestError, type HttpRequestTelemetry } from "./http-client.js"

const providerSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const intervalSchema = z.number().int().min(1).max(60_000)
const cooldownSchema = z.number().int().min(1).max(3_600_000)
const checkpointSchema = z.object({
  contract: z.literal("provider-request-admission-2026-09-18"),
  nextRequestAt: z.iso.datetime({ offset: true }),
  cooldownUntil: z.iso.datetime({ offset: true })
})

type AdmissionDecision = Readonly<{ admitted: boolean; waitMs: number }>

export interface ProviderRequestAdmissionStore {
  admit(provider: string, minimumIntervalMs: number): Promise<AdmissionDecision>
  extendCooldown(provider: string, cooldownMs: number): Promise<void>
}

/**
 * Coordinates provider request starts across processes. Waiting happens outside
 * database transactions; every wake-up rechecks the durable cooldown before a
 * request is allowed to start.
 */
export class ProviderRequestAdmission {
  readonly #cooldownMs: number
  readonly #delay: (milliseconds: number) => Promise<void>
  readonly #minimumIntervalMs: number
  readonly #provider: string
  readonly #store: ProviderRequestAdmissionStore

  constructor(
    store: ProviderRequestAdmissionStore,
    options: Readonly<{ provider: string; minimumIntervalMs: number; defaultCooldownMs?: number }>,
    dependencies: { delay?: (milliseconds: number) => Promise<void> } = {}
  ) {
    this.#store = store
    this.#provider = providerSchema.parse(options.provider)
    this.#minimumIntervalMs = intervalSchema.parse(options.minimumIntervalMs)
    this.#cooldownMs = cooldownSchema.parse(options.defaultCooldownMs ?? 60 * 60 * 1_000)
    this.#delay = dependencies.delay ?? delay
  }

  async beforeAttempt(): Promise<void> {
    for (;;) {
      const decision = await this.#store.admit(this.#provider, this.#minimumIntervalMs)
      if (decision.admitted) return
      await this.#delay(Math.max(1, decision.waitMs))
    }
  }

  async afterAttempt(telemetry: HttpRequestTelemetry): Promise<void> {
    if (telemetry.status !== 429) return
    const cooldownMs = cooldownSchema.parse(telemetry.retryAfterMs ?? this.#cooldownMs)
    await this.#store.extendCooldown(this.#provider, cooldownMs)
    throw new DeferredHttpRequestError(
      `Provider ${this.#provider} is cooling down after HTTP 429`,
      new Date(Date.now() + cooldownMs),
      "provider_cooldown"
    )
  }
}

/** Uses the existing generic checkpoint table; no regulation-specific migration is required. */
export class PostgresProviderRequestAdmissionStore implements ProviderRequestAdmissionStore {
  readonly #pool: pg.Pool

  constructor(pool: pg.Pool) {
    this.#pool = pool
  }

  async admit(provider: string, minimumIntervalMs: number): Promise<AdmissionDecision> {
    providerSchema.parse(provider)
    intervalSchema.parse(minimumIntervalMs)
    const client = await this.#pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SET LOCAL lock_timeout='10s'")
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `provider-request-admission:${provider}`
      ])
      await client.query(
        `INSERT INTO legislation.sync_checkpoints(source,stream,cursor,updated_at)
         VALUES('provider-request-admission',$1,
           jsonb_build_object(
             'contract','provider-request-admission-2026-09-18',
             'nextRequestAt',clock_timestamp(),
             'cooldownUntil',clock_timestamp()
           ),clock_timestamp())
         ON CONFLICT(source,stream) DO NOTHING`,
        [provider]
      )
      const selected = await client.query<{ cursor: unknown; wait_ms: number }>(
        `SELECT cursor,
           least(3600000,greatest(0,ceil(extract(epoch FROM (
             greatest((cursor->>'nextRequestAt')::timestamptz,(cursor->>'cooldownUntil')::timestamptz)
             - clock_timestamp()
           ))*1000)))::integer AS wait_ms
         FROM legislation.sync_checkpoints
         WHERE source='provider-request-admission' AND stream=$1
         FOR UPDATE`,
        [provider]
      )
      if (selected.rowCount !== 1) throw new Error("provider_admission_checkpoint_missing")
      checkpointSchema.parse(selected.rows[0]?.cursor)
      const waitMs = z.number().int().nonnegative().parse(selected.rows[0]?.wait_ms)
      if (waitMs > 0) {
        await client.query("COMMIT")
        return { admitted: false, waitMs }
      }
      const updated = await client.query(
        `UPDATE legislation.sync_checkpoints
         SET cursor=jsonb_set(cursor,'{nextRequestAt}',to_jsonb(clock_timestamp()+($2::integer*interval '1 millisecond'))),
           updated_at=clock_timestamp()
         WHERE source='provider-request-admission' AND stream=$1`,
        [provider, minimumIntervalMs]
      )
      if (updated.rowCount !== 1) throw new Error("provider_admission_checkpoint_lost")
      await client.query("COMMIT")
      return { admitted: true, waitMs: 0 }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }

  async extendCooldown(provider: string, cooldownMs: number): Promise<void> {
    providerSchema.parse(provider)
    cooldownSchema.parse(cooldownMs)
    const client = await this.#pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SET LOCAL lock_timeout='10s'")
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `provider-request-admission:${provider}`
      ])
      const updated = await client.query(
        `UPDATE legislation.sync_checkpoints
         SET cursor=jsonb_set(
               jsonb_set(cursor,'{cooldownUntil}',to_jsonb(greatest(
                 (cursor->>'cooldownUntil')::timestamptz,
                 clock_timestamp()+($2::integer*interval '1 millisecond')
               ))),
               '{nextRequestAt}',to_jsonb(greatest(
                 (cursor->>'nextRequestAt')::timestamptz,
                 clock_timestamp()+($2::integer*interval '1 millisecond')
               ))
             ),
           updated_at=clock_timestamp()
         WHERE source='provider-request-admission' AND stream=$1`,
        [provider, cooldownMs]
      )
      if (updated.rowCount !== 1) throw new Error("provider_admission_checkpoint_missing")
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}

/** One shared key covers GovInfo API, bulk and rendition traffic in Trigger workers. */
export function createGovInfoProviderRequestAdmission(pool: pg.Pool) {
  return new ProviderRequestAdmission(new PostgresProviderRequestAdmissionStore(pool), {
    provider: "govinfo",
    minimumIntervalMs: 500
  })
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
