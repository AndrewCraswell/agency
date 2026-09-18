import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PostgresProviderRequestAdmissionStore } from "./provider-request-admission.js"

const databaseUrl = process.env.REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_destructive_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Provider admission integration checks require the dedicated local destructive database")
  }
}

describe.skipIf(databaseUrl === undefined)("PostgreSQL provider request admission", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 })
  const provider = "govinfo-admission-test"
  const unrelatedProvider = "federal-register-admission-test"
  const first = new PostgresProviderRequestAdmissionStore(pool)
  const second = new PostgresProviderRequestAdmissionStore(pool)

  beforeAll(async () => {
    await pool.query(
      "DELETE FROM legislation.sync_checkpoints WHERE source='provider-request-admission' AND stream=$1",
      [provider]
    )
    await pool.query(
      "DELETE FROM legislation.sync_checkpoints WHERE source='provider-request-admission' AND stream=$1",
      [unrelatedProvider]
    )
  })

  afterAll(async () => {
    await pool.query(
      "DELETE FROM legislation.sync_checkpoints WHERE source='provider-request-admission' AND stream=$1",
      [provider]
    )
    await pool.query(
      "DELETE FROM legislation.sync_checkpoints WHERE source='provider-request-admission' AND stream=$1",
      [unrelatedProvider]
    )
    await pool.end()
  })

  it("serializes request starts and preserves a cross-worker cooldown", async () => {
    await expect(first.admit(provider, 500)).resolves.toEqual({ admitted: true, waitMs: 0 })
    const paced = await second.admit(provider, 500)
    expect(paced.admitted).toBe(false)
    expect(paced.waitMs).toBeGreaterThan(0)
    expect(paced.waitMs).toBeLessThanOrEqual(500)

    await first.extendCooldown(provider, 1_000)
    const cooled = await second.admit(provider, 500)
    expect(cooled.admitted).toBe(false)
    expect(cooled.waitMs).toBeGreaterThanOrEqual(900)
    expect(cooled.waitMs).toBeLessThanOrEqual(1_000)
    await expect(second.admit(unrelatedProvider, 500)).resolves.toEqual({ admitted: true, waitMs: 0 })

    const checkpoint = await pool.query<{ cursor: Record<string, unknown> }>(
      "SELECT cursor FROM legislation.sync_checkpoints WHERE source='provider-request-admission' AND stream=$1",
      [provider]
    )
    expect(checkpoint.rows[0]?.cursor).toMatchObject({
      contract: "provider-request-admission-2026-09-18"
    })
  })
})
