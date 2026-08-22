# Processor fault-containment contract

**Contract:** M0-04
**Status:** baseline responsibility contract for review
**Scope:** responsibility semantics between the STM32 scoring controller and ESP32 application controller. This is not a
transport-frame specification, electrical schematic, or power-sequencing design.

This contract applies the terminology in [the scoring glossary](scoring-glossary.md), the FIE mappings in
[the traceability matrix](fie-traceability-matrix.md), and the intended three-assembly boundary in
[the production board plan](../../../packages/scoring-circuit/docs/production-board-plan.md). The STM32G474 and
ESP32-S3 allocation audits are candidate evidence, not proof that every control path exists.

## Authority boundary

The STM32 is the sole **scoring authority**. It owns monotonic sample time, weapon excitation and acquisition,
line classification, qualification, rejection, fault classification, lockout, decision records at their source,
and primary output events. It directly controls the primary red, green, and white lamps and the primary buzzer in
the scoring domain. A primary output event is derived only from an STM32 decision or its safe-unavailable handling;
it is never derived from an ESP32 display state, network message, storage result, wall clock, or remote command.

The ESP32 is the **application controller**. It owns presentation, local controls, bout workflow requests, network,
identity, signed application-update delivery, durable copies of immutable records, replay, and non-authoritative time
provenance. It may mirror an STM32 decision only after the receiver accepts it under the later transport contract.
It does not own an electrical measurement, scoring timestamp, rule outcome, primary signal, scoring-firmware
activation, or the authority to clear a primary indication.

The primary signals must meet the FIE traceability matrix's output intent: lamps are latched until reset and audio
is derived from the scoring event, including while application UI work is delayed or absent. The exact output
polarity, weapon excitation, audio-mute behavior, and lamp-test mechanics remain M0-03/M0-10 decisions.

## Operations the ESP32 may request

The ESP32 sends requests, not decisions. A request is ineffective unless the STM32 accepts it in its current state
and records or acknowledges the applied result as required by the later decision-record and transport contracts.

| Request class | STM32 disposition |
| --- | --- |
| Read status, health, identities, accepted configuration, and immutable records | May answer with bounded diagnostic or record data. A missing answer is a link fault, not a scoring outcome. |
| Select an already-approved weapon or timing-table revision | May apply only from its read-only approved manifest, after required authenticated/local confirmation and a reviewed state transition. Unknown or out-of-range values fail closed. |
| Request a `boutReset` or other supervisor action | May forward the request to the designated supervisor path. The ESP32 cannot perform or imply that reset itself. |
| Request a presentation, network, replay, storage, or non-authoritative wall-time operation | Remains outside scoring. Wall time never changes `atUs` or a qualified decision. |
| Request application-controller recovery or update | May affect the ESP32 only. STM32 scoring configuration and latched primary indications are unchanged. |
| Deliver or request activation of STM32 scoring firmware | May not install, select, or activate firmware unilaterally. Activation requires a signed, locally authorized, recoverable scoring-firmware path that is separately reviewed. |

Configuration messages must be bounded, authenticated where required, and independently validated by the STM32.
The allowed set is an approved manifest, not arbitrary values supplied by the ESP32. The detailed authorization,
record schema, and frames are deliberately deferred to M0-05, M0-06, and M0-11.

## Forbidden ESP32 decisions

The ESP32 must never create, alter, infer, promote, suppress, reclassify, reorder, or clear any STM32 scoring
decision. In particular, it must not:

- assign a hit, side, weapon result, rejection, line-fault classification, lockout interval, scoring timestamp, or
  rule/timing revision;
- treat a missing, malformed, duplicated, reordered, or corrupt record as no hit, a new hit, or a replacement record;
- directly drive scoring excitation, acquisition controls, primary red/green/white lamps, or the primary buzzer;
- clear a latched primary indication through display state, a processor reset, network activity, stored data, or a
  remote command;
- use RTC or network time to adjust the STM32 monotonic scoring timeline;
- install, select, roll back, or activate STM32 scoring firmware on its own authority; or
- claim scoring availability when the STM32 has reported `unavailable`, has not completed its own self-test, or cannot
  be reached; or
- reset the STM32 merely because the ESP32 is busy, stale, unable to persist data, or has lost network connectivity.

These prohibitions also apply after an ESP32 restart and to any future display, clock, radio, or field-serial
subsystem attached to the application domain.

## Reset, watchdog, and cold-boot ownership

Each processor has an independent watchdog and supervisor in its own domain. Watchdog service begins only after that
processor has passed its local start-up conditions. Expiry resets the affected processor through its local hardware
path; it does not rely on the other processor being alive. A processor reset, watchdog reset, brownout reset, or
power cycle is not a `boutReset` and never creates a hit.

The designated supervisor owns the explicit `supervisorReset`/`boutReset` path that may clear a latched primary
signal. The STM32 applies the resulting scoring-state transition. An ESP32 reset cannot silently clear or reinterpret
an STM32 latch. Reset causes and new boot identities must be retained when storage is available.

Cold boot must default every primary output `safeInactive` and every source/sink excitation switch off. While the
STM32 is booting, resetting, brownout recovering, or watchdog recovering, it is `unavailable` until its required
self-test, input-safety checks, calibration/timing-table checks, and local watchdog supervision are valid. It must
perform no scoring qualification or hit registration in that interval. The current STM32 allocation requires physical
pulldowns for switch enables and lamp/buzzer driver inputs; firmware reset defaults alone are insufficient.

An in-bout STM32 warm reset must not silently masquerade as a `boutReset`. This exposes an unresolved constraint:
the candidate pull networks make primary outputs safe inactive during reset, whereas a latched indication may be
cleared only by the supervisor path. Preserving a latched indication across a warm STM32 reset requires an external
latch or retained and revalidated state/output mechanism; neither is present in the current model. M0-10 and hardware
design must choose and prove that behavior before release. Until then, a warm STM32 reset is an `unavailable`
lifecycle fault, not evidence that a latch was preserved or deliberately cleared.

The ESP32 may restart independently. During its recovery it must keep scoring-link outputs reset-safe, show either a
frozen last accepted state or a diagnostic state without synthesizing a primary signal, and resume only after it has
re-established record validity under the later protocol contract.

## Scoring-firmware update ownership

The ESP32 may deliver or request STM32 scoring-firmware material, but cannot install, select, roll back, or activate
it unilaterally. Scoring-firmware activation requires a signed, locally authorized, recoverable path with a separately
reviewed rollback policy. During activation and the resulting STM32 boot, scoring is `unavailable`: no scoring
qualification or hit registration occurs. The activation must create new scoring firmware and boot identities and
must emit an explicit update/reset/unavailable lifecycle record when the STM32 authority and storage path can do so.

## Link loss and degraded operation

Loss, corruption, backpressure, or reboot of the processor link does not reset either processor and cannot change
STM32 acquisition, timing, primary lamps, buzzer, or lockout. The STM32 continues scoring only when its own inputs,
configuration, and self-test remain trusted. The ESP32 freezes its last valid display state, records the link fault
when it can, and may present an application/link diagnostic. It must not turn that diagnostic into a scoring result.

`degraded` is permitted only for a healthy STM32 whose authoritative scoring and primary outputs remain available
while an explicitly non-authoritative application service is unavailable, such as display, network, replay, storage,
or the processor link. `unavailable` applies whenever trusted STM32 acquisition or output safety is absent, including
STM32 boot/reset, missing calibration, invalid timing table, unsafe line condition, or a power fault. An
`unavailable` interval produces no scoring qualification or hit registration and its primary outputs remain
`safeInactive`. It may emit explicit reset, fault, uncertainty, or unavailable diagnostic/lifecycle records when the
STM32 authority and available storage path can do so; M0-05 defines those records.

| Condition | STM32 scoring authority and primary outputs | ESP32/application behavior | Required outcome |
| --- | --- | --- | --- |
| Both controllers healthy | Available after STM32 self-test; STM32 owns decisions and primary outputs | Mirrors accepted records and provides application services | Normal operation |
| ESP32 crash, reset, or watchdog expiry | Continues if STM32 remains trusted; existing latch is unchanged | UI, network, storage, and replay are unavailable until recovery | Degraded, not a hit or reset |
| Link loss or malformed link data | Continues if STM32 remains trusted; no link input changes scoring | Freeze last valid display and record/report link fault when possible | Degraded; corrupt data is rejected |
| STM32 reset, watchdog expiry, brownout, failed self-test, or unsafe acquisition | `unavailable`; excitation and primary outputs `safeInactive` | May display diagnostic only | No scoring qualification/hit or primary signal; diagnostic/lifecycle record when possible |
| ESP32 request is unknown, unauthenticated, or outside the approved manifest | Reject without changing scoring state | Report rejection as application/configuration status | No configuration change |
| Explicit supervisor reset accepted by STM32 | Applies the reviewed bout/output reset transition | May reflect the reset record | Only permitted latch-clear route |
| Whole-apparatus power loss | No scoring qualification/hit while power is absent; recovery is a new boot | Preserve/recover only durable data allowed by M0-10 | Unavailable until both required conditions recover; lifecycle record when possible |

## Hardware-path status and release blockers

The intended directionality must not be treated as installed hardware. The STM32 allocation identifies candidate
`STM32_HEARTBEAT`, `ESP32_HEARTBEAT`, `ESP32_RESET_N`, and `STM32_RESET_N` nets, but says the circuit currently has
only one heartbeat and an STM32-to-ESP reset signal. The reverse heartbeat and reset path are not implemented.

The ESP32 allocation also identifies the present `STM32_LINK_RESET_N` at GPIO16 as a diagnostic/reset request input,
not an ESP32 hardware reset: it does not reach `EN`. A valid STM32-to-ESP32 reset requires a reset-qualified,
isolated open-drain or transistor path to `EN`, compatible with the ESP32 watchdog and supervisor. It may recover
application services only and cannot affect STM32 scoring. Ordinary ESP32, link, storage, display, or network faults
must never reset the STM32. Any ESP32-to-STM32 `NRST` path is limited to a separately authorized recovery/service
policy, cannot be an automatic reaction to those faults, and cannot back-power either domain or defeat the STM32
supervisor, watchdog, or SWD reset. Neither cross-processor reset path may be claimed by this contract before the
schematic and reset-state evidence exist.

Before M0-04 can leave review, M0-10 and the schematic work must close the following without expanding this
responsibility contract into a power-sequencing design:

1. Give both heartbeat directions declared failure polarity, isolation behavior while either side is unpowered, and
   a measured timeout policy.
2. Draw and review separate reset assertions to ESP32 `EN` and STM32 `NRST`, including watchdog, supervisor, service,
   and cross-processor sources; prove no source back-powers or masks another.
3. Prove with reset, brownout, watchdog, missing-reference, stuck-switch-enable, and isolator-power-loss tests that
   no false touch can qualify and that lamps/buzzer remain safely inactive.
4. Freeze the explicit supervisor control and authentication/local-confirmation policy that authorizes a latch-clear
   `boutReset` or timing-affecting configuration transition.
5. Resolve the warm-STM32-reset latch behavior with an external latch or retained/revalidated state/output mechanism,
   or revise the product reset behavior through M0-10 before claiming a latched signal survives that reset.
6. Define the signed, locally authorized, recoverable STM32 scoring-firmware activation and rollback path, including
   new firmware/boot identities and the unavailable lifecycle record.

## Acceptance

This documentation-only M0-04 contract is reviewable when all authority, reset, link-loss, safe-output, degraded,
unavailable, configuration, and forbidden-decision semantics above are accepted. It intentionally does not claim a
completed frame format, installed reset wiring, approved power sequence, firmware implementation, hardware evidence,
or FIE approval.
