# M4-04 single-channel sensing coupon

**Status:** review evidence is pending. The coupon is not approved for
fabrication, power, procurement, or scoring use.

The schematic is the existing
[`one-channel-analog-experiment.circuit.tsx`](../src/one-channel-analog-experiment.circuit.tsx).
It is a one-channel learning article, not a seven-channel scoring-board
implementation. Its source path is `REF5025AQDRQ1 -> ERA3AEB2491V ->
TMUX1112PWR -> LINE`; its acquisition path uses the connector-side
TPD4E05U06DQAR shunt, 22-ohm series resistor, ADA4177-1ARZ buffer, and
ADS8881IDGS converter.

The protected buffer orderable is `ADA4177-1ARZ`; the former `BRZ` suffix was
not a manufacturer-listed ADA4177-1 orderable. Analog
Devices' [ADA4177-1 product page](https://www.analog.com/en/products/ADA4177-1.html)
and [Rev. E data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf)
identify `ADA4177-1ARZ` as the 8-lead R SOIC variant. The retained HTML
capture binds the product-page identity and Rev. E data-sheet identity by
SHA-256, but it is not a manufacturer package drawing, CAD object, or
footprint artifact. The direct manufacturer PDF remains identified but
unacquired; no project artwork, orientation review, or fabrication authority
has been added.

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

On 2026-08-24, a small manufacturer-source batch was acquired and SHA-256 bound
for thirteen exact package-drawing MPNs and two exact primary-identity captures,
plus a Vishay D/CRCW e3 family drawing covering four selected resistor MPNs as
series evidence. Each Texas Instruments
datasheet names the exact orderable MPN and package and contains the
corresponding manufacturer mechanical package drawing. The YAGEO/KEMET product
specs name the exact MPN and retain the manufacturer 0603/1608 dimensions.
The Panasonic ERA3A evidence binds the exact `ERA3AEB2491V` orderable to the
`0603`/`1.6 x 0.8 mm` package identity and the ERAA/ERA3A manufacturer drawing;
the separate Panasonic recommended-land-pattern table is retained as guidance
only. Panasonic's exact CAD-status capture records that no manufacturer CAD
data is published for this product; third-party links on that page are not
manufacturer CAD evidence.
The Vishay source names the D/CRCW e3 0603 and 1206 families but does not name
the four exact CRCW orderables; it must not be treated as exact-MPN evidence.
These are source records only; they do not release a finished hole, copper,
mask, paste, courtyard, or orientation decision.

| Exact MPN or family scope | Manufacturer source and evidence scope | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| `TPS60400DBVR` | [TPS60400 datasheet](https://www.ti.com/lit/ds/symlink/tps60400.pdf), revision C, `DBV0005A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf` | `B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347` |
| `TPS7A2033PDBVR` | [TPS7A20 datasheet](https://www.ti.com/lit/ds/symlink/tps7a20.pdf), revision H, `DBV0005A` | `packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf` | `6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1` |
| `REF5025AQDRQ1` | [REF50xxA-Q1 datasheet](https://www.ti.com/lit/gpn/REF5025A-Q1), revision H, `D0008A` | `packages/scoring-circuit/docs/evidence/bp-031/ti-ref50xxa-q1-ref5025aqdrq1-datasheet-rev-h.pdf` | `908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B` |
| `ADS8881IDGS` | [ADS8881 datasheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf), revision D, `DGS0010A` | `packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf` | `EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8` |
| `TMUX1112PWR` | [TMUX1112 datasheet](https://www.ti.com/lit/ds/symlink/tmux1112.pdf), revision C, `PW0016A` | `packages/scoring-circuit/docs/evidence/bp-031/ti-tmux1112pwr-pw0016a-datasheet-rev-c.pdf` | `EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D` |
| `ERA3AEB2491V` package drawing | [Panasonic ERAA datasheet/package drawing](https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf), exact MPN product identity maps `ERA3AEB2491V` to ERA3A/0603; manufacturer dimensions `L 1.60 +/- 0.20`, `W 0.80 +/- 0.20`, `T 0.45 +/- 0.10 mm` | `packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf` | `FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79` |
| `ERA3AEB2491V` exact identity | [Panasonic exact product page](https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V), exact `ERA3AEB2491V`, `0603` / `1.6 x 0.8 mm`, 2490 ohm, 0.1%, 0.1 W, 25 ppm/K | `packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html` | `BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048` (exact identity; not a drawing) |
| Panasonic high-precision ERA land-pattern guidance | [Panasonic recommended land pattern](https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf), high-precision ERA, 1608 (0603): `a 0.7-0.9`, `b 2.0-2.2`, `c 0.8-1.0 mm` | `packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf` | `65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D` (manufacturer guidance; not project CAD) |
| Panasonic exact CAD-status record | [Panasonic ERA3AEB2491V CAD-status page](https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V/cad), page states no Panasonic CAD data is available and links only third-party providers | `packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html` | `ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D` (manufacturer CAD explicitly unavailable) |
| `TPD4E05U06DQAR` | [TPD4E05U06 datasheet](https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf), revision O, `DQA0010A` | `packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf` | `C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6` |
| `C0603C102J5GACTU` | [YAGEO/KEMET product spec](https://yageogroup.com/component-documentation/download/specsheet/C0603C102J5GACTU?lang=en), `0603/1608` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c102j5gactu-datasheet.pdf` | `B62452DE5A68C2E26AE145A4F4F4DF1D989AA5482AF4746C93A86155D5910221` |
| `T521B106M025ATE100` | [KEMET product spec](https://search.kemet.com/download/specsheet/T521B106M025ATE100), `1411/3528` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf` | `8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD` |
| `CGA3E3X7R1H105K080AB` | [TDK automotive MLCC catalog](https://product.tdk.cn/system/files/dam/doc/product/capacitor/ceramic/mlcc/catalog/mlcc_automotive_general_zh.pdf), exact orderable plus CGA3 0603/1608 dimensions and land-pattern guidance | `packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-automotive-general-zh.pdf` | `E6F5803E89514DC61813BF2C96414D784005274730A8AF43A5EF54EBD546DBFF` |
| `ADA4177-1ARZ` identity scope only | [Analog Devices ADA4177-1 product page](https://www.analog.com/en/products/ADA4177-1.html) and [Rev. E data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf), exact orderable and `R-8` package identity; not a package drawing | `packages/scoring-circuit/docs/evidence/m4-04/analog-devices-ada4177-1arz-product.html` | `A456369D2013DAF8E166E9CC2BCB1AAF54834FA86EAA292F5C1BE89EBE316703` |
| `C0603C104K3RACTU` | [YAGEO/KEMET product spec](https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en), `0603/1608` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf` | `F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064` |
| `GRM21BR71A106KE51L` | [Murata GRM21 reference sheet](https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf), `GRM21` manufacturer dimensions | `packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf` | `E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F` |
| `NXE1S0505MC` | [Murata NXE1 series datasheet](https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf), `KDC_NXE1.A01`, manufacturer mechanical dimensions and recommended footprint details | `packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf` | `53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40` |
| `CRCW060322R0FKEAHP`, `CRCW120656K0FKEAHP`, `CRCW0603100KFKEAHP`, `CRCW060320R0FKEAHP` | [Vishay D/CRCW e3 series datasheet](https://www.vishay.com/docs/20035/dcrcwe3.pdf), revision `14-Apr-2026`, document `20035`, `D11/CRCW0603e3` and `D25/CRCW1206e3` series drawings; exact-MPN identity not named | `packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf` | `1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3` (series evidence only) |
| `RCWE0603R220FKEA` | [Vishay Dale RCWE datasheet](https://www.vishay.com/docs/20019/rcwe.pdf), revision `24-Oct-2023`, document `20019`, `RCWE0603` series drawing; exact-MPN identity not named | `packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf` | `5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374` (series evidence only) |

The selected 1-uF MLCC for `C_REF_IN`, both ADS8881 supply bypasses, all
three TPS60400 capacitors, and both 3.3-V regulator capacitors is TDK
`CGA3E3X7R1H105K080AB`: 1 uF +/-10%, 50 VDC, X7R, EIA 0603 / metric 1608,
-55 C to 125 C, automotive grade and AEC-Q200. TDK identifies
`C1608X7R1H105K080AB` as its commercial-grade counterpart; it is a rationale
alternative only and is not selected.

Two additional acquired files bind the exact selection and TDK model-source
discovery without asserting a project footprint or a numeric 5-V capacitance:

- The exact-part TDK product-information report mirrored by Farnell is retained
  as `packages/scoring-circuit/docs/evidence/m4-04/tdk-cga3e3x7r1h105k080ab-detail.pdf`,
  SHA-256 `8692A2973DD875110C6F3FE3EB0A688454C0A155DCC8FCFAF3130F6862EC316F`.
- TDK's MLCC Virtual Component Library parts list is retained as
  `packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-virtual-component-library-parts-list.pdf`,
  SHA-256 `B71416318033D9E0E50E4386A758FE58E133805F289B0200DFDE983B4FDA6DA4`.
  TDK lists DC-bias models for this part family, but model download requires
  separate acceptance of TDK simulation-model terms. No model or raw CSV bytes
  were acquired, so exact effective capacitance at 5 V remains `null` and is
  not used in an analog or error-budget calculation.

TDK's product page recommends the following land-pattern ranges in millimeters:
for flow soldering, `PA 0.70-1.00`, `PB 0.80-1.00`, and `PC 0.60-0.80`; for
reflow, `PA`, `PB`, and `PC` are each `0.60-0.80`. These are source-backed
manufacturer recommendations only. No project CAD, pad geometry, mask, paste,
courtyard, artwork, orientation, procurement, or fabrication approval follows
from them.

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

The JST `PHR-2` guarded-force mate is also recorded as a separate **mate-only,
series-drawing-hash-bound** source record in the coupon artifact. Page 3 of the
retained PH-series PDF explicitly lists `PHR-2` as the two-circuit housing with
`A = 2.0 mm` and `B = 5.8 mm`. That exact housing identity does not supply
project CAD, a board land pattern, an artwork overlay, or footprint authority.
The mate record remains informational and does not add a second footprint
review row.

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

The Murata Power Solutions `NXE1S0505MC` isolated converter now has a
SHA-256-bound `KDC_NXE1.A01` source record at
`packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf`:
[Murata NXE1 series datasheet](https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf),
`53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40`. The
retained document names the exact `NXE1S0505MC` orderable, 5 V input and output,
1 W rating, surface-mount 14-position package, five solder lands at positions
1, 3, 7, 8, and 14 with four functional connections, the pin map (1 = -Vin,
3 = +Vin, 7 = -Vout, 8 = +Vout, and 14 = NA), package dimensions, and
recommended 5-pad footprint details. The asset is a byte-preserved copy of the Murata-issued
`KDC_NXE1.A01` document retrieved through a distributor mirror while the
Murata-hosted URL was returning a maintenance response; the Murata URL remains
the canonical manufacturer source. This record supplies source evidence only:
it does not release a project land pattern, CAD, artwork, orientation, or
fabrication authority.

The Molex `SD-43650-001`, revision D8, lead for the `43650-0300` Micro-Fit
3.0 fixture header remains identified but not hash-acquired. Its source record
identifies three 1.02-mm-plus-or-minus-0.05-mm component-side layout holes on
3.00-mm pitch, a circuit-one datum, 1.57-mm recommended board thickness, and
10.16-mm maximum board-edge placement. It is series-drawing evidence only.

For the remaining exact MPNs, the manufacturer-primary technical URL is
recorded as discovery evidence but the exact drawing bytes and revision remain
unacquired. A series-hash-bound source is not counted as exact-MPN evidence.
The Panasonic CAD-status capture explicitly records the exact product's
manufacturer-source absence; it is not a CAD object. The ADA and Panasonic HTML
captures are identity-only and are not counted as package drawings. The existing
circuit source supplies a schematic reference only, not generated footprint
artwork or an overlay. The executable tests hash-verify every retained source
artifact from the repository root and inspect PDF content, or the retained
HTML capture, for the exact orderable, series, and package-drawing markers.
These are intentional, precise blockers rather than assumed package geometry.

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
