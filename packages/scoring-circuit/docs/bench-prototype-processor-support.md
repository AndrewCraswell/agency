# BP-125 processor support contract

This is the executable schematic-capture checklist for the exact
`STM32G474RET3TR` LQFP64 and `ESP32-S3-WROOM-1U-N16R2` module. It is not a
schematic, footprint, layout, RF, power-up, or fabrication approval. The
canonical contract is `src/bench-prototype-processor-support.ts`.

## Clock decisions

The STM32 HSE footprint is deliberately **DNP**: PF0/PF1 stay reserved and no
crystal, oscillator, load capacitor, or MPN is claimed. LSE is also **DNP**;
PC14/PC15 stay unconnected. BP-300 must either select, calculate, lay out, and
measure an exact HSE solution or prove that HSI tolerance is adequate for every
scoring and transport timing consumer. An RTC or backup-time need is a new pin
allocation decision.

The ESP32 timing source is integrated in its exact WROOM-1U module. No external
40 MHz source may be attached. The module-owned flash/PSRAM pins remain
unavailable.

## Mandatory support networks

The STM32 receives one local 100 nF X7R bypass at each VDD pin (16, 32, 48,
64), a local 4.7 uF-minimum ceramic bulk capacitor, VDDA with 10 nF plus 1 uF
to VSSA, VREF+ with 100 nF plus 1 uF to VSSA, and a 100 nF VBAT bypass. VBAT ties only to the
committed no-backup `SCORING_3V3_NO_BACKUP_TIE`. VREF+ remains the committed
2.5 V reference and must never be replaced by the 3.3 V rail.

The four STM32 digital bypass references (`C_STM_VDD16`, `C_STM_VDD32`,
`C_STM_VDD48`, and `C_STM_VDD64`) have the exact Murata
`GCM188R71H104KA57D` selection. The retained manufacturer reference sheet is
[`docs/evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf`](evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf),
SHA-256
`5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A`.
It identifies 100 nF X7R, 50 V, 0603 (1608M), and a -55 to 125 C operating
range. Murata characteristic responses for -40, 25, 85, and 125 C are retained
as raw JSON with the retained request-context file (SHA-256
`B46660B122DCEF2DF94D30DCD2C4C1E4602D36350006B14E94B4F97F31004D58`) and
an ordered temperature/path/SHA-256 record in the executable contract. This
unit makes no numeric DC-bias claim; those responses remain typical
characterization evidence only and do not establish lot, assembled-board,
placement, impedance, or derated-capacitance release.

The ESP32 module receives 100 nF X7R plus 22 uF-minimum ceramic directly from
pad 2 to its ground pads and exposed pad. Exact capacitor MPNs and footprints
are intentionally `TBD`; their voltage rating, DC-bias derating, impedance,
placement, and independent footprint evidence remain release gates.

The STM32 BOOT0 pulldown is now selected as Yageo `RC0603FR-0710KL`, a 10 kOhm,
1%, 0603 / 1608 thick-film resistor. The manufacturer product specification is
retained at
[`docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf`](evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf)
and is bound to SHA-256
`EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497`. The
source identifies 0.1 W operation at 70 C, a 75 V maximum continuous voltage,
and the 0603 / 1608 case. This closes only the exact MPN identity for
`R_STM_BOOT0`; it does not claim a land pattern, artwork, schematic sign-off,
or fabrication authority.

The ESP32 `BOOT_N` GPIO0 pullup is also selected as the same Yageo
`RC0603FR-0710KL` 10 kOhm, 1%, 0603 / 1608 resistor. It is bound to the same
archived manufacturer source and digest above. This closes only the exact MPN
identity for `R_ESP_BOOT_PULLUP`; its strap behavior, land pattern, artwork,
schematic sign-off, and fabrication authority remain subject to their existing
gates.

The frozen BP-123 `EN_RESET` topology also selects `R_ESP_EN_PULLUP` as the
same Yageo `RC0603FR-0710KL` part. Its 3.3 V, 10 kOhm, 1% pullup dissipates at
most 1.089 mW in the asserted-low case, within the source's 0.1 W at 70 C and
75 V maximum continuous-voltage ratings. This closes only the exact MPN
identity for `R_ESP_EN_PULLUP`; the separate 1 uF delay capacitor, reset timing
measurements, land pattern, artwork, schematic sign-off, and fabrication
authority remain open.

## Boot, reset, unused pins, layout, and release

STM32 BOOT0 has a required 10 kOhm pulldown. ESP32 EN has a 10 kOhm pullup and
1 uF delay capacitor; GPIO0/`BOOT_N` has a 10 kOhm pullup. BP-123 remains the
only owner of supervisor/watchdog reset sources, which must be open-drain.
GPIO3 stays electrically quiet; GPIO45/GPIO46 retain weak pulldowns and have
only high-impedance AHCT loads during reset. BP-121 assigns GPIO35/module pad
28 to application-only `IR_RX` on ESP32-S3 `RMT_RX`; the BP-146 receiver
front-end hardware remains unselected and must be electrically inactive through
reset and boot. GPIO36/GPIO37 are reserved `NC_AUDIO_DNP` pads with no host
routing, and GPIO33/GPIO34 are not exposed by N16R2. The BP-145
`TAS2505TRGERQ1` audio row is DNP and has no host or I2C stub. STM32 unused pads
have no external functional net and firmware puts them into the low-leakage
state without defeating hardware safety pulls.

Place each bypass at its named supply pin with its direct local return. Keep
the STM32 analog/reference loops local to the analog domain. Follow Espressif's
exact WROOM-1U land pattern, exposed-pad ground-via, paste, and clearance
policy. The module contains its RF connector, so no host-board U.FL or 50 Ohm
RF route is permitted. Instead, independently review the exact external antenna,
cable, connector clearance/retention, antenna keepout, and noise separation.
Application 3.3 V must be valid before EN release, and
scoring 3.3 V before NRST release, with BP-123 owning thresholds and delays.

All layout, capacitance, clock, power sequencing, RF, schematic-signoff, and
fabrication evidence is denied until independently reviewed and measured.
