# Virtual clock contract

**Contract:** M2-01

The scoring emulator uses `createVirtualClock` from `src/virtual-clock.ts` for every simulated timestamp. The clock is
an integer microsecond timeline scoped to the current scoring boot. It does not read the host clock, use host timers, or
wait for asynchronous work. This unit is the host scheduler and adapter boundary only: canonical scorer time is always
an explicit `atUs` input, not an implicit read from this clock or from a wall clock.

M0-02 requires integer microseconds (`us`) and safe-integer validation for JavaScript and TypeScript values. This
adapter therefore accepts the closed range `0` through `Number.MAX_SAFE_INTEGER` inclusive for timestamps, delays,
budgets, and handles. It does not silently round values that would exceed that range. A future C, WASM, or other
64-bit ABI may use an unsigned 64-bit representation, but the policy at this host boundary is reject-only: a value above
the safe range must be rejected by an explicit checked adapter, never rounded into a JavaScript `number`. A separate
`bigint` or native scheduler would require its own contract. This contract does not make JavaScript `number` a
general-purpose 64-bit ABI type.

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

## Scenario runner integration

`runScenario` creates a fresh clock for each scenario and schedules every listed input at its validated `atUs`. The
clock callback argument is passed into the epee, foil, and sabre rule adapters, so scorer advancement occurs only from
the virtual timeline. Listed inputs must be monotonic; a backward input is rejected with the stable
`non-monotonic-time` scenario error and its input ID. The runner does not call `Date`, `performance`, host timers, or
an asynchronous scheduler.

Scenario `determinism.seed` is part of the contract and is validated as a non-negative safe integer. The domain report
serializer is stable: replaying the same scenario or manifest with the same seed produces byte-identical report JSON.
The seed does not authorize host randomness, and changing it is an explicit scenario change even when the current
deterministic adapters do not consume randomness.

## Ordering and reentrancy

Callbacks are ordered by ascending deadline. When deadlines are equal, the stable tie-break is the monotonically
increasing schedule handle, which is assigned in call order. Scheduling at the current timestamp is valid and runs
after the callback currently executing, while scheduling in the past is rejected. No random seed or host state affects
this order, so identical inputs produce identical observable callback order.

Callbacks must complete synchronously. A callback result that is promise-like is rejected with a `TypeError`; the
scheduler never awaits it or hides wall-clock work. A callback may schedule or cancel other callbacks synchronously.
Drain operations are deliberately non-reentrant: a callback calling `advanceTo` or `runUntilIdle` receives a
`TypeError`. This prevents an inner drain from changing the current timestamp underneath its outer drain. The drain
guard is released after success or failure, so a later top-level operation can continue inspecting the queue.

## Bounds and errors

Every timestamp and delay is a non-negative safe integer in microseconds. The maximum safe timestamp is executable,
including a zero-delay callback at that endpoint; a positive delay from that endpoint is rejected because it would
overflow. A delay must not make `currentAtUs + delayUs` exceed `Number.MAX_SAFE_INTEGER`. The clock rejects backward
`advanceTo` calls and past absolute deadlines with `RangeError`. Invalid callbacks, asynchronous callback results,
recursive drains, and invalid handles have explicit `TypeError` or `RangeError` failures.

Each drain operation stops with a `RangeError` when its callback count reaches `maxSteps`. This bounds same-time
rescheduling and future rescheduling loops. The callback that would exceed the budget is not run, and its pending work
remains queued for inspection or a later operation with a larger budget.

The UI may use host `setInterval` or another presentation timer to redraw a view, but those timers are presentation-only
and must not advance or define scorer time. Scenario and server integrations must feed explicit canonical `atUs` values
into the scorer. Byte-identical scenario/server output and C/WASM agreement remain downstream M2/CW gates; this host
clock unit does not claim that full integration or ABI parity is already closed.

Scenario input timestamp validation has a stable boundary error: values that are not non-negative safe integers are
reported as `timestamp-out-of-range` before execution. This includes all contract fields whose names end in `Us`, such
as input, decision, classification, diagnostic, uncertainty, and non-event timestamps. Values within the safe range
may still be rejected later for domain reasons such as non-monotonic ordering.
