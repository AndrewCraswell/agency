# Reset and recovery scenario contract

**Task:** M2-10
**Status:** executable host-model contract

## Boundary

`src/reset-recovery-scenarios.ts` coordinates the existing M2 virtual
processor link and event journal to make M0-10 lifecycle requirements
testable. It is not a firmware reset implementation, an electrical supervisor,
or a substitute for the STM32 scorer. No scenario action calls a weapon scorer,
generates a decision record, or derives a primary lamp or buzzer event.

The model starts with explicit STM32 and ESP32 boot identities. Every affected
processor reset produces a new deterministic boot identity. Diagnostics are
bounded, immutable snapshots with the current identities, journal recovery
state, scoring availability, and primary-output state.

## Reset ownership

| Condition | Scoring result | Application result |
| --- | --- | --- |
| STM32 watchdog, brownout, operator, or approved update reset | Scoring becomes unavailable, excitation/primary output is `safe-inactive`, and a new scoring boot ID is created. | No application action creates a replacement scoring decision. |
| ESP32 reset | A healthy STM32's availability, boot ID, and primary output are unchanged. | New application boot ID, journal reopen, then explicit record-reception validation. |
| Link loss or reconnect | A healthy STM32 remains authoritative and unchanged. | Link diagnostics are recorded. Reconnection is not a processor reset or a scoring recovery disposition. |
| Whole-device power loss | Both controllers become unavailable and primary output is `safe-inactive`. | Restoration creates two new boot identities and reopens only the durable journal checkpoint. |

An ESP32 request to reset the STM32 is explicitly rejected with an
`automatic-esp32-to-stm32-reset-forbidden` diagnostic. It changes neither
STM32 availability nor its boot ID or primary output.

## STM32 recovery

After an STM32 reset, all five technical gates must pass: rail/reset
supervision, clock/configuration, acquisition/line safety, safe output
controls, and watchdog arming. Passing them leaves scoring
`awaiting-supervisor-disposition`; it does not silently resume the interrupted
bout. Only `supervisorAuthorizeNewScoringState()` makes the virtual STM32
available again.

The model records `warm-reset-latch-unresolved` for every STM32 reset and
whole-device loss. This implements M0-10's explicit unresolved status: the
model neither claims that a previous primary latch survives a warm reset nor
treats the observed inactive output as a supervisor clear.

## Persistence and evidence

The model opens the existing M2-08 journal after ESP32 reset and after
whole-device restoration. It exposes the journal's recovery outcome rather than
repairing records. Thus a write interrupted at an M2-08 boundary recovers only
the old committed checkpoint or the complete new one, never a partial record.

`src/reset-recovery-scenarios.test.ts` covers independent processor resets,
watchdog/brownout/operator/update causes, link loss and reconnection,
whole-device recovery, old/new journal recovery, boot-ID changes, primary-output
authority, failed gates, and the forbidden automatic reset path.
