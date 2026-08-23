# ESP32 reset combiner and HUB75 safe blanking

## Status and boundary

The architecture model now contains a schematic-level candidate for the ESP32
reset combiner and HUB75 reset defaults. It is an electrical design decision,
not a released schematic, PCB, panel harness, EMC result, or fabrication
approval. Physical land-pattern review, signal-integrity work, exact-panel
power sequencing, and EVT measurements remain open gates.

The primary references are the [ESP32-S3-WROOM-1/WROOM-1U datasheet](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf), the [TI ISO776x datasheet](https://www.ti.com/lit/gpn/iso7762), the [TI TPS3890 datasheet](https://www.ti.com/lit/gpn/tps3890), the [TI TPS3431 datasheet](https://www.ti.com/lit/ds/symlink/tps3431.pdf), the [TI SN74AHCT245 datasheet](https://www.ti.com/lit/ds/symlink/sn74ahct245.pdf), and the [Nexperia BSS138AKA datasheet](https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf).

## Reset topology

`EN_RESET` is a shared active-low node. It is pulled up only to the ESP32
`V3_3` rail and is sunk by open-drain-compatible devices. The STM32 request is
active high before isolation so the selected `ISO7762FDWR` F-option's default
low output is the non-request state when the STM32 side is absent or
unpowered.

| Function | Part or value | Connection and purpose |
| --- | --- | --- |
| ESP32 rail supervisor | `TPS389033DSER` | `SENSE` and `VDD` to `V3_3`; `MR` to `V3_3`; open-drain `RESET` to `EN_RESET`; 3.170 V falling and 3.189 V rising nominal thresholds, with +/-1% threshold accuracy |
| Supervisor release delay | `C_ESP_SUPERVISOR_CT`, 100 nF ceramic | `CT` to GND; TI's selected value is approximately 107 ms nominal release delay, subject to tolerance and measurement |
| Supervisor bypass | `C_ESP_SUPERVISOR_BYPASS`, 100 nF ceramic | `V3_3` to GND at the supervisor |
| ESP32 watchdog | `TPS3431SDRBR` | Real pin map is modeled; `WDO` pin 7 is active-low open drain to `EN_RESET`, `EN` and `SET1` are high |
| Watchdog timeout | `R_ESP_WD_CWD`, 10 kOhm, 1% | `CWD` to `V3_3`; TI's 10 kOhm selection is the 200 ms timeout option |
| Watchdog bypass | `C_ESP_WD_BYPASS`, 100 nF ceramic | `V3_3` to GND at the watchdog |
| ESP32 EN pull-up | `R_ESP_EN_PULLUP`, 10 kOhm, 1% | `V3_3` to `EN_RESET`; no pull-up comes from the STM32 domain |
| EN timing | `C_ESP_EN_DELAY`, 1 uF ceramic | `EN_RESET` to GND; approximately 10 ms with the 10 kOhm pull-up, subject to rail and leakage measurement |
| Isolated request input | `R_STM_RESET_ISO_SERIES`, 10 kOhm, 1%; `R_STM_RESET_ISO_PD`, 100 kOhm, 1% | Series-limits the STM32-side drive and holds the ISO7762 input low when the STM32 pin is absent |
| Isolated request sink | `BSS138AKA`, `Q_ESP_RESET_STM`; `R_STM_RESET_GATE`, 10 kOhm; `R_STM_RESET_GATE_PD`, 100 kOhm | ISO output drives the gate through 10 kOhm; the MOSFET drain sinks `EN_RESET`, source is application GND, and the gate cannot source the ESP32 rail |
| Manual reset | `Q_ESP_DEBUG_RESET` BSS138AKA; `R_DEBUG_RESET_GATE`, 10 kOhm; `R_DEBUG_RESET_GATE_PD`, 100 kOhm | `J_ESP_DEBUG.MANUAL_RESET_ASSERT` is an active-high command that drives only the MOSFET gate through the series resistor; drain sinks `EN_RESET`, source is application GND, and the service contact cannot source or fight the ESP32 rail |

The `ISO7762FDWR` output is not joined directly to `EN_RESET`: that would
allow a push-pull isolator output to fight the supervisor and manual sources.
The MOSFET gate and series resistor keep the isolated request from sourcing
the reset rail. The ISO776x datasheet still warns that a strongly driven input
can weakly power a floating supply, so the power-off test must measure the
source-side high request, ISO output-side voltage, ESP `V3_3`, `EN_RESET`, and
injected current. The resistor network is a containment measure, not a waived
power-off test.

The TPS3431 `RESET` label in the architecture is its physical `WDO` pin 7.
The actual `GND`, `CWD`, `EN`, `SET1`, `WDI`, `WDO`, and `ENOUT` pins are now
represented, rather than treating pin 4 as a reset output. The `ENOUT` and
`WDO` open-drain outputs are tied as permitted by TI when the watchdog is
enabled.

The application `V3_3` regulator is not present in this architecture model;
its future regulator is a separate power-design decision and must be
specified before schematic release. The `TPS389033DSER` choice is valid only if the application `V3_3` rail is
guaranteed at the supervisor pins, after regulator tolerance, load drop,
temperature, and connector or plane loss, to remain within 3.30 V +/-1%
(3.267 V to 3.333 V). That requirement leaves at least 46 mV above the
worst-case 3.189 V rising threshold when the datasheet +/-1% threshold
accuracy is included. A falling rail below the 3.170 V nominal threshold must
assert reset before the ESP32 operating margin is exhausted. The current
model has no application regulator to prove this requirement; regulator
selection, tolerance analysis, and measurement are release gates.
If the released V3_3 path cannot guarantee this window, replace the fixed
3.3 V supervisor with a lower-threshold or adjustable supervisor before
schematic acceptance rather than relying on firmware or nominal voltage.

## HUB75 default blanking

Both `SN74AHCT245PWR` devices are powered from `V5`. Their active-low buffer
enable pins are not tied permanently active. Each has a 10 kOhm pull-up to
`V5` and a `BSS138AKA` sink whose gate is driven from `EN_RESET` through 10
kOhm with a 100 kOhm gate pulldown. Thus reset, brownout, ESP32 absence, or a
dead `V3_3` rail leaves both transceivers high impedance.

The twelve ESP32-side RGB, row-address, clock, and latch inputs each have a
10 kOhm pulldown to GND. `OE_N_IN` has a 10 kOhm pull-up to `V3_3`, so the
active-low panel output-enable signal is high during the ESP32 reset and ROM
boot states. The panel-side `OE_N_OUT` has a second 10 kOhm pull-up to `V5`
so the connector remains blank if the buffer output is high impedance. The
model therefore assumes the panel logic rail is the supervised `V5` net; an
externally powered panel must use its own measured 5 V pull-up at the panel
connector instead.

This gives the following default state:

| Condition | Data, address, clock, latch | Buffer enable | Panel OE |
| --- | --- | --- | --- |
| ESP32 reset or ROM boot | Pulled low | Disabled by `EN_RESET`-gated sinks | Pulled high, blank |
| ESP32 `V3_3` absent while `V5` remains | Pulled low | Disabled because the gate pulldowns are low | Pulled high, blank |
| Normal firmware before display enable | Pulled low until firmware drives | Enabled after reset release | `OE_N_IN` pull-up keeps output high |
| Normal refresh | Firmware-controlled | Enabled | Firmware drives `OE_N_IN` low only for a qualified refresh window |

No HUB75 input pull is connected to `V5`, so a powered panel or buffer cannot
back-power an ESP32 GPIO. The exact panel's OE polarity, scan ratio, input
threshold, cable capacitance, clock rate, series damping, and panel power
return remain validation inputs.

## Verification gates that remain open

1. Scope cold boot, watchdog timeout, supervisor brownout, STM32-requested
   reset, active-high manual reset command, and `V3_3` removal. Record `EN_RESET`, both buffer
   enable pins, `OE_N_IN`, `OE_N_OUT`, and all three rails.
2. With the ESP32 rail unpowered, drive the isolated STM32 request through its
   full allowed range and measure ISO output-side rise, `V3_3` rise, reset
   current, and MOSFET gate current. Reject the topology if any rail exceeds
   its power-off limit or if reset release is observed.
3. Verify the exact N16R2 module's GPIO45 and GPIO46 strap levels with the
   10 kOhm pulldowns and AHCT input loading before selecting flash-voltage and
   eFuse policy.
4. On the exact HUB75 panel and harness, measure OE blanking, ghosting, output
   edge rate, address/data setup and hold, cable emissions, V5 droop, and
   panel power sequencing. This is the SI and panel gate, not a simulation
   claim.
5. Complete schematic ERC, manufacturer land-pattern and assembly drawing
   review, return-path review, thermal review, EMC/ESD testing, and EVT fault
   injection. Verify BSS138AKA gate drive and sink resistance at the lowest
   allowed VGS and highest temperature before approving the reset or buffer
   sinks. None of these gates is closed by the architecture model or its unit
   tests.
