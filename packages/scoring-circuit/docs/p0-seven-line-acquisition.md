# P0 ESP32-only BP-100 seven-line acquisition

Status: architecture definition only. Fabrication, scoring readiness, and FIE conformance are denied.

This P0 definition replaces neither the historical STM32-bound BP-103 prototype nor its unmeasured gates. It has no
active STM32 or isolation-hardware dependency. The only host is an ESP32-S3. Physical GPIO numbers are deliberately
not selected before schematic review; the P0 contract requires exactly two ESP32 outputs and one input with named nets.

## Exact acquisition order

Physical chain order is `LEFT_WEAPON_A`, `LEFT_WEAPON_B`, `LEFT_WEAPON_C`, `RIGHT_WEAPON_A`,
`RIGHT_WEAPON_B`, `RIGHT_WEAPON_C`, then `PISTE`. Each line has one ADS8881 acquisition cell. The host receives the
seven 18-bit MSB-first words in reverse chain order: `PISTE`, `RIGHT_WEAPON_C`, `RIGHT_WEAPON_B`,
`RIGHT_WEAPON_A`, `LEFT_WEAPON_C`, `LEFT_WEAPON_B`, then `LEFT_WEAPON_A`.

Every line follows this candidate path: connector line through its assigned TPD4E05U06 protected lane, 22-ohm series
resistor, TMUX1112 quiet path, ADA4177-1 unity buffer, 20-ohm plus 1-nF SAR input filter, and ADS8881 `AINP`.
`AINN` returns to `SCORING_SGND`. Each normal source is explicitly `U_REF_n.VREF_2V5` through `R_SOURCE_n` at
2.49 kilohm, `U_SOURCE_SWITCH_n.SOURCE_PATH`, then its named line; `R_SOURCE_PD_n` pulls `SOURCE_EN` to
`SCORING_SGND`. Normal source controls remain low until their interlock has been characterized.

## Candidate quantities

Seven cells use seven REF5025AQDRQ1 references, seven TMUX1112PWR switches, seven ADA4177-1ARZ buffers, and seven
ADS8881IDGS converters. Two TPD4E05U06DQAR devices provide eight shunt lanes: `U_ESD_1` lanes 1 through 4 protect
the first four named lines; `U_ESD_2` lanes 1 through 3 protect the final three. `U_ESD_2` lane 4 is
`unused-no-connect`; it must not become an unlisted input, connector path, test input, or acquisition channel.
One TPS60400DBVR is the candidate shared negative-rail generator with one 1-uF `C_NEG_IN`, `C_NEG_FLY`, and
`C_NEG_OUT`. Each cell also has C_REF_IN 1 uF, ADA4177 positive and negative 100-nF bypasses, ADS8881 AVDD and
DVDD 1-uF bypasses, and TMUX1112 100-nF bypass. The executable definition conserves every source, filter,
reference-loop, safe-state, and support quantity. TPS60400 load capability and noise remain unmeasured gates, not a
power approval.

## Rail ownership

`V5_ANALOG` supplies each REF5025 and ADA4177 plus `C_NEG_IN`; `VNEG_ANALOG` is the TPS60400 output for each
ADA4177 negative rail and its local bypass. `APP_3V3` supplies TMUX1112, ADS8881 AVDD/DVDD, and ESP32 timing I/O.
`VREF_2V5` is seven separate REF5025 outputs, each limited to its own source and ADC-reference loop. `SCORING_SGND`
is the analog return. These ownership statements are schematic-definition constraints, not rail-integrity evidence.

## ESP32 timing interface

ESP32 GPIO6 `SAR_CONVST` drives `SAR_CONVST_ALL`; GPIO4 `SAR_SCLK` drives `SAR_SCLK_ALL`; and GPIO5 `SAR_DOUT` receives
`SAR_DOUT_TO_ESP32` from `U_SAR_7.DOUT`. All three roles idle low except the input, which is sampled rather than
driven. `U_SAR_1.DIN` is grounded and each preceding `DOUT` drives the next ADC `DIN`.

Start a conversion with `SAR_SCLK` low at the rising edge of `SAR_CONVST`. Hold `SAR_CONVST` high while exactly 126
SCLK rising edges shift the seven words. At the 20-MHz target SCLK, the 126 edges take 6.3 microseconds; adding the
710-ns maximum conversion time produces a 7.01-microsecond arithmetic screen. This screen is not a measured ESP32
timing, signal-integrity, or scoring result. The selected edge policy limits SCLK to 36 MHz.

## Fail-closed behavior and characterization

On reset, brownout, watchdog recovery, a rail/reference fault, a serial framing fault, an unobserved source interlock,
or a fault/unpowered exposure, reject the entire set and disable excitation. Never reuse a partial chain read.

Before any release decision, characterize ESP32 GPIO levels and reset behavior, all-channel word mapping and timing,
reference and negative-rail loading, crosstalk, SAR settling, serial integrity, and the powered and unpowered
plus/minus guarded-fault recovery matrix. Characterize the 0-ohm and 450/475/500-ohm regions across fixture, cable,
temperature, and calibration conditions. These are required evidence items, not claims of FIE conformity.

The executable contract and focused tests are in
[`p0-seven-line-acquisition.ts`](../src/p0-seven-line-acquisition.ts) and
[`p0-seven-line-acquisition.test.ts`](../src/p0-seven-line-acquisition.test.ts).
