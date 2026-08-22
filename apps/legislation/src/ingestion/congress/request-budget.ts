import { DeferredHttpRequestError, type HttpRequestTelemetry } from "../http-client.js"

const SECOND = 1_000

/** The shared coordinator's child fan-out and provider request-start ceiling. */
export const CONGRESS_WAVE_CHILD_CONCURRENCY = 15
export const CONGRESS_WAVE_REQUESTS_PER_SECOND = 15

export type CongressRequestBudgetAssignment = Readonly<{
  attemptBudget: number
  /** Consecutive globally-reserved provider slots in each one-second window. */
  slotCount: number
  slotOffset: number
}>

export class CongressRequestBudgetExhaustedError extends DeferredHttpRequestError {
  constructor(retryAt: Date, kind: "allocation_exhausted" | "provider_cooldown") {
    super(`Congress wave request allocation exhausted until ${retryAt.toISOString()}`, retryAt, kind)
    this.name = "CongressRequestBudgetExhaustedError"
  }
}

export function isCongressRequestBudgetExhaustedError(error: unknown): error is CongressRequestBudgetExhaustedError {
  return error instanceof CongressRequestBudgetExhaustedError
}

/**
 * Per-child view of a coordinator-issued allocation. Slots are disjoint across
 * concurrently-running children, allowing a wave to reach approximately 15
 * starts per second without a second shared datastore.
 */
export class CongressAssignedRequestBudget {
  readonly #assignment: CongressRequestBudgetAssignment
  #attempts = 0
  #exhaustionKind: "allocation_exhausted" | "provider_cooldown" | undefined
  #gate: Promise<void> = Promise.resolve()
  #nextRequestAt: number
  #retryAt: Date | undefined

  constructor(assignment: CongressRequestBudgetAssignment, now: Date = new Date()) {
    if (
      !Number.isSafeInteger(assignment.attemptBudget) ||
      !Number.isSafeInteger(assignment.slotCount) ||
      !Number.isSafeInteger(assignment.slotOffset) ||
      assignment.attemptBudget < 1 ||
      assignment.slotCount < 1 ||
      assignment.slotOffset < 0 ||
      assignment.slotOffset + assignment.slotCount > CONGRESS_WAVE_REQUESTS_PER_SECOND
    ) {
      throw new Error("Congress request budget assignment is invalid")
    }
    this.#assignment = assignment
    const currentSecond = floorSecond(now.getTime())
    const slotAt = currentSecond + assignment.slotOffset * (SECOND / CONGRESS_WAVE_REQUESTS_PER_SECOND)
    this.#nextRequestAt =
      slotAt >= now.getTime()
        ? slotAt
        : currentSecond + SECOND + assignment.slotOffset * (SECOND / CONGRESS_WAVE_REQUESTS_PER_SECOND)
  }

  get attempts(): number {
    return this.#attempts
  }

  get retryAt(): Date | undefined {
    return this.#retryAt
  }

  async acquire(): Promise<void> {
    if (this.#retryAt !== undefined) {
      throw new CongressRequestBudgetExhaustedError(this.#retryAt, this.#exhaustionKind ?? "allocation_exhausted")
    }
    const previous = this.#gate
    const gate = Promise.withResolvers<void>()
    this.#gate = gate.promise
    await previous
    try {
      if (this.#retryAt !== undefined) {
        throw new CongressRequestBudgetExhaustedError(this.#retryAt, this.#exhaustionKind ?? "allocation_exhausted")
      }
      if (this.#attempts >= this.#assignment.attemptBudget) {
        const retryAt = new Date(nextHour(Date.now()))
        this.#exhaustionKind = "allocation_exhausted"
        this.#retryAt = retryAt
        throw new CongressRequestBudgetExhaustedError(retryAt, "allocation_exhausted")
      }
      const scheduledAt = this.#nextRequestAt
      const waitMs = scheduledAt - Date.now()
      if (waitMs > 0) {
        await delay(waitMs)
      }
      this.#attempts += 1
      const interval = SECOND / this.#assignment.slotCount
      this.#nextRequestAt = Math.max(scheduledAt + interval, Date.now() + interval)
    } finally {
      gate.resolve()
    }
  }

  async observe(telemetry: HttpRequestTelemetry): Promise<void> {
    if (telemetry.status !== 429) {
      return
    }
    const retryAt = new Date(Date.now() + (telemetry.retryAfterMs ?? SECOND * 60 * 60))
    this.#exhaustionKind = "provider_cooldown"
    this.#retryAt = retryAt
    throw new CongressRequestBudgetExhaustedError(retryAt, "provider_cooldown")
  }
}

export function allocateCongressRequestBudget(
  totalAttempts: number,
  childCount: number
): readonly CongressRequestBudgetAssignment[] {
  if (
    !Number.isSafeInteger(totalAttempts) ||
    totalAttempts < 1 ||
    !Number.isSafeInteger(childCount) ||
    childCount < 1
  ) {
    throw new Error("Congress wave allocation requires positive integer inputs")
  }
  const allocatedChildren = Math.min(childCount, totalAttempts)
  const concurrentlyRunnableChildren = Math.min(allocatedChildren, CONGRESS_WAVE_CHILD_CONCURRENCY)
  const baseAttempts = Math.floor(totalAttempts / allocatedChildren)
  const remainder = totalAttempts % allocatedChildren
  const baseSlots = Math.floor(CONGRESS_WAVE_REQUESTS_PER_SECOND / concurrentlyRunnableChildren)
  const slotRemainder = CONGRESS_WAVE_REQUESTS_PER_SECOND % concurrentlyRunnableChildren
  let slotOffset = 0
  return Array.from({ length: allocatedChildren }, (_value, index) => {
    const runnableIndex = index % concurrentlyRunnableChildren
    const slotCount = baseSlots + (runnableIndex < slotRemainder ? 1 : 0)
    const result = {
      attemptBudget: baseAttempts + (index < remainder ? 1 : 0),
      slotCount,
      slotOffset
    }
    slotOffset = runnableIndex === concurrentlyRunnableChildren - 1 ? 0 : slotOffset + slotCount
    return result
  })
}

function floorSecond(value: number): number {
  return Math.floor(value / SECOND) * SECOND
}

function nextHour(value: number): number {
  return Math.floor(value / (SECOND * 60 * 60) + 1) * SECOND * 60 * 60
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
