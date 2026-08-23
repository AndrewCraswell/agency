# Production scoring harness selection

**Status:** source-only connector and cable selection. It does not place a connector, enable a footprint, authorize a
harness build, or approve PCB fabrication.

This document turns the separate scoring I/O board's four external harness placeholders into a controlled selection
record. The executable record is
[`production-harness-selection.ts`](../src/production-harness-selection.ts), with regression coverage in
[`production-harness-selection.test.ts`](../src/production-harness-selection.test.ts). It deliberately leaves the
current board circuit and readiness records unchanged until the configured mechanical data is reviewed.

## Selected interfaces

| Board reference | Function | PCB header | Mating housing and terminal | Cable | Pin assignment |
| --- | --- | --- | --- | --- | --- |
| `J_WEAPON_HARNESS_L` | Left body cord | Molex Micro-Fit 3.0 `43650-0300` | `43645-0300`, three `43030-0007` female crimp terminals | Alpha Wire Xtra-Guard 4 `45003`, 3C 22 AWG | 1 A black, 2 B brown, 3 C red |
| `J_WEAPON_HARNESS_R` | Right body cord | Molex Micro-Fit 3.0 `43650-0400` | `43645-0400`, three `43030-0007` female crimp terminals | Alpha Wire Xtra-Guard 4 `45004`, 4C 22 AWG | 1 A black, 2 B brown, 3 C red, 4 empty; orange core trimmed and floating |
| `J_PISTE_HARNESS` | Piste | Molex Micro-Fit 3.0 `43650-0200` | `43645-0200`, two `43030-0007` female crimp terminals | Alpha Wire Xtra-Guard 4 `45002`, 2C 22 AWG | 1 piste black, 2 piste return brown |
| `J_PRIMARY_OUTPUTS_HARNESS` | Primary lamps and buzzer | Molex Mini-Fit Jr. `39-29-1067` | `39-01-2060`, six `39-00-0039` female crimp terminals | Alpha Wire Xtra-Guard 4 `45066`, 6C 18 AWG | 1 red lamp on black, 2 green lamp on red, 3 left white on white, 4 right white on green, 5 buzzer on orange, 6 return on blue |

Micro-Fit 3.0 is selected for the low-current scoring interfaces because the listed female terminal supports 20 to 24
AWG and 7 A maximum per contact. Its selected headers are polarized, latching, shrouded, right-angle through-hole
parts with a 105 C operating rating. The PCB headers are male, right-angle, shrouded parts; the cable housings are
female receptacles with integral positive latches. Their published maximum durability is 30 mating cycles. Mini-Fit Jr.
is selected for the primary output bundle because the selected terminal accepts the selected 18 AWG cable and the
header and terminal are 9 A per-contact candidates with a 105 C operating rating. The selected Alpha Wire control
cables are 125 C, 300 V constructions. These are component ratings, not verified system load limits, contact derating,
retention proof, crimp approval, or thermal approval.

## Keying and service policy

- Left weapon uses three circuits, right weapon uses four, and piste uses two. The connector size difference is the
  mechanical noninterchange feature. The right fourth cavity has no terminal and no conductor entering it; the empty
  cavity is not the key. The fourth orange core of the selected 4C cable is trimmed, individually insulated, and floating
  at both ends. Build inspection must prove both conditions. Enclosure and harness labels repeat LEFT WEAPON, RIGHT
  WEAPON, PISTE, and PRIMARY OUTPUTS.

- The primary output interface is a six-circuit, dual-row Mini-Fit Jr. product. Its 4.2 mm geometry and latch are
  distinct from the 3.0 mm Micro-Fit scoring interfaces.

- Each cable needs a chassis-mounted clamp within 25 mm of the board connector. Plug insertion, cable pull, vibration,
  and service forces must go through the enclosure tie-down. Neither a latch, a mounting flange, nor through-hole solder
  joints are the chassis-load path.

- The weapon harnesses have no cable shield and no chassis bond. The A, B, and C conductors enter the connector-side
  ESD clamp and analog-fault path. The piste's existing temporary pin label `SHIELD` is assigned to its second insulated
  conductor as `PISTE_RETURN` into `ESD_RETURN`; it is not a shield termination. The primary bundle has an explicit
  driver return and no shield. No interface claims a cable shield, chassis bond, or completed EMC behavior.

- The primary output driver, lamp and buzzer loads, operating voltage, fault behavior, common-return current, cable
  length, and thermal rise remain unresolved. A 9 A component rating does not approve a 9 A system channel.

## Evidence and release gates

Primary manufacturer evidence:

- [Molex Micro-Fit 3.0 headers](https://www.molex.com/en-us/products/series-chart/43650),
  [receptacle housings](https://www.molex.com/en-us/products/series-chart/43645), and
  [43030-0007 terminals](https://www.molex.com/en-us/products/part-detail/430300007).
- [Molex Micro-Fit right-angle header drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43650/436500200_sd.pdf)
  and [receptacle drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43645/436450600_sd.pdf).
- [Molex Mini-Fit Jr. primary-output header](https://www.molex.com/en-us/products/part-detail/39291067),
  [housing](https://www.molex.com/en-us/products/part-detail/39012060), and
  [terminal](https://www.molex.com/en-us/products/part-detail/39000039).
- Alpha Wire [45003](https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45003),
  [45004](https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45004),
  [45002](https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45002), and
  [45066 specification](https://www.alphawire.com/disteAPI/SpecPDF/DownloadProductSpecPdf?productPartNumber=45066).

Manufacturer catalogue pages displayed these exact MPNs on 2026-08-23. They are the only availability evidence used
here and are procurement leads, not allocation proof. Procurement must re-check authorized-source stock, lifecycle,
lead time, counterfeit controls, and lot traceability when the BOM is released.

Fabrication remains **DENY** until all of these are complete:

1. Configured two-, three-, and four-circuit Micro-Fit drawings and the configured six-circuit Mini-Fit drawing plus
   manufacturer CAD establish the exact header orientation, pin one, land pattern, solder mask, paste, courtyard,
   connector edge clearance, and cable exit volume. The family drawings cited above do not close this acquisition gate.
2. The released scoring I/O circuit replaces the current DNP placeholders only after review against this controlled pinout.
3. A controlled harness drawing specifies stripped length, exact production crimp tool and die, crimp-height and
   pull-force acceptance, terminal insertion, right-cavity empty inspection, floating orange-core insulation, color map,
   labels, cable length, clamp hardware, bend radius, and service clearance.
4. Mechanical tests prove retention, pull, vibration, plug access, de-energized service, and that all cable load enters the
   chassis rather than the PCB.
5. Electrical and EMC tests prove analog ESD and fault behavior, piste return behavior, primary driver fault behavior,
   cable coupling, emissions, contact temperatures, and final lamp and buzzer currents at the declared ambient.
