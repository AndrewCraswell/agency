# Processor fault-containment contract

**Contract:** M0-04
**Status:** immutable responsibility contract; physical release denied

## Boundary and vocabulary

The STM32 is the sole scoring authority. It alone acquires and timestamps
observations, applies weapon rules, classifies faults and rejections, maintains
lockout, creates source decision records, and controls primary lamp, buzzer,
and excitation outputs. The ESP32 is an application controller. It can present
accepted records, store copies, replay, provide network and local controls, and
submit bounded requests. It never scores and never drives a primary output.

M0-02 defines `safeInactive`: an output driver cannot assert a hit,
diagnostic lamp, or audible signal. Runtime `PrimaryOutputState` spells that
same condition `safe-inactive`. The explicit mapping is `safeInactive` to
`safe-inactive`; it is not a second state, alternate polarity, or scoring
rule. Likewise,
`available`, `degraded`, and `unavailable` describe service availability,
not new scoring classifications. Weapon scorers remain the only place that
determines a candidate, qualified hit, registered hit, rejection, or line
fault.

`degraded` means the STM32 is available and its authoritative acquisition and
primary outputs remain trusted, while an application service is unavailable.
`unavailable` means the STM32 cannot make trusted observations or assure
primary safe state. In an unavailable interval it registers no hit and all
scoring outputs are `safeInactive`.

## Frozen direction and reset names

The executable companion
[`../src/processor-fault-containment.ts`](../src/processor-fault-containment.ts)
freezes these exact identifiers from BP-120 through BP-123:

| Purpose | Exact net or signal | Direction and consequence |
| --- | --- | --- |
| STM32 local reset | `SCORING_NRST_N` | Scoring-local supervisor, watchdog, and SWD open-drain service only. No ESP32 path reaches it. |
| ESP32 local reset | `EN_RESET` | Application-local supervisor, watchdog, and service sink may assert it. |
| STM32 reset assertion | `ESP32_RESET_ASSERT` | BP-122 scoring-side net from STM32 PB5 that enters the isolated reset path. The BP-120 pad-allocation label is `ESP32_RESET_ASSERT_ISOLATED`. |
| Isolated reset request | `RESET_REQUEST` | Active-high application-side isolated signal that can only gate the application-domain sink of `EN_RESET`. |
| STM32 heartbeat | `STM32_HEARTBEAT` | STM32 to ESP32. Absence is application diagnostics, never a scoring decision. |
| ESP32 heartbeat | `ESP32_HEARTBEAT` | ESP32 to STM32. Absence may be recorded as an application fault but changes no acquisition or primary output. |

The permitted peer path is STM32 to ESP32 only:
`ESP32_RESET_ASSERT` to `RESET_REQUEST` to an application-domain
low-side sink of `EN_RESET`. The isolated push-pull output must not join
`EN_RESET` directly. `SCORING_NRST_N` remains scoring-local. There is no
automatic ESP32-to-STM32 reset for ESP32, link, display, storage, or network
failure. Neither heartbeat is a reset command.

The STM32 and ESP32 each have independent local supervisor and watchdog paths.
A local watchdog expiry resets only its local processor. Cross-domain reset
cannot service, mask, or replace either supervisor or watchdog.

## Required fail-closed outcomes

| Condition | STM32 and primary outputs | ESP32 and application outcome |
| --- | --- | --- |
| STM32 reset, watchdog, brownout, failed self-test, unsafe acquisition, or STM32 update | `unavailable`; no qualification or registration; excitation and primary outputs are runtime `safe-inactive` (`safeInactive` in the glossary) | May show a diagnostic or retained accepted record, never a replacement score or signal. |
| ESP32 reset, watchdog, brownout, or ESP32 update while STM32 remains healthy | STM32 continues as sole authority; its state and existing primary latch are unchanged | `degraded` until the app has recovered and re-established validated reception. |
| Link loss, invalid link bytes, storage failure, display failure, or network failure while STM32 remains healthy | No link input modifies scoring, time, lockout, or primary outputs | `degraded`; freeze last accepted presentation or show diagnostic. Missing data is never no-hit evidence. |
| Malformed, unauthenticated, out-of-state, or replayed ESP32 request | Reject without changing scoring state, configuration, output, or reset ownership | Report only a request rejection if it can. |
| Approved STM32 scoring update | Signed, locally authorized, recoverable activation only; `unavailable` through activation and recovery gates | ESP32 may deliver material or request the reviewed flow, but cannot install, select, roll back, or activate it. |
| Whole-device power loss | No scoring while unpowered. Recovery is a new boot lifecycle and cannot infer the lost interval. | Recover only durable evidence permitted by the power contract; never recreate an unrecorded result. |

A processor reset, brownout, watchdog reset, update reset, or whole-device
power loss is not `boutReset` and cannot fabricate a hit. Only the designated
supervisor path may authorize the reviewed `boutReset` transition that clears
a primary indication. An STM32 warm reset is an unavailable lifecycle fault;
this contract does not claim that an existing latch survives it.

## Hardware evidence boundary

BP-120 (STM32 allocation), BP-121 (ESP32 allocation), BP-122 (isolation), and
BP-123 (local reset, watchdog, and supervisor) are contract evidence only.
They freeze intended names, directions, defaults, and review targets. They do
not prove physical reset propagation, isolation, no-backpower behavior,
timeout, rise time, brownout response, timing, or output safety. Those remain
denied pending schematic, bench, and hardware evidence.

The M0-04 production contract carries an independent frozen provenance tuple;
it does not import circuit-package source at runtime. Focused cross-package
tests reconcile that tuple with the live BP-122 and BP-123 validators, so a
changed reset net, direction, or authority boundary fails test evidence.

Normal apparatus input remains USB-C PD. `LAB_POST_EFUSE_20V` is a 20 V
laboratory, test-only input on the mutually exclusive alternate selector
throw; it is not a second product input. Sources must be selected only while
de-energized and must never be driven simultaneously.

## Acceptance

The companion validator accepts only the exact immutable M0-04 contract. It
rejects substitutions, aliases, accessors, cycles, stale single-heartbeat or
GPIO16 reset assertions, reverse reset authority, availability relaxation, and
any physical-evidence release claim. Passing it is software-contract evidence
only, not hardware acceptance or FIE approval.
