import { describe, expect, it, vi } from "vitest"
import {
  CongressAssignedRequestBudget,
  CONGRESS_WAVE_CHILD_CONCURRENCY,
  CONGRESS_WAVE_REQUESTS_PER_SECOND,
  allocateCongressRequestBudget
} from "./request-budget.js"
import { CONGRESS_WAVE_ATTEMPT_BUDGET, congressHistoryWaveScopes, runCongressWave } from "./wave.js"

describe("Congress wave budget coordinator", () => {
  it("uses one entity-range snapshot scope for a history wave", () => {
    const scopes = congressHistoryWaveScopes(113, 119)
    expect(scopes).toContain("congress:entities-range:113-119")
    expect(scopes.filter((scope) => scope.startsWith("congress:entities:"))).toEqual([])
    expect(scopes).toHaveLength(29)
  })

  it("never allocates more than 19,500 attempts in one window", async () => {
    const result = await runCongressWave(["congress:bills:current"], {
      executeChild: async ({ assignment, scope }) => ({
        attempts: assignment.attemptBudget,
        scope,
        status: "complete"
      }),
      waitUntil: async () => undefined
    })

    expect(result.attempts).toBe(CONGRESS_WAVE_ATTEMPT_BUDGET)
    expect(result.windows).toBe(1)
  })

  it("submits every predeclared scope without exceeding the runnable slot ceiling", async () => {
    const allocations: Array<{ attemptBudget: number; scope: string }> = []
    await runCongressWave(
      Array.from({ length: 21 }, (_value, index) => `scope-${index}`),
      {
        executeChild: async ({ assignment, scope }) => {
          allocations.push({ attemptBudget: assignment.attemptBudget, scope })
          return { attempts: 1, scope, status: "complete" }
        },
        waitUntil: async () => undefined
      }
    )

    expect(allocations).toHaveLength(21)
    expect(allocations.reduce((total, allocation) => total + allocation.attemptBudget, 0)).toBe(
      CONGRESS_WAVE_ATTEMPT_BUDGET
    )
    expect(allocateCongressRequestBudget(CONGRESS_WAVE_ATTEMPT_BUDGET, 21)).toHaveLength(21)
  })

  it("waits through a global 429 cooldown before continuing the incomplete scope", async () => {
    const retryAt = new Date("2026-08-18T13:30:00.000Z")
    const waits: Date[] = []
    let attempts = 0
    const result = await runCongressWave(["scope"], {
      executeChild: async ({ scope }) => {
        attempts += 1
        return attempts === 1
          ? { attempts: 2, retryAt, scope, status: "incomplete" }
          : { attempts: 1, scope, status: "complete" }
      },
      waitUntil: async (date) => {
        waits.push(date)
      }
    })

    expect(waits).toEqual([retryAt])
    expect(result.attempts).toBe(3)
  })

  it("redistributes unused capacity immediately when only a child allocation is exhausted", async () => {
    const waits: Date[] = []
    let firstScopeCalls = 0
    await runCongressWave(["first", "second"], {
      executeChild: async ({ assignment, scope }) => {
        if (scope === "first") {
          firstScopeCalls += 1
          return firstScopeCalls === 1
            ? { attempts: assignment.attemptBudget, scope, status: "incomplete" }
            : { attempts: 1, scope, status: "complete" }
        }
        return { attempts: 1, scope, status: "complete" }
      },
      waitUntil: async (date) => {
        waits.push(date)
      }
    })

    expect(firstScopeCalls).toBe(2)
    expect(waits).toEqual([])
  })

  it("resets the fixed hourly allowance only one hour after the coordinator window began", async () => {
    let now = new Date("2026-08-18T12:59:59.000Z")
    let calls = 0
    const allocations: number[] = []
    const result = await runCongressWave(["scope"], {
      executeChild: async ({ assignment, scope }) => {
        calls += 1
        allocations.push(assignment.attemptBudget)
        return calls === 1
          ? { attempts: assignment.attemptBudget, scope, status: "incomplete" }
          : { attempts: 1, scope, status: "complete" }
      },
      now: () => now,
      waitUntil: async (date) => {
        now = date
      }
    })

    expect(result.windows).toBe(2)
    expect(result.attempts).toBe(CONGRESS_WAVE_ATTEMPT_BUDGET + 1)
    expect(allocations).toEqual([CONGRESS_WAVE_ATTEMPT_BUDGET, CONGRESS_WAVE_ATTEMPT_BUDGET])
  })

  it("allocates disjoint provider slots to 15 concurrent children", () => {
    const assignments = allocateCongressRequestBudget(100, CONGRESS_WAVE_CHILD_CONCURRENCY)
    expect(assignments.map((assignment) => assignment.slotOffset)).toEqual(
      Array.from({ length: CONGRESS_WAVE_CHILD_CONCURRENCY }, (_value, index) => index)
    )
    expect(assignments.every((assignment) => assignment.slotCount === 1)).toBe(true)
    expect(assignments.reduce((total, assignment) => total + assignment.slotCount, 0)).toBe(
      CONGRESS_WAVE_REQUESTS_PER_SECOND
    )
  })

  it("reuses provider slots only for children queued behind the 15-run ceiling", () => {
    const assignments = allocateCongressRequestBudget(CONGRESS_WAVE_ATTEMPT_BUDGET, 29)
    expect(assignments).toHaveLength(29)
    expect(assignments.slice(0, CONGRESS_WAVE_CHILD_CONCURRENCY).map(({ slotOffset }) => slotOffset)).toEqual(
      Array.from({ length: CONGRESS_WAVE_CHILD_CONCURRENCY }, (_value, index) => index)
    )
    expect(assignments.slice(CONGRESS_WAVE_CHILD_CONCURRENCY).map(({ slotOffset }) => slotOffset)).toEqual(
      Array.from({ length: 14 }, (_value, index) => index)
    )
    expect(assignments.every(({ slotCount }) => slotCount === 1)).toBe(true)
  })

  it("does not create zero-attempt assignments when less budget remains than pending scopes", () => {
    const assignments = allocateCongressRequestBudget(5, CONGRESS_WAVE_CHILD_CONCURRENCY)
    expect(assignments).toHaveLength(5)
    expect(assignments.every((assignment) => assignment.attemptBudget === 1)).toBe(true)
  })

  it("paces simultaneous attempts within one child allocation", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-18T12:00:00.000Z"))
    const budget = new CongressAssignedRequestBudget({
      attemptBudget: 2,
      slotCount: CONGRESS_WAVE_REQUESTS_PER_SECOND,
      slotOffset: 0
    })
    const acquired = Promise.all([budget.acquire(), budget.acquire()])
    await vi.advanceTimersByTimeAsync(67)
    await acquired
    expect(budget.attempts).toBe(2)
    vi.useRealTimers()
  })
})
