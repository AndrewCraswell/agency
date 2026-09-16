import { describe, expect, it } from "vitest"
import { reconcileDerivedShardBatch, runDerivedShardLoop, type DerivedShardRun } from "./derived-controller.js"

function shardRun(shardIndex: number, complete: boolean, nextAttemptAt?: string): DerivedShardRun {
  return {
    id: `run-${shardIndex}`,
    ok: true,
    output: {
      checkpoint: {
        complete,
        ...(nextAttemptAt === undefined ? {} : { nextAttemptAt })
      },
      shard: { shardCount: 3, shardIndex }
    }
  }
}

describe("derived shard controller", () => {
  it("prunes completed shards across unordered continuations while retaining deferred work", () => {
    const deferredUntil = "2026-08-18T16:00:00.000Z"
    const firstContinuation = reconcileDerivedShardBatch(
      3,
      [0, 1, 2],
      [shardRun(2, true), shardRun(1, false, deferredUntil), shardRun(0, true)]
    )

    expect(firstContinuation.activeShardIndexes).toEqual([1])
    expect(firstContinuation.nextAttemptAt?.toISOString()).toBe(deferredUntil)

    const secondContinuation = reconcileDerivedShardBatch(3, firstContinuation.activeShardIndexes, [shardRun(1, true)])
    expect(secondContinuation.activeShardIndexes).toEqual([])
  })

  it("rejects a batch that cannot be mapped safely to every active shard", () => {
    expect(() => reconcileDerivedShardBatch(3, [0, 1], [shardRun(0, false), shardRun(0, false)])).toThrow(
      "duplicated shard 0"
    )
  })

  it("allows a fast shard coordinator to start its next continuation before a slow coordinator completes", async () => {
    let resolveSlowFirstContinuation: ((run: DerivedShardRun) => void) | undefined
    const started: string[] = []

    const slowShard = runDerivedShardLoop({
      maxContinuations: 3,
      runContinuation: async (continuation) => {
        started.push(`slow:${continuation}`)
        return await new Promise<DerivedShardRun>((resolve) => {
          resolveSlowFirstContinuation = resolve
        })
      },
      shardCount: 3,
      shardIndex: 0,
      waitUntil: async () => undefined
    })
    const fastShard = runDerivedShardLoop({
      maxContinuations: 3,
      runContinuation: async (continuation) => {
        started.push(`fast:${continuation}`)
        return {
          id: `fast-${continuation}`,
          ok: true,
          output: {
            checkpoint: { complete: continuation === 1 },
            shard: { shardCount: 3, shardIndex: 1 }
          }
        }
      },
      shardCount: 3,
      shardIndex: 1,
      waitUntil: async () => undefined
    })

    await fastShard
    expect(started).toEqual(["slow:0", "fast:0", "fast:1"])

    resolveSlowFirstContinuation?.(shardRun(0, true))
    await slowShard
  })

  it("waits for an overlapping child lease and then resumes the same shard", async () => {
    const retryAt = new Date("2026-08-18T16:00:00.000Z")
    const continuations: number[] = []
    const waits: Date[] = []

    await runDerivedShardLoop({
      maxContinuations: 3,
      now: () => new Date("2026-08-18T15:59:00.000Z"),
      runContinuation: async (continuation) => {
        continuations.push(continuation)
        return continuation === 0 ? shardRun(1, false, retryAt.toISOString()) : shardRun(1, true)
      },
      shardCount: 3,
      shardIndex: 1,
      waitUntil: async (date) => {
        waits.push(date)
      }
    })

    expect(continuations).toEqual([0, 1])
    expect(waits).toEqual([retryAt])
  })

  it("rejects a continuation that reports a different shard identity", async () => {
    await expect(
      runDerivedShardLoop({
        maxContinuations: 1,
        runContinuation: async () => shardRun(2, true),
        shardCount: 3,
        shardIndex: 1,
        waitUntil: async () => undefined
      })
    ).rejects.toThrow("reported an inactive shard index")
  })
})
