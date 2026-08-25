# BP-031 analog and weapon-fixture footprint closure

## Shared manufacturer-source projection

BP-031 imports the already reviewed M4-04 source identities once, rather than
copying source hashes into each of the seven repeated cells. Sixteen lane-B
MPN source IDs are shared: ten are exact-MPN hash-bound drawing records, one
is an exact-primary-identity hash-bound capture, and five are explicitly
series-only Vishay resistor records. All 112 matching cell rows reference
those IDs, including `ERA3AEB2491V` across `R_SOURCE_1` through `R_SOURCE_7`.
The Panasonic source is exact MPN/package evidence; its manufacturer CAD-status
page explicitly records that no Panasonic CAD object is published, and the
recommended land-pattern PDF remains manufacturer guidance rather than project
geometry.

This is source provenance only. A shared source ID does not change a row's
`manufacturerDrawing` state, DNP disposition, or release authority. Every
manufacturer CAD record, generated artwork, orientation review, schematic
integration, independent review, footprint closure, and fabrication gate
remains unresolved and denied.

BP-031 is the lane-B footprint evidence ledger for the one-board bench
prototype. It reconciles BP-103's seven repeated acquisition cells and BP-104's
12-position weapon-fixture header to the BP-030 evidence method. It freezes
exact source-backed identities, but it does not generate or release PCB
geometry.

The retained Panasonic support set is byte-hash bound in M4-04: the exact
[ERA3AEB2491V product page](https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V)
is `packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html`
(`BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048`); the
[AOA0000C309 ERAA datasheet/package drawing](https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf)
is `panasonic-era3aeb2491v-datasheet.pdf`
(`FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79`); the
[DMM0000COL20 recommended-land-pattern PDF](https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf)
is `panasonic-resistor-land-pattern.pdf`
(`65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D`); and
the [exact CAD-status page](https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V/cad)
is `panasonic-era3aeb2491v-cad.html`
(`ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D`). The
last capture records manufacturer CAD as unavailable; none of these artifacts
grants project artwork, orientation, fabrication, or footprint authority.

## Ledger scope

There are 16 physical references per BP-103 channel and seven channels, for 112
cell records, plus one board connector record. The two source-control resistors
introduced by BP-103 are included in every cell:

| Scope | Count | Disposition |
| --- | ---: | --- |
| BP-103 replicated cells | 112 | `DNP-unresolved` |
| BP-104 `J_WEAPON_FIXTURE` board header | 1 | `DNP-unresolved` |
| Footprint closure | 0 | denied |
| Fabrication authority | 0 | denied |

Each cell record carries the exact MPN, package, manufacturer identity source,
channel number, conductor, connector net, and role. The repeated set is:

| Reference family | Exact identity | Package | Source contract |
| --- | --- | --- | --- |
| `U_ESD_n` | `TPD4E05U06DQAR` | DQA USON-10 | BP-102 |
| `R_ESD_n` | `CRCW060322R0FKEAHP` | 0603 | BP-102 |
| `U_SOURCE_SWITCH_n` | `TMUX1112PWR` | PW TSSOP-16 | BP-102 |
| `R_SOURCE_n` | `ERA3AEB2491V` | 0603 | BP-102 |
| `R_SOURCE_PD_n` | `CRCW0603100KFKEAHP` | 0603 | BP-102 |
| `U_OVP_BUFFER_n` | `ADA4177-1ARZ` | R SOIC-8 | BP-102 |
| `R_SAR_n` | `CRCW060320R0FKEAHP` | 0603 | BP-102 |
| `C_SAR_n` | `C0603C102J5GACTU` | 0603 | BP-102 |
| `U_SAR_n` | `ADS8881IDGS` | DGS VSSOP-10 | BP-101 |
| `U_REF_n` | `REF5025AQDRQ1` | D SOIC-8 | BP-101 |
| `C_REF_IN_n` | TDK `CGA3E3X7R1H105K080AB` | 0603 / 1608 | BP-101 |
| `C_REF_REG_n` | `T521B106M025ATE100` | 1411 / 3528 B case | BP-101 |
| `C_REF_REG_HF_n` | `C0603C104K3RACTU` | 0603 | BP-101 |
| `R_REF_SAR_n` | `RCWE0603R220FKEA` | 0603 | BP-101 |
| `C_REF_n` | `GRM21BR71A106KE51L` | 0805 | BP-101 |
| `R_FAULT_GUARD_n` | `CRCW120656K0FKEAHP` | 1206 | BP-102 |

The exact connector is Molex `43045-1200` at `J_WEAPON_FIXTURE`. Its mating
contract remains Molex `43025-1200` with `43030-0007` terminals. BP-104's seven
scored conductors occupy board pins 1 through 7; pins 8 through 10 remain
separate unpopulated return-review positions and pins 11 and 12 are NC. The
connector header, mate, terminal, pin map, polarized latch/lock, and fixture
stop are recorded, but no connector land pattern is released.

## Evidence and denial rule

Every record requires four independent evidence classes before it could ever
be reviewed as a footprint:

1. The exact manufacturer package drawing, revision, and digest.
2. The exact manufacturer CAD object, or a recorded primary-source statement
   that no CAD is published.
3. One generated project artwork object with its generator/version and digest.
4. An independent orientation review covering pin 1 or polarity, assembly
   rotation, package top view, edge/courtyard clearance, and assembly rules.

The current ledger carries source identity/drawing evidence centrally for all
112 replicated cells, including the Panasonic exact-MPN record, but it has no
project CAD approval, generated artwork, or independent orientation review. It
therefore records `DNP-unresolved` for all 113 references,
`eligibleForPcb: false`, and missing copper, courtyard, paste, and solder-mask
release data. Package prose,
datasheet images, generic library names, transcribed dimensions, and the old
fabrication ledger cannot substitute for the four evidence classes.

The executable contract is
[`bench-prototype-analog-footprint-closure.ts`](../src/bench-prototype-analog-footprint-closure.ts).
Its focused tests verify all 112 replicated references, the exact connector
pin disposition, identity drift rejection, evidence denial, alias/accessor
rejection, and the permanent release gates.
