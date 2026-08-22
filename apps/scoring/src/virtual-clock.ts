/**
 * A synchronous, deterministic clock for scoring simulations.
 *
 * The clock's time is an integer number of microseconds from the current
 * scoring boot. It never reads the host clock or schedules host work.
 */

const DEFAULT_MAX_STEPS = 100_000

export type VirtualClockCallback = (atUs: number) => unknown

export type VirtualClockOptions = {
  maxSteps?: number
  startAtUs?: number
}

export type VirtualTimerHandle = number

export type VirtualClock = {
  readonly currentAtUs: number
  readonly pendingCount: number
  advanceTo: (atUs: number) => number
  cancel: (handle: VirtualTimerHandle) => boolean
  nowUs: () => number
  runUntilIdle: () => number
  scheduleAfter: (delayUs: number, callback: VirtualClockCallback) => VirtualTimerHandle
  scheduleAt: (atUs: number, callback: VirtualClockCallback) => VirtualTimerHandle
}

type ScheduledCallback = {
  atUs: number
  callback: VirtualClockCallback
  handle: VirtualTimerHandle
  order: number
}

type DueCallback = {
  event: ScheduledCallback
  index: number
}

function assertNonNegativeSafeInteger(value: number, description: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function assertCallback(callback: VirtualClockCallback): void {
  if (typeof callback !== "function") {
    throw new TypeError("Virtual clock callbacks must be functions")
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return false
  }

  return "then" in value && typeof value.then === "function"
}

function assertSynchronousResult(value: unknown): void {
  if (isThenable(value)) {
    throw new TypeError("Virtual clock callbacks must complete synchronously")
  }
}

function findNextDueCallback(queue: readonly ScheduledCallback[], throughUs?: number): DueCallback | null {
  let selected: DueCallback | null = null

  for (let index = 0; index < queue.length; index += 1) {
    const event = queue[index]
    if (throughUs !== undefined && event.atUs > throughUs) {
      continue
    }

    if (
      selected === null ||
      event.atUs < selected.event.atUs ||
      (event.atUs === selected.event.atUs && event.order < selected.event.order)
    ) {
      selected = { event, index }
    }
  }

  return selected
}

export function createVirtualClock(options: VirtualClockOptions = {}): VirtualClock {
  const startAtUs = options.startAtUs ?? 0
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS
  assertNonNegativeSafeInteger(startAtUs, "Virtual clock startAtUs")
  assertNonNegativeSafeInteger(maxSteps, "Virtual clock maxSteps")

  let currentAtUs = startAtUs
  let nextHandle = 0
  const queue: ScheduledCallback[] = []

  function scheduleAt(atUs: number, callback: VirtualClockCallback): VirtualTimerHandle {
    assertNonNegativeSafeInteger(atUs, "Virtual clock timestamps")
    assertCallback(callback)

    if (atUs < currentAtUs) {
      throw new RangeError("Virtual clock cannot schedule an event in the past")
    }

    /* v8 ignore next -- reaching this after nearly nine quadrillion schedules is not executable in a bounded test */
    if (nextHandle === Number.MAX_SAFE_INTEGER) {
      throw new RangeError("Virtual clock schedule sequence exhausted")
    }

    const handle = nextHandle
    nextHandle += 1
    queue.push({ atUs, callback, handle, order: handle })
    return handle
  }

  function scheduleAfter(delayUs: number, callback: VirtualClockCallback): VirtualTimerHandle {
    assertNonNegativeSafeInteger(delayUs, "Virtual clock delays")

    if (delayUs > Number.MAX_SAFE_INTEGER - currentAtUs) {
      throw new RangeError("Virtual clock delay exceeds the safe timestamp range")
    }

    return scheduleAt(currentAtUs + delayUs, callback)
  }

  function cancel(handle: VirtualTimerHandle): boolean {
    assertNonNegativeSafeInteger(handle, "Virtual timer handles")

    const index = queue.findIndex((event) => event.handle === handle)
    if (index < 0) {
      return false
    }

    queue.splice(index, 1)
    return true
  }

  function runOne(next: DueCallback, steps: number): void {
    if (steps >= maxSteps) {
      throw new RangeError(`Virtual clock step budget exhausted after ${maxSteps} callbacks`)
    }

    queue.splice(next.index, 1)
    currentAtUs = next.event.atUs
    assertSynchronousResult(next.event.callback(currentAtUs))
  }

  function advanceTo(atUs: number): number {
    assertNonNegativeSafeInteger(atUs, "Virtual clock timestamps")

    if (atUs < currentAtUs) {
      throw new RangeError("Virtual clock cannot move backward")
    }

    let steps = 0
    while (true) {
      const next = findNextDueCallback(queue, atUs)
      if (next === null) {
        currentAtUs = atUs
        return steps
      }

      runOne(next, steps)
      steps += 1
    }
  }

  function runUntilIdle(): number {
    let steps = 0
    while (true) {
      const next = findNextDueCallback(queue)
      if (next === null) {
        return steps
      }

      runOne(next, steps)
      steps += 1
    }
  }

  return {
    get currentAtUs() {
      return currentAtUs
    },
    get pendingCount() {
      return queue.length
    },
    advanceTo,
    cancel,
    nowUs: () => currentAtUs,
    runUntilIdle,
    scheduleAfter,
    scheduleAt
  }
}
