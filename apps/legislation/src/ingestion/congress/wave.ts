import { allocateCongressRequestBudget, type CongressRequestBudgetAssignment } from "./request-budget.js"

export const CONGRESS_WAVE_ATTEMPT_BUDGET = 19_500

const HOUR = 3_600_000

export type CongressWaveChildResult = Readonly<{
  attempts: number
  retryAt?: Date
  scope: string
  status: "complete" | "incomplete"
}>

export type CongressWaveChild = (
  input: Readonly<{
    assignment: CongressRequestBudgetAssignment
    scope: string
  }>
) => Promise<CongressWaveChildResult>

export type CongressWaveDependencies = Readonly<{
  executeChild: CongressWaveChild
  now?: () => Date
  waitUntil: (date: Date) => Promise<void>
}>

export type CongressWaveResult = Readonly<{
  attempts: number
  completedScopes: readonly string[]
  windows: number
}>

/**
 * Owns a complete, predeclared Congress.gov wave. It is intentionally stateful
 * only within one singleton Trigger task: a second independent allocator would
 * invalidate the hard per-hour budget.
 */
export async function runCongressWave(
  scopes: readonly string[],
  dependencies: CongressWaveDependencies
): Promise<CongressWaveResult> {
  const pending = [...new Set(scopes)]
  const completed = new Set<string>()
  let attempts = 0
  let remaining = CONGRESS_WAVE_ATTEMPT_BUDGET
  let windowStart = dependencies.now?.() ?? new Date()
  let windows = 1

  while (pending.length > 0) {
    const now = dependencies.now?.() ?? new Date()
    if (now.getTime() >= windowStart.getTime() + HOUR) {
      windowStart = now
      remaining = CONGRESS_WAVE_ATTEMPT_BUDGET
      windows += 1
    }
    if (remaining === 0) {
      await dependencies.waitUntil(new Date(windowStart.getTime() + HOUR))
      continue
    }

    // Submit the complete predeclared wave. Trigger's child queue keeps only
    // CONGRESS_WAVE_CHILD_CONCURRENCY children runnable at once, while queued
    // children immediately fill slots released by short checkpointed scopes.
    // This avoids a batch barrier where two long event scopes leave thirteen
    // provider and worker slots idle before later Congresses are submitted.
    const batch = pending.splice(0, Math.min(pending.length, remaining))
    const assignments = allocateCongressRequestBudget(remaining, batch.length)
    const outcomes = await Promise.all(
      batch.map(async (scope, index) => {
        const assignment = assignments[index]
        if (assignment === undefined) {
          throw new Error("Congress wave allocation is missing a child assignment")
        }
        return await dependencies.executeChild({ assignment, scope })
      })
    )
    const used = outcomes.reduce((total, outcome) => total + outcome.attempts, 0)
    if (
      used > remaining ||
      outcomes.some((outcome) => outcome.attempts < 0 || !Number.isSafeInteger(outcome.attempts))
    ) {
      throw new Error("Congress wave child reported an invalid request count")
    }
    attempts += used
    remaining -= used

    const retryAt = latestRetryAt(outcomes)
    for (const outcome of outcomes) {
      if (outcome.status === "complete") {
        completed.add(outcome.scope)
      } else if (!pending.includes(outcome.scope)) {
        pending.push(outcome.scope)
      }
    }
    // A 429 is global to the API key. Never redistribute a returned slice
    // until the provider's cooldown has elapsed.
    if (retryAt !== undefined) {
      await dependencies.waitUntil(retryAt)
    }
  }

  return { attempts, completedScopes: [...completed], windows }
}

export function congressHistoryWaveScopes(startCongress: number, endCongress: number): string[] {
  if (
    !Number.isSafeInteger(startCongress) ||
    !Number.isSafeInteger(endCongress) ||
    startCongress < 1 ||
    endCongress < startCongress
  ) {
    throw new Error("Congress history wave requires a valid inclusive Congress range")
  }
  const domains = ["amendments", "events", "house-votes", "committee-reports"] as const
  const scopes = [`congress:entities-range:${startCongress}-${endCongress}`]
  for (let congress = startCongress; congress <= endCongress; congress += 1) {
    for (const domain of domains) {
      scopes.push(`congress:${domain}:${congress}`)
    }
  }
  return scopes
}

export function congressRecurringWaveScopes(currentCongress: number): string[] {
  if (!Number.isSafeInteger(currentCongress) || currentCongress < 1) {
    throw new Error("Congress recurring wave requires a positive Congress")
  }
  return [
    "congress:bills:current",
    `congress:amendments:${currentCongress}`,
    `congress:entities:${currentCongress}`,
    `congress:events:${currentCongress}`,
    `congress:house-votes:${currentCongress}`,
    `congress:committee-reports:${currentCongress}`
  ]
}

function latestRetryAt(outcomes: readonly CongressWaveChildResult[]): Date | undefined {
  return outcomes.reduce<Date | undefined>((latest, outcome) => {
    if (outcome.retryAt === undefined || (latest !== undefined && outcome.retryAt <= latest)) {
      return latest
    }
    return outcome.retryAt
  }, undefined)
}
