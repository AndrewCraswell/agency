# BP-031 analog and weapon-fixture footprint closure

BP-031 is the lane-B footprint evidence ledger for the one-board bench
prototype. It reconciles BP-103's seven repeated acquisition cells and BP-104's
12-position weapon-fixture header to the BP-030 evidence method. It freezes
exact source-backed identities, but it does not generate or release PCB
geometry.

## Ledger scope

There are 14 physical references per BP-103 channel and seven channels, for 98
cell records, plus one board connector record:

| Scope | Count | Disposition |
| --- | ---: | --- |
| BP-103 replicated cells | 98 | `DNP-unresolved` |
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
| `U_OVP_BUFFER_n` | `ADA4177-1BRZ` | R SOIC-8 | BP-102 |
| `R_SAR_n` | `CRCW060320R0FKEAHP` | 0603 | BP-102 |
| `C_SAR_n` | `C0603C102J5GACTU` | 0603 | BP-102 |
| `U_SAR_n` | `ADS8881IDGS` | DGS VSSOP-10 | BP-101 |
| `U_REF_n` | `REF5025AQDRQ1` | D SOIC-8 | BP-101 |
| `C_REF_IN_n` | `GRM188R71A105KA12D` | 0603 | BP-101 |
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

The current ledger has none of these artifacts. It therefore records
`DNP-unresolved` for all 99 references, `eligibleForPcb: false`, and missing
copper, courtyard, paste, and solder-mask release data. Package prose,
datasheet images, generic library names, transcribed dimensions, and the old
fabrication ledger cannot substitute for the four evidence classes.

The executable contract is
[`bench-prototype-analog-footprint-closure.ts`](../src/bench-prototype-analog-footprint-closure.ts).
Its focused tests verify all 98 replicated references, the exact connector
pin disposition, identity drift rejection, evidence denial, alias/accessor
rejection, and the permanent release gates.

