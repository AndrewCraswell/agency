# BP-050 analog and reference rail budget

## Decision and boundary

This page is the narrow BP-050 analog and reference rail slice. Its executable
source is [`p0-analog-rail-budget.ts`](../src/p0-analog-rail-budget.ts). It
uses the selected one-channel protected topology from BP-100 through BP-102,
the seven explicit cells from BP-103, and one shared TPS60400 negative-rail
generator.

The result is paper arithmetic that can be added to the BP-050 power tree. It
does not prove a populated board, a regulator limit, a startup waveform,
thermal margin, transient response, or a scoring-ready rail.

The one-channel source rows are marked DNP because that is the status of the
standalone experiment BOM. They provide selected identities and declared
component bounds only. DNP is not treated as zero physical load and is not
treated as evidence of population.

## Exact graph

```text
BP-050 V5 from TPS56A37RPAR
  -> V5_ANALOG / SCORING_SGND
       -> U_REF_1..7 REF5025AQDRQ1 IN
       -> U_OVP_BUFFER_1..7 ADA4177-1ARZ positive supply
       -> U_NEGATIVE_RAIL TPS60400DBVR IN
            -> VNEG_ANALOG / SCORING_SGND
                 -> U_OVP_BUFFER_1..7 negative supply

BP-050 APP_3V3 / SCORING_SGND
  -> U_SOURCE_SWITCH_1..2 TMUX1112PWR VDD
  -> U_SOURCE_CONTROL SN74HCS595PWR
  -> U_SAR_1..7 ADS8881IDGS AVDD and DVDD

U_REF_n OUT
  -> REF_2V5_n
       -> R_SOURCE_n ERA3AEB2491V 2.49 kohm
            -> one channel of U_SOURCE_SWITCH_1..2 -> external conductor
       -> R_REF_SAR_n RCWE0603R220FKEA 0.22 ohm
            -> C_REF_n GRM21BR71A106KE51L 10 uF -> U_SAR_n REF

All analog returns, ADC AINN, reference returns, charge-pump ground, and
local bypass returns -> SCORING_SGND.
```

`APP_3V3` is the current clean-sheet application rail. `SCORING_3V3` is not
a vertex in this graph. STM32 supply and GPIO loads, an STM32 scoring domain,
`NXE1S0505MC` or any isolation converter, and an isolated link are explicitly
excluded. This slice also does not duplicate ESP32, Ethernet, HUB75, IR,
primary-output, USB-PD, eFuse, display, or V5 buck loads owned by other
BP-050 slices.

## Quantities

Each of the seven cells has 17 selected electrical rows. Shared source-control and protection packages are counted
once for the board rather than replicated per line:

| Function | MPN | Quantity | Rail or return role |
| --- | --- | ---: | --- |
| Reference | `REF5025AQDRQ1` | 7 | `V5_ANALOG` input, `REF_2V5_n` output |
| ESD shunt | `TPD4E05U06DQAR` | 2 | seven protected lanes plus one unused lane |
| Normal series | `CRCW060322R0FKEAHP` | 7 | passive signal path |
| Source switch | `TMUX1112PWR` | 2 | seven channels used across two quad packages |
| Source control | `SN74HCS595PWR` | 1 | serial control with reset clear and hardware output disable |
| Source resistor | `ERA3AEB2491V` | 7 | `REF_2V5_n` source path |
| Source pull-down | `CRCW0603100KFKEAHP` | 7 | control default to `SCORING_SGND` |
| OVP buffer | `ADA4177-1ARZ` | 7 | `V5_ANALOG` and `VNEG_ANALOG` supplies |
| SAR series and filter | `CRCW060320R0FKEAHP`, `C0603C102J5GACTU` | 7 each | signal path to `AINP` |
| SAR converter | `ADS8881IDGS` | 7 | `APP_3V3`, `REF_2V5_n`, `SCORING_SGND` |
| REF5025 input bypass | `CGA3E3X7R1H105K080AB` | 7 | `V5_ANALOG` to `SCORING_SGND` |
| REF5025 output support | `T521B106M025ATE100`, `C0603C104K3RACTU` | 7 each | `REF_2V5_n` to `SCORING_SGND` |
| ADC reference feed and reservoir | `RCWE0603R220FKEA`, `GRM21BR71A106KE51L` | 7 each | local `REF_2V5_n` loop |
| Buffer bypass | `C0603C104K3RACTU` | 14 | positive and negative buffer rails |
| ADC bypass | `CGA3E3X7R1H105K080AB` x2 | 14 | `APP_3V3` to `SCORING_SGND` |
| Switch and source-control bypass | `C0603C104K3RACTU` | 3 | `APP_3V3` to ground |

The shared negative rail has one `TPS60400DBVR`, one `C_NEG_FLY`, one
`C_NEG_IN`, and one `C_NEG_OUT`. The machine-readable contract therefore
contains 119 per-cell electrical placements plus 13 shared placements,
132 total topology placements. Connectors and probe points from the
standalone experiment are not rail loads.

## Continuous and 100 ms peak arithmetic

The declared screen uses all seven source paths enabled with a 0 ohm external
line. The source current is bounded by the selected 2.5 V reference and the
2.49 kohm resistor:

```text
I_SOURCE,cell = 2.5 V / 2,490 ohm = 1.004016 mA
I_SOURCE,seven = 7 x 1.004016 mA = 7.028112 mA
```

The following are component-bound screens, not assembled load measurements.

| Rail | Arithmetic | Continuous screen | 100 ms peak screen |
| --- | --- | ---: | ---: |
| `V5_ANALOG` input | 7 x 1.2 mA REF5025 quiescent + 7 x 1.004016 mA source output + 7 x 0.6 mA ADA4177 positive supply + (7 x 0.6 mA + 0.27 mA) TPS60400 ideal-current input screen | 24.098112 mA, 120.491 mW | same paper value |
| `VNEG_ANALOG` output | 7 x 0.6 mA ADA4177 negative supply | 4.200 mA, 21.000 mW delivered | same paper value |
| `APP_3V3` bounded subtotal | 7 x 2.4 mA ADS8881 AVDD + 2 x 1 uA TMUX supply + 2 uA register screen + 7 x 33 uA source pull-down + 33 uA output-enable pull-up | 17.068 mA, 56.324 mW | same bounded subtotal |
| `REF_2V5_n` output | 7 x 1.004016 mA source load | 7.028112 mA, 17.570 mW | same source-on screen |

The `APP_3V3` number is deliberately a subtotal. ADS8881 DVDD, serial-I/O
switching, conversion-phase current, and reference input dynamics have no
complete selected worst-case contract here. The REF5025 10 mA output rating
leaves 2.971888 mA after the source-path-only screen, but that is not a pass
because the ADS8881 reference load and transient waveform remain open.

The TPS60400 60 mA output rating leaves 55.8 mA against the 4.2 mA buffer
screen. Its efficiency, output impedance, ripple, startup behavior, and
temperature are not included as proof. The `V5_ANALOG` charge-pump term is
an ideal-current screen, not a vendor efficiency guarantee.

## Startup arithmetic

No product rail slew is selected. For a reproducible comparison only, the
contract reports capacitor charging at a declared 1 ms linear ramp using the
nominal rail voltage. It must not be used as a startup-current limit.

| Rail | Capacitance counted | 1 ms capacitor-only screen |
| --- | ---: | ---: |
| `V5_ANALOG` | 8.7 uF: seven 1 uF REF5025 input capacitors, seven 100 nF buffer-positive capacitors, and 1 uF shared charge-pump input | 43.500 mA |
| `VNEG_ANALOG` | 1.7 uF: seven 100 nF buffer-negative capacitors and 1 uF shared output capacitor | 8.500 mA |
| `APP_3V3` | 14.3 uF: fourteen 1-uF ADC bypasses plus three 100-nF switch/control bypasses | 47.190 mA |
| `REF_2V5` | 140.7 uF: seven `(10 uF + 100 nF + 10 uF)` reference loops | 351.750 mA |

The flying capacitor is a switched charge-pump component, not a direct
steady-state rail capacitor. The real startup sequence, soft-start, current
limit, rail discharge, ADC reset state, source-enable default, and brownout
behavior require captures. Startup receives no BP-050 credit.

## Transient arithmetic

BP-101 contains an illustrative passive-only 100 nC, 1 us reference stimulus.
Retaining it as a named screen gives:

```text
I_REFERENCE,cell = 100 nC / 1 us = 100 mA
I_REFERENCE,seven = 7 x 100 mA = 700 mA
8 uF local reservoir droop = 100 nC / 8 uF = 12.5 mV
0.1 ohm ESR step at 100 mA = 10 mV
illustrative unregulated step = 22.5 mV
```

This is explicitly zero-credit. It is not an ADS8881 conversion-current
claim, not a REF5025 upper bound, and not a simultaneous seven-converter
waveform. The actual transient gate requires reference output and local
reference traces during one conversion, sustained seven-converter bursts,
source switching, ADC activity, and controlled power transitions.

## Open physical evidence and BP-050 handoff

The following evidence remains open before BP-050 can be marked complete:

- assembled-part manifest, received-part inspection, and exact capacitor
  effective value, ESR, ESL, and DC-bias evidence;
- V5_ANALOG, VNEG_ANALOG, APP_3V3, REF5025 OUT, and ADS_REF2V5 voltage, current,
  ripple, load-step, and return-current captures;
- cold, room, and hot startup, brownout, power-off, and discharge traces;
- TPS60400 efficiency, output impedance, negative-rail ripple, thermal
  margin, current limit, and post-fault recovery;
- ADS8881 AVDD, DVDD, serial-I/O, conversion-phase, and REF-current
  measurements at the selected seven-channel scan cadence;
- one-cell and simultaneous-seven-cell crosstalk, source-switch charge
  injection, and reference-loop recovery;
- schematic/ERC, exact footprints, placement, routing, DRC, rail-return
  review, and the BP-050 independent power review.

The executable authority remains `completeRailBudgetPassed: false`,
`physicalPowerEvidencePassed: false`, `fabricationAuthorized: false`, and
`releaseState: deny`. This artifact feeds the BP-050 reconciliation; it does
not close BP-050 or authorize power application.

## Primary source records

- [BP-103 seven-channel analog architecture](bench-prototype-seven-channel-analog.md)
- [BP-101 reference-drive contract](bench-prototype-reference-drive.md)
- [BP-100 one-channel analog topology](bench-prototype-analog-topology.md)
- [TI ADS8881 datasheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf)
- [TI REF5025A-Q1 datasheet](https://www.ti.com/lit/ds/symlink/ref5025a-q1.pdf)
- [Analog Devices ADA4177-1 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf)
- [TI TPS60400 datasheet](https://www.ti.com/lit/ds/symlink/tps60400.pdf)
- [TI TMUX111x datasheet](https://www.ti.com/lit/ds/symlink/tmux1112.pdf)
