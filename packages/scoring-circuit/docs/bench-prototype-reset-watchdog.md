# Prototype reset, watchdog, and brownout contract

`BP-123` defines the exact schematic-level supervision and reset network for
the one-board bench prototype. It uses the committed `BP-120` STM32 and
`BP-121` ESP32 allocation. It is not an approved footprint, layout, bench, or
fabrication release.

## Prerequisites and authority

The application network requires `BP-142` to validate its exact `V3_3`
implementation first. That is only a conservative regulator calculation, not
an assembled-board voltage approval. `SCORING_3V3` is separately supervised
in its own ground domain. `BP-050` supplies the isolated-scoring V5 branch and
`BP-122` fixes the `NXE1S0505MC` path through `SCORING_5V_ISOLATED`, but the
local `SCORING_3V3` regulator remains a `BP-300` integration gate. It must
prove at least 3.22089 V at the scoring supervisor SENSE/VDD pins before reset
release. The STM32 remains scoring authority whether the ESP32 is reset,
absent, or unpowered.

There is no ESP32-to-STM32 reset path. An STM32 firmware recovery request may
reset the ESP32 through the one-way isolation path, but a STM32 watchdog or
supervisor event does not automatically make that request.

## Exact local networks

Both domains use one TI `TPS389033DSER` precision supervisor and one TI
`TPS3431SDRBR` watchdog. Each supervisor has exact KEMET
`C0603C104K3RACTU` 100 nF CT and local-bypass capacitors. Each watchdog has
the same exact 100 nF bypass capacitor and `RC0603FR-0710KL` 10 kOhm, 1%
`CWD` resistor for the 200 ms selection. `VDD`, `EN`, and `SET1` are local to
their respective 3.3 V rail; `WDI` comes only from `PC9` on STM32 or GPIO12
on ESP32.

Each WDI has an exact Yageo `RC0603FR-07100KL` 100 kOhm, 1% pull-up to its
local 3.3 V rail. Firmware configures the owning GPIO open-drain, idles by
releasing it high, and kicks only with a falling edge by briefly sinking low
then releasing. The target interval is at most 100 ms, below the 170 ms
minimum timeout. High-Z, stuck-high, and stuck-low firmware all cease
producing repeated falling edges and therefore time out deterministically; a
static level is never credited as a kick.

For both TPS389033 devices, the nominal falling threshold is 3.170 V and the
nominal rising threshold is 3.189 V with 1% threshold accuracy. The exact 100
nF CT part is screened to 61.2 nF effective minimum. The conservative
calculation gives 53.04 ms guaranteed-minimum release delay and 106.98 ms
nominal. These are calculation inputs, not substitutes for rail-slew,
temperature, lot, and capacitor measurements.

For both TPS3431 devices, 10 kOhm from CWD to local VDD with SET1 high selects
a 170 ms minimum, 200 ms nominal, and 230 ms maximum watchdog timeout. The
same 170/200/230 ms limits apply to the reset pulse. The open-drain WDO and
ENOUT pins are tied together at the local processor-reset node, providing the
same 170-to-230 ms startup reset interval. VDD must remain at least 1.8 V for
300 us before WDI becomes active, and firmware must allow the 150 us WDI
response setup interval.

`SCORING_NRST_N` has an `RC0603FR-0710KL` 10 kOhm pull-up to `SCORING_3V3`
and `C_STM_NRST_FILTER` `C0603C104K3RACTU` 100 nF to `SCORING_SGND`.
Supervisor reset, watchdog WDO, and an open-drain-only SWD probe can pull it
low. The probe must never source that net.

`EN_RESET` has an `RC0603FR-0710KL` 10 kOhm pull-up to `V3_3` and a TDK
`C1608X5R1A105K080AC` 1 uF capacitor to `APP_GND`. The ESP32 supervisor,
watchdog, STM32 request sink, and manual-request sink can only pull it low.
The service header has no direct electrical path to `EN_RESET`.

The application supervisor does not connect directly to both reset nets.
Its open-drain output creates `APP_SUPERVISOR_RESET_N` with
`R_APP_SUPERVISOR_RESET_PULLUP`. Both inputs of exact TI
`SN74LVC2G07DCKR` `U_APP_RESET_FANOUT` observe that node. Its open-drain Y1
drives `EN_RESET`; Y2 independently drives `APP_W5500_RESET_N`. Each output
has its own 10 kOhm pull-up, and the fanout has exact
`C0603C104K3RACTU` 100 nF bypass. Therefore a watchdog, manual-reset, or STM32
request sink on `EN_RESET` cannot reset W5500 or pull the supervisor input
low. `APP_W5500_RESET_N` is supervisor-only.

## Cross-domain reset combiner

The only permitted peer-reset path uses the exact `BP-122` net names:

`STM32 PB5 ESP32_RESET_ASSERT` -> `R_STM_RESET_ISO_SERIES` 10 kOhm ->
`ISO7762FDWR` channel 4 -> `RESET_REQUEST` -> `R_STM_RESET_GATE` 10 kOhm ->
`Q_ESP_RESET_STM` `BSS138AKA` low-side sink -> `EN_RESET`.

`R_STM_RESET_ISO_PD` is `RC0603FR-07100KL` 100 kOhm from the scoring-side
isolator input to `SCORING_SGND`. It forces an unpowered, reset, or missing
STM32 request low. On the application side,
`R_STM_RESET_GATE_PD` is the same 100 kOhm part from the MOSFET gate to
`APP_GND`. The FET drain can sink `EN_RESET`; it cannot source `V3_3`.
The full power-off injection test remains mandatory because this resistor/FET
containment is not proof of isolation behavior.

Manual ESP32 reset uses the same sink pattern: active-high
`MANUAL_RESET_ASSERT` passes through `R_DEBUG_RESET_GATE` 10 kOhm to
`Q_ESP_DEBUG_RESET` `BSS138AKA`; `R_DEBUG_RESET_GATE_PD` holds that gate low.

## Required observable states

| Condition | STM32 reset | ESP32 reset | Peer effect |
| --- | --- | --- | --- |
| Cold start | Held low until scoring supervisor releases | Held low until application supervisor releases | Isolation request defaults low |
| Application brownout | Unaffected | Supervisor fanout Y1 holds `EN_RESET` low | Fanout Y2 independently holds W5500 reset |
| Scoring brownout | Supervisor holds `SCORING_NRST_N` low | Unaffected | Request defaults low |
| Local watchdog timeout | Its own watchdog pulls local reset low | Its own watchdog pulls local reset low | No automatic peer reset |
| Manual reset | SWD probe sinks `SCORING_NRST_N` only | Manual command drives its local FET sink | Local only |
| STM32 ESP request | Unaffected | `Q_ESP_RESET_STM` pulls `EN_RESET` low | STM32 to ESP32 only |
| Application off, scoring on | Unaffected | Cannot release | No app-rail back-power is permitted |
| Scoring off, application on | Unpowered | Unaffected | False request must remain impossible |

## Schematic integration preflight remains unsubmitted

`schematicIntegrationPreflight` is a typed extraction checklist for the future
BP-300 schematic. It does not represent a schematic source, rendered PDF,
ERC result, independent review, or physical evidence. Its state is
`not-submitted`; its required artifacts are absent; and every authority flag
remains `DENY`.

Before an independent schematic review can begin, an integrator must submit
hash-bound source, rendered-PDF, and ERC-report artifacts from one lowercase
Git commit. The extraction must report zero unexplained ERC errors and
warnings, and reproduce every frozen critical net and endpoint in order. The
preflight checks the processor pins `U_STM32.NRST@7`, `U_STM32.PC9@41`,
`U_STM32.PB5@58`, `U_ESP32.EN@3`, and `U_ESP32.GPIO12@20`; the local reset,
supervisor, watchdog, pull-up, capacitor, and sink endpoints; the W5500
supervisor-only reset fanout; and the ISO7762 channel-4 boundary from
`ESP32_RESET_ASSERT` to `RESET_REQUEST`.

An accepted synthetic or future extraction means only that its static netlist
matches this frozen BP-123 contract. It never authorizes integration,
fabrication, a physical test, or scoring operation. The canonical preflight
cannot hold a submitted record until BP-300 supplies real source artifacts and
an independent reviewer accepts them.

## Physical-capture intake remains empty

The executable `physicalEvidenceIntake` is an intake schema, not evidence.
It contains no capture, prototype identity, instrument identity, calibration
artifact, procedure, input profile, artifact ID, or digest. Its state is
`absent` and every authority flag remains `DENY` until a real assembled
prototype is measured.

A submitted record must contain exactly one measured capture in this
canonical order: `BP123-COLD-START`, `BP123-BROWNOUT`, `BP123-WATCHDOG`,
`BP123-MANUAL-RESET`, `BP123-CROSS-DOMAIN`, and `BP123-POWER-OFF`. Each record
must identify the same assembly, board revision, and serial number. It must
identify its instrument by manufacturer, model, and serial number, bind its
calibration certificate as an artifact ID and lowercase SHA-256 digest, and
place the measurement date inside that calibration period. A capture also
binds distinct trace, setup, exact procedure-revision, and injected-input
profile artifacts and hashes.

The evaluator computes acceptance from finite, frozen, typed limits instead of
a submitter-supplied result. It requires reset assertion and release timing at
cold start and manual reset; falling and rising thresholds plus hysteresis in
both domains for brownout; both watchdog timeout and reset-pulse durations; cross-domain
request and reset propagation; and both power-off backfeed currents plus reset
release voltage. Each capture must provide exactly its required metrics with
the expected unit and no duplicate or extra measurement. Named signals remain
mandatory. Repeated trace/setup/input artifact IDs or digests, omitted fields,
aliases, accessors, malformed timestamps, or out-of-limit values fail closed.

## Gates still denied

Bench captures must cover cold start, brownout, normal falling-edge watchdog
kicks, high-Z/stuck-high/stuck-low WDI faults, watchdog timeout and reset
pulse, manual reset,
cross-domain reset, and both power-off cases. They must include both rails,
both reset nets, `APP_SUPERVISOR_RESET_N`, both reset-fanout outputs, W5500
reset, watchdog WDI/WDO/ENOUT, heartbeats, `ESP32_RESET_ASSERT`,
`RESET_REQUEST`, and injected current. `BP-122` must close isolator-channel
direction/default behavior. `BP-144` depends on `EN_RESET` for reset-safe
HUB75 blanking and may not add a reset source. Exact scoring-rail
implementation, footprint evidence, placement/return path review, ERC,
independent schematic review, schematic integration, and all physical
measurements remain denied until their own gates close.
