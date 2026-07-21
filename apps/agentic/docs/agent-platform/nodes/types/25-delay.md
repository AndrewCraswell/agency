# Delay Node Review

Status: Implemented

Last reviewed: 2026-07-20

## Identity and intended job

The registry exposes `delay@1` as **Delay**. Its single job is to pause the current path for a configured duration and then continue with the same input. Delay is a timer, not an event subscription: it has no provider, resource, correlation, timeout branch, or manual resume contract.

## Configuration and ports

The author supplies a positive integer duration and selects seconds, minutes, hours, or days. The normalized duration is bounded to 30 days at authoring, compilation, and execution. The node has required **Input** and **Continued** ports with open object schemas so mapped input passes through without changing shape.

## Authoring

The inspector uses a numeric Duration control and a Unit dropdown. The maximum value changes with the selected unit so the editor cannot author a duration beyond the platform limit. The card keeps one input and one output, matching the linear mental model.

## Runtime and persistence

Delay uses the workflow journal's durable suspension machinery rather than a process timer. The executor converts the duration to seconds, computes an absolute deadline, stores the resolved input on the waiting attempt, and releases the worker lease. The dispatcher scans due suspension records after restart as well as during normal operation.

When the deadline is due, one journal transaction locks the run and suspension, changes the suspension status to `completed`, succeeds the attempt and activation, emits the stored input on **Continued**, creates downstream activations, and records `delay.completed`. The same pending-record predicate prevents duplicate dispatchers from completing the timer twice.

Delay completion is success, never timeout. Provider waits continue to use `timed_out`; the shared persistence record uses `completed` for elapsed Delay nodes so run detail and evidence retain the correct user mental model.

## Evidence and recovery

`delay.completed` records the deadline, elapsed seconds, and downstream count. The waiting attempt retains the resolved input needed for continuation, so completion does not depend on recomputing upstream values or retaining a worker lease. Cancellation and retry continue to use the journal's existing activation fencing and terminal-state rules.

Focused compiler and journal tests cover duration bounds, durable expiry, preserved input, successful activation completion, downstream scheduling, and the completed status. The repository baseline schema includes the completed suspension status directly because prototype data is disposable.

## Remaining limits

Delay supports relative durations only. Absolute timestamps, business calendars, randomized backoff, and dynamic duration expressions are separate jobs and should not be added to this node without a new product contract.
