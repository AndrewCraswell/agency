# M4-04 single-channel sensing coupon

**Status:** review evidence is pending. The coupon is not approved for
fabrication, power, procurement, or scoring use.

The schematic is the existing
[`one-channel-analog-experiment.circuit.tsx`](../src/one-channel-analog-experiment.circuit.tsx).
It is a one-channel learning article, not a seven-channel scoring-board
implementation. Its source path is `REF5025AQDRQ1 -> ERA3AEB2491V ->
TMUX1112PWR -> LINE`; its acquisition path uses the connector-side
TPD4E05U06DQAR shunt, 22-ohm series resistor, ADA4177-1BRZ buffer, and
ADS8881IDGS converter.

`m4-04-single-channel-coupon.ts` performs a source-bound static ERC over the
named functional nets. It confirms the defined line, quiet, source, guarded
force, reference, converter, isolated-rail, ground, and SPI connections. This
ERC is deliberately narrower than PCB or simulation output and does not
replace physical continuity, component behaviour, or generated-artwork checks.

## Footprint review queue

The executable artifact has one exact-MPN review record for each 45-reference
coupon BOM entry, across 26 distinct MPNs. An implementation reconciliation
binds each reference, MPN, package, and manufacturer-primary URL to the
schematic BOM. The source is bound to the exact MPN record, so shared package
families do not borrow another MPN's drawing review. A separate field names
`root-final-reviewer` for every drawing review. It is deliberately `pending`;
implementation work cannot approve its own footprints.

On 2026-08-24, a small first-party source batch was acquired and SHA-256 bound
for ten exact component MPNs, plus a Vishay D/CRCW e3 family drawing covering
four selected resistor MPNs as series evidence. Each Texas Instruments
datasheet names the exact orderable MPN and package and contains the
corresponding manufacturer mechanical package drawing. The YAGEO/KEMET product
specs name the exact MPN and retain the manufacturer 0603/1608 dimensions.
The Vishay source names the D/CRCW e3 0603 and 1206 families but does not name
the four exact CRCW orderables; it must not be treated as exact-MPN evidence.
These are source records only; they do not release a finished hole, copper,
mask, paste, courtyard, or orientation decision.

| Exact MPN or family scope | Manufacturer source and drawing | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| `TPS60400DBVR` | [TPS60400 datasheet](https://www.ti.com/lit/ds/symlink/tps60400.pdf), revision C, `DBV0005A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf` | `B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347` |
| `TPS7A2033PDBVR` | [TPS7A20 datasheet](https://www.ti.com/lit/ds/symlink/tps7a20.pdf), revision H, `DBV0005A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf` | `6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1` |
| `REF5025AQDRQ1` | [REF50xxA-Q1 datasheet](https://www.ti.com/lit/gpn/REF5025A-Q1), revision H, `D0008A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-ref5025a-q1-datasheet.pdf` | `908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B` |
| `ADS8881IDGS` | [ADS8881 datasheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf), revision D, `DGS0010A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-ads8881-dgs-datasheet.pdf` | `EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8` |
| `TMUX1112PWR` | [TMUX1112 datasheet](https://www.ti.com/lit/ds/symlink/tmux1112.pdf), revision C, `PW0016A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-tmux1112-pwr-datasheet.pdf` | `EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D` |
| `TPD4E05U06DQAR` | [TPD4E05U06 datasheet](https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf), revision O, `DQA0010A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-tpd4e05u06-dqar-datasheet.pdf` | `C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6` |
| `C0603C102J5GACTU` | [YAGEO/KEMET product spec](https://yageogroup.com/component-documentation/download/specsheet/C0603C102J5GACTU?lang=en), `0603/1608` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c102j5gactu-datasheet.pdf` | `B62452DE5A68C2E26AE145A4F4F4DF1D989AA5482AF4746C93A86155D5910221` |
| `T521B106M025ATE100` | [KEMET product spec](https://search.kemet.com/download/specsheet/T521B106M025ATE100), `1411/3528` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf` | `8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD` |
| `C0603C104K3RACTU` | [YAGEO/KEMET product spec](https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en), `0603/1608` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf` | `F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064` |
| `GRM21BR71A106KE51L` | [Murata GRM21 reference sheet](https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf), `GRM21` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf` | `E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F` |
| `CRCW060322R0FKEAHP`, `CRCW120656K0FKEAHP`, `CRCW0603100KFKEAHP`, `CRCW060320R0FKEAHP` | [Vishay D/CRCW e3 series datasheet](https://www.vishay.com/docs/20035/dcrcwe3.pdf), revision `14-Apr-2026`, document `20035`, `D11/CRCW0603e3` and `D25/CRCW1206e3` series drawings; exact-MPN identity not named | `packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf` | `1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3` (series evidence only) |
| `RCWE0603R220FKEA` | [Vishay Dale RCWE datasheet](https://www.vishay.com/docs/20019/rcwe.pdf), revision `24-Oct-2023`, document `20019`, `RCWE0603` series drawing; exact-MPN identity not named | `packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf` | `5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374` (series evidence only) |

The `RCWE0603R220FKEA` `R_REF_SAR` resistor now has a SHA-256-bound Vishay
Dale RCWE series source record at
`packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf`:
[Vishay RCWE source](https://www.vishay.com/docs/20019/rcwe.pdf), revision
`24-Oct-2023`, document `20019`,
`5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374`. The
source names the RCWE0603 family, 0603 dimensions, and the global part-number
fields, but does not name the exact `RCWE0603R220FKEA` orderable. It therefore
remains **series-drawing-hash-bound** evidence only; no exact-MPN drawing,
project geometry, CAD, artwork, or footprint authority is inferred.

The JST `B2B-PH-K-S(LF)(SN)` guarded-force header now has a SHA-256-bound
manufacturer source record at
`packages/scoring-circuit/docs/evidence/m4-04/jst-ph-series-datasheet.pdf`:
[JST PH series source](https://www.jst-mfg.com/product/pdf/eng/ePH.pdf),
`447624F4F2F7D37C58C1EAA7EE314AD757FE7AFF48F6186491EF6F69FBC00B96`. This is
explicitly a **series-drawing-hash-bound** record: the source provides PH-series
header layout and 2.00 mm pitch guidance, but does not prove the exact
`(LF)(SN)` suffix or release a project footprint. The exact-MPN drawing review,
CAD or absence record, artwork comparison, and independent root approval remain
pending.

The Murata `GRM21BR71A106KE51L` reference capacitor now has a SHA-256-bound
manufacturer source record at
`packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf`:
[Murata GRM21 reference sheet](https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf),
`E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F`. This is
explicitly an **exact-drawing-hash-bound** record: page one names the exact
orderable, 0805 case, X7R dielectric, and 10 uF/10 V rating, while the
manufacturer reference sheet supplies GRM21 component dimensions and reflow
land-dimension guidance. It does not create a project footprint or independent
approval.

The Molex `SD-43650-001`, revision D8, lead for the `43650-0300` Micro-Fit
3.0 fixture header remains identified but not hash-acquired. Its source record
identifies three 1.02-mm-plus-or-minus-0.05-mm component-side layout holes on
3.00-mm pitch, a circuit-one datum, 1.57-mm recommended board thickness, and
10.16-mm maximum board-edge placement. It is series-drawing evidence only.

For the remaining exact MPNs, the manufacturer-primary technical URL is
recorded as discovery evidence but the exact drawing bytes and revision remain
unacquired. A series-hash-bound source is not counted as exact-MPN evidence.
No manufacturer CAD artifact has been acquired or marked available, including
for the ten exact and two series-hash-bound source artifacts. The existing
circuit source supplies a schematic reference only, not generated footprint
artwork or an overlay. The executable tests hash-verify every retained PDF from
the repository root and inspect decompressed PDF content for the exact
orderable, series, and package-drawing markers. These are intentional, precise
blockers rather than assumed package geometry.

For every reference, the root review must acquire and hash the exact
manufacturer package drawing and CAD object, or record the manufacturer-source
absence. It then needs to compare generated artwork, pin one or polarity,
orientation, courtyard, and assembly constraints before changing any approval
state. No generic package, family drawing, or renderer output counts as this
evidence.

The existing tscircuit render test timed out in this environment. The static
ERC passes, but that timeout must be resolved or independently reproduced
before treating renderer-generated circuit output as verified.

USB-C PD remains normal apparatus power. The coupon has no USB-C, VBUS, CC, or
PD-controller connection; its isolated input is strictly an experiment
boundary. M4-06 owns a fabrication package and later M4 tasks own physical,
powered, and calibration evidence.
