# ADR: Remote-control ownership and authority

- **Status:** accepted for RC-01 host contracts
- **Decision date:** 2026-08-23
- **Applies to:** encrypted-IR handheld, local application, tournament controller, countdown workflow, and portable scoring-core boundary

## Decision

The bout-workflow service in the ESP32 application domain owns the countdown clock: configured and remaining duration,
running or stopped status, break, overtime, medical, passivity, and workflow event ordering. Its countdown coordinate is
not `decisionAtUs`, does not change a scoring-core monotonic scoring clock, and cannot create a `DecisionRecord`.

The portable C17 scoring core alone owns sample time, hit qualification, lockout, scoring timestamps, scoring candidate
state, primary lamps, and primary buzzer. `decisionAtUs` is a scoring-core fact scoped by `scoringBootId`; it is never used as
a countdown value or reconciled with application/network time.

`paired-handheld`, `local-application`, and `tournament-controller` are controller kinds, not scoring authorities.
Every controller carries either `referee` or `supervisor` permission. Exactly one identified controller has write
authority at a time. Every write names the current `authorityRevision`; a request from a different controller or
revision is rejected without mutation. Only a `supervisor` local application or tournament controller transfers
authority atomically to a distinct target, and only when no scoring-core-owned request is pending. A paired handheld is never
permitted to transfer authority. The transfer increments `authorityRevision`; credentials or a read-only connection do
not confer authority. Initial assignment, expiry, and forced recovery remain explicit supervisor/workflow events and
must use the same revisioned transfer record before they are implemented.

| Intent | Owner that applies it | Request and result boundary |
| --- | --- | --- |
| Countdown, score/cards, time controls, undo, side swap, and ordinary workflow state | Application bout-workflow service | Current controller request is validated and applied as an application event. |
| Complete snapshot load | Application bout-workflow service | Only an active `supervisor` local-application or tournament-controller may request it; complete snapshot validation remains required. |
| Manual or automatic scoring rearm | Portable C17 scoring core | Current controller can request it. It remains pending until a matching scoring-core acceptance or rejection. |
| Approved weapon request | Portable C17 scoring core, with application workflow correlation | The current controller, including a `referee` paired handheld, may request a workflow-approved weapon. It remains pending until the matching scoring-core response. |
| Scoring reset or new-bout transition | Portable C17 scoring core, with application workflow correlation | Current controller must have `supervisor` permission. No scoring state, latch, or bout transition is claimed until the matching scoring-core response. |
| Primary indication clear, hit, lockout, scoring timestamp, or decision record | Portable C17 scoring core | There is no application/remote command that applies this action. |
| Authority acquisition, transfer, expiry, or forced recovery | Application bout-workflow service under supervisor policy | Each is an explicit audited authority event. No timeout or failed controller silently changes writer. |

For schema-v1 compatibility, a scoring-core response still identifies `stm32-scoring` on the wire. It is accepted only for a currently pending request ID. A malformed,
unknown, duplicate, stale, unauthorized, wrong-revision, or capacity-exceeding input leaves authority state unchanged.
A scoring-core rejection is a result, not an application fallback or inferred transition. Permission is authenticated and
validated by the command boundary; it is not a credential or substitute for encrypted IR authentication.

## Consequences

The application may remain degraded or unavailable without preventing a healthy scoring core from scoring. Conversely, a
countdown pause, remote reset, ESP32 reset, or controller transfer cannot clear a primary indication or reset the scoring core.
After scoring-core reset, power loss, watchdog, brownout, or update, M0-10 recovery rules apply: scoring is unavailable until
the scoring core's own gates and explicit supervisor disposition pass. No remote path resumes an interrupted scorer.

`src/remote-control-authority.ts` is the RC-01 fail-closed host gate. It deliberately does not encode encrypted-frame
authentication, a bout reducer, snapshot contents, IR delivery, or a scoring-core transport protocol; RC-02 and later work
must supply those inputs without relaxing this ownership contract.
