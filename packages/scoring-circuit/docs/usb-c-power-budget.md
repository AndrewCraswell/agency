# Preliminary USB-C power and thermal envelope

**Status:** preliminary allocation only. Adafruit product ID `2277` is the
selected EVT panel candidate, but no production-approved panel, speaker, PCB
layout, or assembled-board thermal measurement exists. This page must not be
used as fabrication approval or as a claim that a panel is compatible.

## Result

The provisional product contract/envelope remains **USB-PD SPR 20 V, 3 A, 60 W**. The executable calculation is in [`src/power-budget.ts`](../src/power-budget.ts), with regression coverage in [`src/power-budget.test.ts`](../src/power-budget.test.ts). This is not an approved input or fabrication release.

With the declared assumptions, the remaining display allocation is:

| Envelope | Source cap | Path and conversion loss | Downstream V5/system budget | Fixed system allocation | Display allocation | Equivalent 5 V current |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Continuous | 48.0 W input, 2.4 A | 8.05 W | 39.95 W | 6.79 W | **33.16 W** | **6.63 A** |
| Short peak screen | 54.0 W input, 2.7 A | 8.95 W | 45.05 W | 10.26 W | **34.79 W** | **6.96 A** |

The short-peak line is a provisional **100 ms screen** (`peakDurationMs: 100` in the executable inputs), not a converter, connector, cable, or panel inrush rating. The released panel must fit the continuous allocation at its declared worst operating image. The selected TPS56A37 V5 buck can carry the 9.01 A arithmetic peak, but the current eFuse has only about 2.40 A worst-low current limit while the 45.05 W post-shunt peak plus 0.162 W full-rail telemetry-shunt loss needs 2.66 A at this 85 percent floor. The peak line is therefore **DENY** until the source-protection or load conflict is resolved. `v5-power-stage.md` records the exact 40.73 W pre-shunt and 40.60 W post-shunt eFuse-bounded limits. A measured short peak may be considered only after output-capacitor droop, current-limit behavior, USB-C source response, cable drop, and connector temperature are measured together.

These numbers are the result of:

1. `20 V × 3 A = 60 W` contract power.
2. A 0.80 continuous and 0.90 short-peak source utilization cap. This reserves source, connector, cable, ambient, and thermal margin without requesting a 5 A cable or EPR contract.
3. A 1.0 W allowance before the buck-boost for PD/eFuse path loss and housekeeping.
4. An 0.85 V5 buck efficiency floor. This is a conservative design assumption for the 20 V to 5 V operating point, not a TPS56A37 datasheet guarantee; measure the chosen inductor, layout, switching frequency, and thermal corner.
5. A 0.90 efficiency assumption for the 5 V-to-3.3 V branch. Replace it with the selected regulator's measured worst-case efficiency before release.

The calculation intentionally does not claim that the entire 60 W contract can be consumed continuously. `60 W × 0.80` is the continuous source envelope, and the converter and fixed loads are then deducted. Do not spend the resulting display allocation twice for panel brightness and audio transients.

The path-and-conversion loss is an explicit thermal load: 1.0 W is reserved before the buck-boost for PD/eFuse path loss and housekeeping, and the 0.85 efficiency floor rejects another 7.05 W continuous or 7.95 W on the short-peak screen in the buck-boost stage. These are envelope values, not measured temperatures. Add measured inductor, switch, eFuse, connector, regulator, and PCB copper temperatures at the 50 °C blocked-vent condition before calling the thermal gate closed.

## Fixed-load allocations

The following are board-level allocations at the local rail, before the 3.3 V branch conversion. They cover the parts currently named in the circuit model but do not replace measurements.

| Group | Local rail | Continuous | Peak | Basis and limitation |
| --- | --- | ---: | ---: | --- |
| ESP32-S3-WROOM-1U-N16R2 | 3.3 V | 1.20 W | 1.50 W | Espressif specifies 355 mA peak at 3.3 V for 100% duty-cycle 802.11b TX, or about 1.17 W. The allocation is rounded upward for the N16R2 module and application activity. |
| W5500 Ethernet | 3.3 V | 0.60 W | 0.60 W | WIZnet specifies 132 mA typical at 3.3 V for normal 100 Mb/s operation, or about 0.44 W. The allocation includes interface and magnetics/LED overhead; verify at full traffic. |
| CY15B104Q, RV-3028-C7, STSAFE-A110 | 3.3 V | 0.10 W | 0.10 W | STSAFE-A110 specifies 21 mA maximum while processing. The F-RAM and RTC are much lower power, but bus pull-ups and command overlap are not measured. |
| Support and supervision | 3.3 V | 0.70 W | 1.00 W | Supervisors, isolators, pull-ups, status indicators, and currently unmeasured 3.3 V I/O. Replace with a rail measurement when the schematic and firmware are complete. |
| Scoring isolated supply and scoring domain | 5 V | 1.60 W | 2.00 W | Murata NXE1S0505MC is rated 1 W output with 64% minimum efficiency. This allocation covers full isolated output, STM32/scoring circuitry, local regulation, and tolerance. The analog front end remains unselected. |
| TAS2505TRGERQ1 audio candidate | 5 V | 1.50 W | 3.50 W | TI lists 2.6 W maximum amplifier output. Peak allocation includes output-stage loss; speaker impedance, level, duty cycle, and enclosure are not selected. |
| Two SN74AHCT245 HUB75 buffers | 5 V | 0.40 W | 0.60 W | TI's static ICC limit does not bound switching/output current. This is an interface allocation pending signal activity and rail measurement. |
| Other 5 V system loads | 5 V | 0.40 W | 0.60 W | Pull-ups, status/test loads, and unlisted 5 V housekeeping. Keep as a visible allocation until the complete BOM is measured. |

The local 3.3 V continuous sum is 2.60 W, which costs 2.89 W at V5 using the 0.90 branch-efficiency assumption. The 3.3 V peak sum is 3.20 W, which costs 3.56 W at V5. The directly V5-connected fixed allocations are 3.90 W continuous and 6.70 W peak. This produces the 6.79 W and 10.26 W fixed totals in the table above.

## What the exact panel must prove

Do not pick a panel from nominal pixel count, a reseller's “average” current, or a typical full-white number. The exact HUB75 assembly and revision must provide a manufacturer current/power specification at 5 V, and EVT must measure the actual panel:

- At the specified minimum panel voltage, record 5 V current for black, normal content, and the declared worst-case full-white/static test pattern at maximum allowed brightness and refresh settings.
- Record the highest repeatable steady current after warm-up. This must be **at or below 6.63 A at 5 V** for the panel alone under the continuous system envelope; use the lower value if the panel manufacturer specifies a stricter limit.
- Record turn-on/inrush current and duration separately. The 6.96 A short-peak screen is not an inrush approval. Any panel whose startup exceeds the output-capacitor, eFuse, or TPS56A37 transient limits requires a reviewed startup/blanking strategy.
- Include panel controller, receiving card, level shifter, fan, local regulator, and any chained panel in the panel measurement. Their current is part of `displayAllocation`.
- Measure cable drop and panel-end voltage at the same worst-case current. The panel must still meet its 5 V operating minimum, and connector/cable temperature must be recorded.
- Repeat with audio at its declared maximum and Ethernet/Wi-Fi traffic active. The system must remain inside the fixed-load assumptions and the source envelopes at 50 °C ambient with the intended enclosure and blocked-vent condition.

Until those measurements exist, the design has a **6.63 A continuous display allocation** and an EVT panel candidate, not a production-approved panel or final thermal closure. A panel that needs more capacity is a product-load conflict; do not silently raise the contract to 5 A or 28 V EPR.

The current EVT selection is Adafruit product ID `2277`. Its end-to-end
published-load screen through the application rail, V5 buck, 2 mOhm shunt, and
eFuse is recorded in [selected-panel-power-closure.md](selected-panel-power-closure.md).
That selected-panel screen fits the 40.60 W guaranteed post-shunt ceiling, but
it does not change this generic maximum-allocation **DENY** or close startup,
inrush, thermal, CAD, or measurement gates.

## Manufacturer evidence

- [Espressif ESP32-S3-WROOM-1/WROOM-1U datasheet](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf), Table 6-4: active Wi-Fi current.
- [ST STM32G474 datasheet](https://www.st.com/resource/en/datasheet/stm32g474rb.pdf), Tables 21 to 25: current is code/peripheral dependent; the 170 MHz figures are characterization data, not a complete board bound.
- [WIZnet W5500 documentation](https://docs.wiznet.io/Product/Chip/Ethernet/W5500/datasheet): 132 mA typical normal 100 Mb/s supply current.
- [Infineon CY15B104Q datasheet](https://www.infineon.com/dgdl/Infineon-CY15B104Q-PZXI-DataSheet-v07_00-EN.pdf?fileId=8ac78c8c8d2fe47b018e00f2ec4c4a0b): active/standby F-RAM current.
- [Micro Crystal RV-3028-C7 datasheet](https://www.microcrystal.com/fileadmin/Media/Products/RTC/Datasheet/RV-3028-C7.pdf): 45 nA timekeeping current at 3 V, 25 °C.
- [ST STSAFE-A110 datasheet](https://www.st.com/resource/en/datasheet/stsafe-a110.pdf), Table 3: 21 mA maximum command-processing current.
- [Murata NXE1S0505MC NXE1 datasheet](https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf): 1 W rating and 64% minimum efficiency.
- [TI TAS2505-Q1 datasheet](https://www.ti.com/lit/ds/symlink/tas2505-q1.pdf): 2.6 W-class mono Class-D output stage.
- [TI TPS56A37 product page](https://www.ti.com/product/TPS56A37/part-details/TPS56A37RPAR) and [TPS56A37EVM user guide](https://www.ti.com/lit/ug/slvuct3/slvuct3.pdf): selected 5 V, 10 A buck capability, exact reference components, and the need to consider efficiency and thermal load together.
- [TI TPS25947 datasheet](https://www.ti.com/lit/ds/symlink/tps25947.pdf): eFuse loss and quiescent-current context.
- [TI SN74AHCT245 datasheet](https://www.ti.com/lit/gpn/sn74ahct245): static ICC does not replace switching-current measurement.

This envelope is deliberately executable and revisable. It does not close panel selection, thermal validation, converter inductor selection, connector temperature, cable sizing, EMC, or fabrication gates.
