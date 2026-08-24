# Power and reset-state contract

**Contract:** M0-10

**Status:** baseline contract for review
**Scope:** power, reset, safe-state, recovery, persistence, and evidence semantics for the scoring apparatus. This is not a schematic, rail budget, reset-circuit design, firmware implementation, or storage transaction format.

The executable companion [`../src/power-reset-state.ts`](../src/power-reset-state.ts) freezes this contract as
immutable fail-closed data. Its validator rejects a relaxed lifecycle, reset direction, safe-output state, persistence
boundary, boot identity, input-source selection, or hardware-evidence claim. Passing that validator is
software-contract evidence only.

This contract applies the terms in [the scoring glossary](scoring-glossary.md), the STM32/ESP32 authority boundary in
[the processor fault-containment contract](processor-fault-containment-contract.md), and the intended isolated
processor domains in [the bench prototype plan](../../../packages/scoring-circuit/docs/bench-prototype-plan.md).
The STM32G474 and ESP32-S3 allocation audits are candidate allocation evidence only. They do not prove the reset,
power, isolator, driver, or persistence paths described here.

## Contract boundary

The STM32 is the sole scoring authority. It owns scoring availability, weapon excitation, acquisition, qualification,
primary lamps, and the primary buzzer. The ESP32 owns application services and durable copies of records; its reset,
watchdog, storage, display, network, or link state cannot create, clear, alter, or reclassify an STM32 scoring decision.

`safeInactive` is the required safe output state. It means scoring output drivers do not assert a lamp or buzzer and
all source and sink excitation switches are off. It does not describe the physical state of a weapon conductor. An
unavailable interval produces no candidate promotion, qualified hit, registered hit, or inferred no-signal result.

The selected production direction has one protected nominal 24 V input, separate scoring and application power
domains, and digital isolation between their logic grounds. Its voltages, thresholds, hold-up, sequence, current
limits, and component values are later electrical work. This contract requires their outcomes, not a particular
sequencer or storage device.

## Lifecycle terms

| Term | Defined event | Required consequence |
| --- | --- | --- |
| `coldBoot` | A processor starts after its local power was absent or after no executable or volatile state may be trusted. | The processor has a new boot identity. Its outputs stay `safeInactive` until its recovery gates pass. |
| `wholeDevicePowerLoss` | The protected apparatus input and both domains can no longer be assumed powered. | No scoring occurs while power is absent. Recovery is a new whole-apparatus lifecycle, not a resumed bout. |
| `brownout` | A monitored domain supply is outside the declared operating range, or its supervisor asserts reset before trustworthy execution is assured. | The affected domain is unavailable. It must not make a decision from an uncertain interval. |
| `processorReset` | The STM32 or ESP32 alone is reset by its reset input, service action, or local control. | It is not a `boutReset`; only the affected controller restarts. |
| `watchdogReset` | A local watchdog expires and asserts that controller's local reset path. | It is a `processorReset` with watchdog cause. The other controller does not service or suppress that watchdog. |
| `supervisorReset` | The designated supervisor takes the reviewed physical or authenticated local action. | It is the only authority that may request clearing a primary latched indication. |
| `boutReset` | The STM32 accepts a supervisor-authorized transition to a new scoring state. | It clears candidates, lockout, and primary indications through the reviewed reset path and records the applied transition. |
| `updateReset` | An approved firmware activation or rollback resets the controller receiving that image. | The affected authority is unavailable until it validates the selected image and its recovery gates. |
| `linkIsolatorPowerLoss` | Either side of an isolator channel lacks valid power, so the processor link or a cross-domain control signal cannot be trusted. | It is a link/control fault, not evidence of a processor reset or supervisor request. No channel may back-power the other domain. |

`coldBoot`, `brownout`, `processorReset`, `watchdogReset`, `updateReset`, and `wholeDevicePowerLoss` are lifecycle
causes. They are never synonyms for `boutReset`. A processor reset may leave a healthy STM32 scoring while the ESP32
recovers, but a reset of the STM32 always makes scoring unavailable until the STM32 recovery gates pass.

## Safe states and reset ownership

At cold boot, brownout, watchdog expiry, STM32 reset, update activation, and any failed STM32 recovery gate:

- STM32 scoring state is `unavailable`.
- Every scoring-domain lamp and buzzer driver is `safeInactive`.
- Every weapon source and sink excitation enable is physically held off, including while the STM32 is unpowered,
  held reset, or has not configured its pins.
- No output transition is interpreted as a scoring event. Boot, reset, and diagnostic behavior must not fabricate a
  hit.

The STM32 allocation's candidate external pull-downs for the lamp, buzzer, and excitation enables are required
evidence targets, not completed circuitry. Firmware reset values alone cannot satisfy this contract.

An ESP32 reset, watchdog reset, brownout, update, or application-domain power loss must leave STM32 excitation,
scoring time, lockout, and existing primary output state unchanged when the STM32 remains healthy. The ESP32 may
freeze its last accepted presentation or show an application diagnostic, but it must not synthesize a primary signal
or treat absent records as no hit.

### Warm STM32 reset and a latched indication

The current candidate output pull networks drive lamps and buzzer inactive while the STM32 is reset. That conflicts
with the product requirement that a primary indication is cleared only through the supervisor path. No external
latch, retained-and-revalidated output state, or equivalent hardware has been selected or proven to preserve a
latched indication through a warm STM32 reset.

Therefore the current contract does **not** claim that an in-bout warm STM32 reset preserves a lamp latch, nor does it
authorize treating the resulting lamp-off state as a supervisor clear. Until a later electrical and firmware design
chooses one of those mechanisms and proves it, a warm STM32 reset is an `unavailable` lifecycle fault. It requires
diagnostic evidence and explicit recovery; it cannot silently continue the bout. This is a release blocker for any
claim that primary indications remain latched across that reset.

## Power, reset, and recovery matrix

| Condition | STM32 scoring and primary outputs | ESP32/application state | Recovery gate and required outcome |
| --- | --- | --- | --- |
| Whole-device cold boot | `unavailable`; excitation and outputs `safeInactive` | Application unavailable until its own boot completes | Each controller has a new boot identity. The STM32 may become scoring-available independently after its gates pass; the ESP32 may recover later without changing that authority. |
| Normal operation | Available only while local inputs, clock, configuration, and rail state are trusted | Mirrors accepted immutable records and provides application services | Continue only while local monitoring remains healthy. |
| STM32 brownout, processor reset, watchdog reset, or scoring update | `unavailable`; excitation and outputs `safeInactive` | May show diagnostic and preserve only already durable records | New STM32 boot identity. Technical recovery gates are necessary but, for an interrupted bout, a supervisor-authorized recovery disposition must begin a new scoring state or a future proven mechanism must restore and validate continuity. |
| ESP32 brownout, processor reset, watchdog reset, or application update | Healthy STM32 continues scoring and retains its existing primary state | Application services unavailable or recovering | New ESP32 boot identity. Re-establish validated record reception before application presentation claims current state. |
| Link loss or link-isolator power loss | A healthy STM32 continues scoring; no link input changes its decisions | Freeze last accepted state or show link diagnostic | Reject untrusted traffic. Restored link needs protocol validation and explicit fault evidence; it is not a processor reset. |
| Whole-device power loss | No scoring while power is absent; outputs de-energize | No active application service | Treat restoration as cold boot. Recover only durable data, then apply the same independent controller gates. |
| Supervisor-authorized `boutReset` | STM32 applies the reviewed clear/new-bout transition | May reflect only the accepted reset record | This is the sole normal latch-clear route. |

For a power transfer or a drop that has not crossed a declared brownout threshold, later electrical verification may
show continuous operation. This contract makes no such claim before rail measurements, supervisor thresholds,
hold-up behavior, and scoring-vector results exist. A detected or suspected power fault fails to `unavailable` rather
than being classified as a scoring outcome.

## Recovery gates

The STM32 technical recovery gates are all necessary before it can leave `unavailable`:

1. Its local rail and reset supervision report stable operation.
2. Its selected scoring firmware identity, approved timing or rule configuration, clock, RAM, and required flash
   integrity checks pass.
3. Reference, acquisition, and line-safety checks have the reviewed result; missing calibration, missing reference,
   unsafe line state, or indeterminate acquisition keeps scoring unavailable.
4. Physical output and excitation controls are proven `safeInactive` before enabling the scoring state machine.
5. Its local watchdog is active only after the preceding checks pass.
6. A new `scoringBootId` and reset or power cause are available for lifecycle evidence.

Passing those technical gates is not authority to resume an interrupted bout. After an in-bout STM32
`processorReset`, `watchdogReset`, `brownout`, or `updateReset`, the apparatus remains `unavailable` until a
supervisor-authorized recovery disposition either begins a new scoring or bout state, or a future reviewed mechanism
restores and validates continuity. No such retained-state mechanism is selected by this contract. The STM32 must never
resume the prior bout with silently cleared candidates, lockout, or primary-indication state.

The ESP32 may resume application services only after its own rail/reset supervision, firmware identity, storage
integrity, and reset-safe peripheral controls pass. It must also re-establish valid record reception before displaying
new STM32 decisions as current. Its recovery is not a gate on an otherwise healthy STM32's scoring availability.

The exact order, timing, electrical thresholds, lamp-test behavior, cross-processor reset policy, and restoration of
any application peripheral are deferred to the M3 target startup work and M5 power-sequencing schematic. The current
candidate control paths do not establish an automatic ESP32-to-STM32 reset, a working STM32-to-ESP32 `EN` reset, both
heartbeat directions, or their unpowered isolation behavior.

## Persistence boundaries

Volatile state includes processor registers and RAM, active candidates, acquisition buffers, transport buffers,
watchdog service state, live presentation state, and any uncommitted record. It is discarded on that processor's
reset or power loss and must never be used to resume a candidate, hit qualification, lockout, or latch-clear decision.

For an interrupted bout, discarded volatile state is not evidence that continuity was safely restored. Durable records
may document what preceded the interruption, but they do not automatically recreate candidates, lockout, or primary
indications. Until a future retained-state mechanism is reviewed and proven, the required recovery disposition begins
a new scoring or bout state under supervisor authority.

The intended durable boundary is limited to accepted immutable records, lifecycle records, configuration transactions,
and journal/index metadata. A latched primary indication is not assumed durable. On recovery, durable data may support
replay and diagnostics but cannot be used by the ESP32 to recreate a primary signal or decide an unrecorded hit.

M2-08 will define the storage transaction mechanism. Its required result is that interruption at every durable write
boundary yields either the prior valid state or the next valid state, never a partial record accepted as evidence.
This M0-10 contract does not prescribe F-RAM layout, flash wear leveling, checkpoint frequency, write ordering, or
hold-up capacitance.

## Required lifecycle evidence

For every observed reset, update, brownout, whole-device power loss detected after recovery, or link-isolator power
loss, evidence must contain when available:

- affected controller or power domain, cause, prior known state, resulting state, and `unavailable` interval;
- `scoringBootId` or application boot identity as applicable, firmware identity and digest, and approved configuration
  identity;
- reset-supervisor and watchdog observations, available rail measurements, input-source or UPS state, and uncertainty
  when the onset cannot be timed;
- excitation state, primary lamp and buzzer state, link/isolator state, and whether the required safe state was
  observed or merely inferred from a reviewed design;
- durable-record result: retained prior record, committed next record, or not observable because power was lost; and
- recovery-gate results, any fault that kept a controller unavailable, and the evidence capture apparatus revision.

An abrupt whole-device power loss can prevent a contemporaneous record. The first subsequent lifecycle record must
say that the outage was reconstructed after restart and must not invent an exact onset, last decision, or output state.
Bench and later hardware evidence must exercise cold boot, whole-device loss and restoration, STM32 and ESP32
independent reset, each watchdog, each supervisor or brownout path, update reset, link-isolator power loss, missing
reference, and stuck excitation/output controls. The capture must demonstrate no false qualification and the required
safe output state.

## Handoff and acceptance

This M0-10 contract defines current behavioral boundaries. M2 implements power-fail transaction scenarios and
lifecycle records; M3 implements target startup, watchdog, supervisor, and safe-output behavior; M5 closes electrical
entry, conversion, sequencing, isolation, and storage circuitry; M6 supplies fault-injection evidence. It does not
claim completed hardware, continuous operation through a transfer, durable lamp latching, an approved power topology,
or FIE approval.

Acceptance for this documentation-only milestone is review agreement that every named power or reset event has a safe
state, owner, recovery gate, persistence boundary, and evidence obligation, while unresolved electrical mechanisms
remain explicitly deferred.
