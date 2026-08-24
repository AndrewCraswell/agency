# BP-104 fixture harness

BP-104 freezes the one-board bench fixture interface for the seven-channel
analog architecture. It is a schematic input and a de-energized fixture-test
plan; it is not a released harness drawing, footprint, or fabrication result.

## Exact candidate interface

The board header is Molex `43045-1200`, a 12-position, two-row Micro-Fit 3.0
right-angle through-hole header. The mate is Molex `43025-1200`, using
`43030-0007` loose-form female crimp terminals. Pin 1 follows the manufacturer
circuit-1 identifier and the two-row component-side drawing.

Molex lists the production interface as `Keying To Mating Part = No`,
`Polarized To Mating Part = Yes`, and `Lock To Mating Part = Yes` for the
43025-1200 to 43045-1200 pair. BP-104 therefore relies on the connector's
polarization and latch/lock, plus an independent fixture stop and visible
pin-1/signal labels to reject reversed, offset, or half-seated mating. Powered
mating and unmating are never allowed.

Molex's dedicated 12-circuit continuity tool is the `44242-0005` Micro-Fit 3.0
dual-row test plug (material number `442420005`). It is used only for probing
continuity and miswire faults. It is not a production harness and the
`43045-1200` board header is not used as a test plug. The 44242 test plug is
not polarized to its mating part, so it is confined to de-energized probing
and must never establish the production harness orientation.

Only the first seven cavities are populated, in the BP-103 order:

| Pin | Signal | Disposition |
| ---: | --- | --- |
| 1 | `LEFT_WEAPON_A` | scored conductor |
| 2 | `LEFT_WEAPON_B` | scored conductor |
| 3 | `LEFT_WEAPON_C` | scored conductor |
| 4 | `RIGHT_WEAPON_A` | scored conductor |
| 5 | `RIGHT_WEAPON_B` | scored conductor |
| 6 | `RIGHT_WEAPON_C` | scored conductor |
| 7 | `PISTE` | scored conductor |
| 8 | `PISTE_RETURN` | unpopulated; separate return review required |
| 9 | `FIXTURE_RETURN_REVIEW_REQUIRED` | unpopulated; separate return review required |
| 10 | `ESD_RETURN_REVIEW_REQUIRED` | unpopulated; separate return review required |
| 11 | `NC` | unpopulated |
| 12 | `NC` | unpopulated |

`SCORING_SGND` is an internal scoring return and is not assigned to this
connector. No return candidate is bonded to another return or to a scored
conductor. Pins 8-10 remain open until a later reviewed schematic assigns each
return explicitly.

## Harness acceptance

Labels must name the signal, not only its wire color. The board label must
include `J_WEAPON_FIXTURE` and a visible pin-1 marker. Because the connector is
polarized to its mating part and has a latch/lock, but the fixture still has an
independent mechanical stop or equivalent orientation control and a
clamp/strain relief that carries pull and bend loads away from the crimp and
PCB solder joints.

With every power source removed and the board discharged, use `44242-0005` to
record seven end-to-end readings, all 66 unique pin-pair isolation readings,
and open-circuit readings for pins 8-12. BP-104's project bench screen is at
most 2 Ohm end-to-end, at least 10 MOhm isolation at 5 V, and at most 0.2 Ohm
residual after zeroing the same leads at the fixture. These are bounded
prototype acceptance screens, not Molex connector ratings.

The typed evaluator also requires the instrument manufacturer/model/serial,
calibration certificate and due date, evidence ID, UTC timestamp, operator,
board/harness IDs, test-plug identity, test voltage, lead-compensation method,
and four recorded rejected negative tests: adjacent swap, open conductor,
unreviewed return bond, and reversed mate. `recordedAtUtc` must be a real UTC
ISO timestamp, and the calibration due date must be a real `YYYY-MM-DD` date
on or after the measurement date; malformed, impossible, or expired records
are rejected. Until
`evaluateBenchPrototypeContinuityEvidence` accepts that record, continuity
acceptance remains unresolved.

`evaluateBenchPrototypeFixturePhysicalEvidence` is a separate, fail-closed
evidence intake. It accepts only a complete immutable record containing exact
drawing and CAD review artifacts for `43045-1200`, `43025-1200`, `43030-0007`,
and `44242-0005`; receipt evidence for those same parts; a de-energized
sample-fit/orientation/label result; rejected swap, open, return-bond, and
reversed-mate results; all seven crimp/retention records; strain-relief
evidence; and an accepted continuity record. Artifact digests and identifiers
are mandatory. Drawing, CAD, and review artifacts each require their own ID
and SHA-256; every conductor likewise requires separate crimp and retention
IDs and SHA-256 values. Before reading any field, the evaluator rejects
accessors, symbols, hidden properties, non-plain records, sparse or subclassed
arrays, aliases, cycles, and unknown or missing keys. The evaluator does not
create physical evidence, authorize fabrication, or change any canonical
BP-104 gate. Synthetic records in unit tests verify the schema only.

Separately perform one non-forced `43025-1200` to `43045-1200` sample-fit check:
align circuit 1, verify latch/lock seating and the independent fixture stop,
then remove it while de-energized. Do not use this sample-fit mate for the
continuity or miswire measurement.

No powered mating or unmating is permitted. Sample fit, terminal retention,
crimp process, continuity, miswire rejection, strain relief, manufacturer
drawing import, and fabrication remain open gates. The executable contract is
`src/bench-prototype-fixture-harness.ts` and its focused tests.

## Drawing evidence state

The detailed retrieval record is [BP-104 Molex drawing discovery](evidence/bp-104/molex-drawing-discovery.md).

Molex's official drawing endpoints were checked and the material-number tables
identify the selected parts within their series scope: `43045-1200` is the
12-circuit, finish-A row of `SD-43045-001`; `43025-1200` is the 12-position row
of `430250000-SD`; `43030-0007` is the 20-24 AWG, form-A loose-terminal row of
`SD-43030-XXXX`; and `44242-0005` is the 12-circuit row of `SD-44242-001`.
These are series drawings, not exact-MPN drawings or CAD-review artifacts.
The remote web sources were readable for table verification, but the current
execution environment could not retain their PDF bytes, so no local asset or
SHA-256 is recorded. All four therefore remain
`identified-not-hash-acquired`. This is not footprint approval.

Sources:

- [Molex 43045-1200](https://www.molex.com/en-us/products/part-detail/43045-1200)
- [Molex 43025-1200](https://www.molex.com/en-us/products/part-detail/0430251200)
- [Molex 43045 series chart](https://www.molex.com/en-us/products/series-chart/43045)
- [Molex 43025 series chart](https://www.molex.com/en-us/products/series-chart/43025)
- [Molex 43030-0007](https://www.molex.com/en-us/products/part-detail/430300007)
- [Molex 44242 series chart, including 12-circuit 44242-0005](https://www.molex.com/en-us/products/series-chart/44242)
- [Molex SD-44242-001 test-plug drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/442/44242/442420001_sd.pdf)
- [Molex SD-43045-001 series drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450600_sd.pdf)
- [Molex SD-430250000 series drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430250400_sd.pdf)
- [Molex SD-43030-XXXX terminal series drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf)
- [Molex Micro-Fit product specification](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/productspecificationpdf/203/203951/2039510000-PS-000.pdf)
