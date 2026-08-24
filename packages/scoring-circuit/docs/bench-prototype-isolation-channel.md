# BP-122 pin-level isolation channel contract

## Status and provenance

BP-122 freezes the pin-level digital isolation contract for the one-board bench
prototype. Its executable source of truth is
[`src/bench-prototype-isolation-channel.ts`](../src/bench-prototype-isolation-channel.ts),
with focused regression coverage in
[`src/bench-prototype-isolation-channel.test.ts`](../src/bench-prototype-isolation-channel.test.ts).

This is a schematic-input and review contract only. The schematic, footprint,
bench, and fabrication gates are all `deny`. It does not authorize a schematic
release, a land pattern, a board order, or a claim that powered-off leakage,
back-power, rise time, creepage, clearance, or signal integrity has passed.

The validator checks the committed [BP-040 net-class contract](./bench-prototype-net-classes.md),
[BP-120 STM32 allocation](./stm32-pin-allocation.md), and
[BP-121 ESP32 allocation](./esp32-pin-allocation.md). Any omission,
substitution, alias, accessor, direction change, domain tie, reset path, or
release relaxation fails closed.

## Domains and isolated power

| Domain | Owner | Digital supply | Ground | Power relationship |
| --- | --- | --- | --- | --- |
| Scoring | `STM32G474RET3TR` | `SCORING_3V3` | `SCORING_SGND` | Receives `SCORING_5V_ISOLATED` from `NXE1S0505MC`, then regulates locally to `SCORING_3V3`. |
| Application | `ESP32-S3-WROOM-1U-N16R2` | `APP_3V3` | `APP_GND` | Supplies the `V5` input of `NXE1S0505MC`. |

`APP_GND` and `SCORING_SGND` remain separate on every layer. `NXE1S0505MC`
crosses isolated power only: its application-side input is `V5` with
`APP_GND`, and its scoring-side output is `SCORING_5V_ISOLATED` with
`SCORING_SGND`. No ground, signal return, shield, or high-current copper
crosses with it.

## ISO7762FDWR pin-level map

`ISO7762FDWR` uses scoring-side supply pins 1 and 8 and application-side supply
pins 16 and 9. The F-option default output is low when its driving side is
absent. The signal map is:

| Channel | Direction | Scoring-side pin and net | Application-side pin and net | Endpoint mapping |
| ---: | --- | --- | --- | --- |
| 1 | scoring to application | pin 2, `SCORE_SCK` | pin 15, `SCORE_SCK` | STM32 PC10 pad 52 to ESP32 GPIO4 pad 4 |
| 2 | scoring to application | pin 3, `SCORE_MOSI` | pin 14, `SCORE_MOSI` | STM32 PC12 pad 54 to ESP32 GPIO5 pad 5 |
| 3 | scoring to application | pin 4, `SCORE_CS_N` | pin 13, `SCORE_CS_N` | STM32 PA15 pad 51 to ESP32 GPIO7 pad 7 |
| 4 | scoring to application | pin 5, `ESP32_RESET_ASSERT` | pin 12, `RESET_REQUEST` | STM32 PB5 pad 58 to `Q_ESP_RESET_STM` BSS138 gate |
| 5 | application to scoring | pin 6, `SCORE_MISO` | pin 11, `SCORE_MISO` | ESP32 GPIO6 pad 6 to STM32 PC11 pad 53 |
| 6 | application to scoring | pin 7, `ESP32_HEARTBEAT` | pin 10, `ESP32_HEARTBEAT` | ESP32 GPIO15 pad 8 to STM32 PB4 pad 57 |

The scoring-side supply and ground are pins 1 and 8. The application-side
supply and ground are pins 16 and 9. `SCORE_CS_N` is active low; its F-option
default low is not treated as a valid frame select. The ESP32 accepts only a
complete, bounded, CRC-checked record after its reset and protocol readiness
checks.

## ISO7721FDR pin-level map

`ISO7721FDR` uses scoring-side supply pins 1 and 4 and application-side supply
pins 8 and 5:

| Channel | Direction | Scoring-side pin and net | Application-side pin and net | Endpoint mapping |
| ---: | --- | --- | --- | --- |
| 1 (B) | scoring to application | pin 3, `STM32_HEARTBEAT` (`INB`) | pin 6, `STM32_HEARTBEAT` (`OUTB`) | STM32 PB3 pad 56 to ESP32 GPIO17 pad 10 |
| 2 (A) | application to scoring | pin 2, `SERVICE_ONLY_REVERSE_CHANNEL` (`OUTA`) | pin 7, `SERVICE_ONLY_REVERSE_CHANNEL` (`INA`) | Service observation only; no ESP32 product GPIO and no STM32 GPIO or `NRST` connection |

The reverse channel is retained only as a service-only isolation lane. It is
not a reset path, watchdog path, scoring input, or substitute for a reviewed
processor allocation.

## Default and powered/unpowered truth table

The F-option fail-safe default is low only when the input side loses power or
signal while the destination/output-side VCCO remains powered. When the
destination/output-side VCCO is absent, the output is undetermined or
unpowered; this contract does not convert that state into a claimed low. A low
default is an electrical state, not proof that an application protocol treats
that state as a valid record. The unpowered rows remain bench measurements:
output voltage, injected current, rail rise, and reset release must be recorded
on the exact parts before schematic acceptance.

| Domain state | Expected isolated defaults | Reset behavior | Authority behavior |
| --- | --- | --- | --- |
| Both powered | F-low applies only on input-side power or signal loss while the destination/output-side VCCO is powered; otherwise channels follow their inputs. | `RESET_REQUEST` is low unless STM32 intentionally asserts it; local supervisors and watchdogs remain independent. | STM32 remains the sole scoring authority. |
| Scoring powered, application unpowered | Application-side outputs are undetermined or unpowered because application VCCO is absent; reverse channels whose scoring output side is powered may show F-low for absent application input. No application GPIO may be back-powered. | `RESET_REQUEST` is undetermined or unpowered; `Q_ESP_RESET_STM` must not release `EN_RESET`. No back-power evidence is claimed, and no signal reaches STM32 `SCORING_NRST_N`. | STM32 acquisition and primary safe-state control continue without ESP32. |
| Application powered, scoring unpowered | Scoring-side outputs are undetermined or unpowered because scoring VCCO is absent; scoring-input loss can produce F-low only on application outputs whose VCCO remains powered. Application treats SPI and `STM32_HEARTBEAT` as invalid. | `RESET_REQUEST` is fail-safe low because application/output-side VCCO is present; application-local sources may control `EN_RESET`; no reverse channel reaches STM32 `NRST`. | ESP32 cannot create a scoring decision or command scoring outputs. |
| Neither powered | All receiver outputs are undetermined or unpowered because both destination/output-side VCCO rails are absent, with no permitted cross-domain rail or ground path. | Both reset systems are unpowered; no cross-domain reset source is active. | No scoring action is possible and neither domain may be back-powered. |

## Heartbeat and reset behavior

- `STM32_HEARTBEAT` travels through ISO7721FDR channel B (pin 3 `INB` to pin 6
  `OUTB`) from STM32 PB3 to
  ESP32 GPIO17. A missing STM32 heartbeat is an application-observed fault;
  with application VCCO powered, input-side loss is F-low; with application
  VCCO absent, output is undetermined. It does not let the application qualify
  a hit or drive scoring outputs.
- The ISO7721FDR channel A path is the opposite direction: application-side pin
  7 `INA` to scoring-side pin 2 `OUTA`, carrying only
  `SERVICE_ONLY_REVERSE_CHANNEL`. It has no product GPIO or STM32 `NRST`
  connection.
- `ESP32_HEARTBEAT` travels through ISO7762FDWR channel 6 from ESP32 GPIO15 to
  STM32 PB4. Its external pull-down holds the failed/inactive state during
  ESP32 reset or input-side power loss while scoring VCCO remains powered. If
  scoring VCCO is absent, output is undetermined. STM32 may record the
  application fault, but must keep acquisition, qualification, lamps, and
  buzzer under its own authority.
- `ESP32_RESET_ASSERT` is a one-way STM32 output. ISO7762FDWR channel 4
  produces active-high `RESET_REQUEST`; it drives the `Q_ESP_RESET_STM`
  BSS138 gate through the reviewed resistor network. The MOSFET sinks the
  application `EN_RESET` node and prevents the isolator's push-pull output from
  sourcing or fighting that node.
- The application reset fanout is exact: `U_APP_RESET_FANOUT.Y1` and
  `U_ESP_WATCHDOG.WDO+ENOUT`, together with `Q_ESP_RESET_STM` and
  `Q_ESP_DEBUG_RESET`, are the only application-side reset sinks represented by
  BP-122. The fanout `Y2` output is not an ESP32 reset source.
- `SCORING_NRST_N` is scoring-local. Its allowed sources are the STM32 local
  supervisor, local watchdog, and SWD service header. No ESP32 GPIO, heartbeat,
  application supervisor, ISO7762 reverse channel, or ISO7721 reverse channel
  connects to it. The ESP32 cannot automatically reset the STM32.

## Remaining evidence gates

Before any schematic or footprint release, the review must measure both
isolators and both domains on the exact candidate parts:

1. Cold start with each domain powered alone and with both domains powered.
2. Rail removal while each side drives every permitted high state.
3. Isolator output voltage, injected current, `APP_3V3`, `SCORING_3V3`,
   `EN_RESET`, and `SCORING_NRST_N` during source-side and destination-side
   power loss.
4. Heartbeat timeout, STM32-requested ESP32 reset, local ESP32 watchdog reset,
   local STM32 watchdog reset, and manual service reset.
5. CRC-bounded SPI acceptance with false `SCORE_CS_N` defaults and malformed or
   partial records.
6. Physical slot, creepage, clearance, copper keepout, decoupling, return-path,
   land-pattern, signal-integrity, and EMC review.

Passing the executable contract or its unit tests does not close any of these
physical gates. BP-122 remains `releaseState: "deny"` and
`fabricationRelease: false`.
