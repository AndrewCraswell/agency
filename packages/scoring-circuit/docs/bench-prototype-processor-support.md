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

The STM32 DS12288 supply range is 1.71 V to 3.6 V for VDD and VDDA; its VREF
buffer supports the committed 2.5 V reference. VBAT is a backup-domain supply,
but this design explicitly ties it only to `SCORING_3V3_NO_BACKUP_TIE`. The
ESP32-S3-WROOM-1U datasheet specifies a 3.0 V to 3.6 V 3V3 input. Its primary
PDF is retained at
[`docs/evidence/bp-125/espressif-esp32-s3-wroom-1-wroom-1u_datasheet-v1.8.pdf`](evidence/bp-125/espressif-esp32-s3-wroom-1-wroom-1u_datasheet-v1.8.pdf),
SHA-256 `27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435`.
The official ST URL is recorded in the executable contract but could not be
retrieved as bytes from this workspace, so it is explicitly URL-only evidence.

The eight remaining support rows now have exact automotive `GCM` selections.
Murata presents the `GCM` series for automotive powertrain and safety
equipment, with AEC-Q200 evidence at the series/reference-sheet level. The
product URLs are manufacturer primary identity evidence; a blocked
manufacturer product endpoint means those rows remain URL-only, except the
retained 100 nF reference sheet already described above and the retained 2.2
uF reference sheet below. The retained raw SimSurfing DC-bias responses are
manufacturer bytes and are hash-bound in the executable contract. They record
the base part number without its packaging suffix (`L` or `D`), the
`c_dcbias_capacitance` characteristic, temperature, AC test level, and a
typical 3.5 V sample point. They are typical curves only, not a guaranteed lot,
impedance, placement, or assembled-board result.

| References | Exact MPN | Nominal and role | Conservative selection basis |
| --- | --- | --- | --- |
| `C_STM_3V3_BULK` | Murata `GCM32ER71E106KA57L` | 10 uF, ±10%, 25 V, X7R, 1210 | 3.5 V, 25 C typical raw point is 10.251 uF, exceeding the 4.7 uF effective requirement; 25 V gives wide 3.3 V rail margin. |
| `C_STM_VDDA_HF` | Murata `GCM188R71H103KA37D` | 10 nF, ±10%, 50 V, X7R, 0603 | 3.5 V, 125 C typical raw point is 9.245 nF. The 50 V, 125 C X7R part keeps the analog local high-frequency role distinct from the bulk part. |
| `C_STM_VDDA_BULK`, `C_STM_VREF_BULK` | Murata `GCM21BR71E225KA73L` | 2.2 uF, ±10%, 25 V, X7R, 0805 | Reused only because both roles require at least 1 uF effective. The 3.5 V, 25 C typical raw point is 2.211 uF, above both the 3.3 V VDDA and 2.5 V VREF+ operating voltages. The retained manufacturer sheet is [`murata-gcm21br71e225ka73-01.pdf`](evidence/bp-125/murata-gcm21br71e225ka73-01.pdf), SHA-256 `26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19`, and its official Murata archive URL is [`GCM21BR71E225KA73-01.pdf`](https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GCM21BR71E225KA73-01.pdf). |
| `C_STM_VREF_HF`, `C_STM_VBAT`, `C_ESP_3V3_HF` | Murata `GCM188R71H104KA57D` | 100 nF, ±10%, 50 V, X7R, 0603 | Reuse is valid because each is a 100 nF local high-frequency role. Existing 3.5 V, 125 C typical data is 92.300 nF. |
| `C_ESP_3V3_BULK` | Murata `GCM32EC71A476KE02L` | 47 uF, ±10%, 10 V, X7S, 1210 | The 3.5 V, 25 C typical raw point is 40.253 uF, leaving substantial margin over the 22 uF effective requirement. X7S is used here only because it preserves effective bulk margin at a 10 V rating; its wider temperature drift remains a measurement gate. |

The retained GCM21 reference sheet also gives exact package-body dimensions:
2.0 ±0.15 mm length, 1.25 ±0.15 mm width, 1.25 ±0.15 mm thickness, 0.2 to
0.7 mm terminal width, and at least 0.7 mm terminal gap. These are package-body
and terminal dimensions only. They are not a PCB land pattern, pad, mask,
paste, courtyard, or manufacturer CAD release. The other rows carry package
identity only; no unretained package drawing or CAD geometry is inferred.

All chosen capacitor dielectric ranges are -55 C to 125 C. The numeric
DC-bias screens are deliberately at 3.5 V, above either committed 3.3 V rail
and the 2.5 V VREF+ rail. The 47 uF X7S response uses AC0.5 Vrms; the other
retained remaining-cap responses use AC1 Vrms. Temperature coverage is
complete only for the 10 nF part and the existing 100 nF part; the 2.2 uF,
10 uF, and 47 uF raw curves are 25 C samples. Therefore no production
effective-capacitance guarantee is claimed for those three parts, especially
the X7S ESP32 bulk capacitor.

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
