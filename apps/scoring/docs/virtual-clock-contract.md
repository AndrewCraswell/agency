# Virtual clock contract

**Contract:** M2-01

The scoring emulator uses `createVirtualClock` from `src/virtual-clock.ts` for every simulated timestamp. The clock is
an integer microsecond timeline scoped to the current scoring boot. It does not read the host clock, use host timers, or
wait for asynchronous work.

## API

- `createVirtualClock({ startAtUs, maxSteps })` creates a clock at `startAtUs`, defaulting to zero. `maxSteps` is the
  non-negative safe-integer callback budget for each `advanceTo` or `runUntilIdle` operation and defaults to 100,000.
- `scheduleAt(atUs, callback)` queues a callback at an absolute timestamp. `scheduleAfter(delayUs, callback)` computes
  the timestamp from the current clock. Both return a numeric handle.
- `cancel(handle)` removes a pending callback and returns whether that handle was pending.
- `advanceTo(atUs)` runs all pending callbacks at or before `atUs`, then exposes `atUs` as the current time. It returns
  the number of callbacks run.
- `runUntilIdle()` runs pending callbacks, including callbacks scheduled by callbacks, until the queue is empty. It
  does not advance time when the queue is already empty and returns the number of callbacks run.
- `currentAtUs`, `nowUs()`, and the callback argument expose the same current timestamp.

## Ordering and reentrancy

Callbacks are ordered by ascending deadline. When deadlines are equal, the stable tie-break is the monotonically
increasing schedule handle, which is assigned in call order. Scheduling at the current timestamp is valid and runs
after the callback currently executing, while scheduling in the past is rejected. No random seed or host state affects
this order, so identical inputs produce identical observable callback order.

Callbacks must complete synchronously. A callback result that is promise-like is rejected with a `TypeError`; the
scheduler never awaits it or hides wall-clock work. A callback may schedule or cancel other callbacks synchronously.

## Bounds and errors

Every timestamp and delay is a non-negative safe integer in microseconds. A delay must not make `currentAtUs + delayUs`
exceed `Number.MAX_SAFE_INTEGER`. The clock rejects backward `advanceTo` calls and past absolute deadlines with
`RangeError`. Invalid callbacks, asynchronous callback results, and invalid handles have explicit `TypeError` or
`RangeError` failures.

Each drain operation stops with a `RangeError` when its callback count reaches `maxSteps`. This bounds same-time
rescheduling and future rescheduling loops. The callback that would exceed the budget is not run, and its pending work
remains queued for inspection or a later operation with a larger budget.
