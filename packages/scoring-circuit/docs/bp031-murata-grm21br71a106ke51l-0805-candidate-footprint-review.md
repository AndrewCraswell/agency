# BP-031 Murata GRM21BR71A106KE51L 0805 candidate footprint

This is a bounded, review-only candidate footprint for the exact Murata
orderable `GRM21BR71A106KE51L`, a GRM21 / 2012M / EIA 0805 ceramic capacitor.
It covers the seven replicated reference reservoirs `C_REF_1` through
`C_REF_7` used by the seven-channel analog prototype. This artifact does not
integrate a board, alter the analog topology, release a PCB, or authorize
fabrication.

The executable record is
[`bp031-murata-grm21br71a106ke51l-0805-candidate-footprint.tsx`](../src/bp031-murata-grm21br71a106ke51l-0805-candidate-footprint.tsx),
and its focused contract is
[`bp031-murata-grm21br71a106ke51l-0805-candidate-footprint.test.tsx`](../src/bp031-murata-grm21br71a106ke51l-0805-candidate-footprint.test.tsx).

## Exact MPN, package, source, and reference binding

The source binding is the existing seven-channel analog selection: canonical
reference `C_REF`, replicated with the `C_REF_` prefix, exact MPN
`GRM21BR71A106KE51L`, and package `0805 (2012M)`. The candidate is prepared
against integration commit `a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c`.

| Binding | Exact value |
| --- | --- |
| Canonical source | `packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts` |
| Canonical source SHA-256 at `a84fb13` | `AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB` |
| MPN | `GRM21BR71A106KE51L` |
| Package | `GRM21 (2012M / 0805)` |
| Canonical reference | `C_REF` |
| Replicated references | `C_REF_1` through `C_REF_7` |

No board, ledger, canonical source, plan, or backlog file is changed by this
candidate.

## Retained Murata evidence

| Source | Scope used | Retained artifact | SHA-256 |
| --- | --- | --- | --- |
| [Murata GRM21BR71A106KE51 reference sheet](https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf) | Exact `GRM21BR71A106KE51L` identity, 0805 / 2012M package dimensions, electrical rating, and GRM21 reflow land guidance | `packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf` | `E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F` |

The reference sheet identifies `GRM21BR71A106KE51_` as a 10 uF, ±10%, X7R,
10 V family entry. The final `L` packaging code in the exact MPN binds the
orderable `GRM21BR71A106KE51L`. Page 1 records -55 to 125 °C operation and
the 2.00 ±0.15 mm length, 1.25 ±0.15 mm width, 1.25 ±0.15 mm thickness,
0.20 to 0.70 mm termination dimension, and at least 0.70 mm internal gap.

The retained artifact is the official Murata primary PDF already present under
the M4-04 evidence directory. No duplicate evidence file is added for this
slice.

## Manufacturer land guidance

Page 25, Table 2, gives the exact GRM21 `2.0 x 1.25 mm (±0.15)` reflow row:

| Murata parameter | Published guidance |
| --- | --- |
| `a` inner gap | 1.2 mm |
| `b` pad length | 0.6 to 0.8 mm |
| `c` pad width | 1.2 to 1.4 mm |

Murata says that the suitable land dimension must be confirmed on the actual
set and PCB. These values are manufacturer guidance only. They are not a
manufacturer CAD object, a released footprint, or fabrication approval.

The project review selection takes the midpoint within the published ranges:
`a=1.2`, `b=0.7`, and `c=1.3` mm. The resulting rectangular copper pads are
centered at x = -0.95 mm and +0.95 mm, with x-axis pad length 0.70 mm, y-axis
pad width 1.30 mm, and a 2.60 mm total copper span.

## Project-only mask, paste, and courtyard

Murata's retained land guidance does not publish a finished NSMD expansion or
a finished stencil aperture for this exact candidate. The project review
selection therefore uses a 0.05 mm mask margin per edge, producing 0.80 x
1.40 mm mask openings, and a 0.05 mm paste reduction per edge, producing
0.60 x 1.20 mm paste openings. Both are explicitly project inputs, not
Murata guidance.

Murata does not publish a courtyard. The project review courtyard is 3.10 x
1.90 mm with 0.25 mm minimum clearance. The x dimension is the larger of the
2.30 mm maximum package length and 2.60 mm selected copper span, plus 0.25 mm
on each side. The y dimension is the larger of the 1.40 mm maximum package
width and 1.30 mm selected pad width, plus 0.25 mm on each side.
`sourceStatus` remains `not-published` and `status` remains
`project-review-input`.

The canonical rendered soup geometry is hash-bound as:

`0C97468EE0E3B398EAC314577D0C1D10AFBE7AC0A064B4DC1862935190C7C15D`

This digest covers the two rectangular copper pads, their project mask
margin, their project paste apertures, and the review courtyard emitted by
tscircuit `0.0.2271`. It does not turn project geometry into Murata CAD.

## Non-polar orientation and release disposition

The ceramic capacitor is non-polar. Both terminals are represented as
non-polar A and B terminals, with no pin-one, cathode, or anode claim.
`assemblyRotationDeg` remains null because rotation is electrically
equivalent; placement axis, board stress, clearance, and effective
capacitance under DC bias remain independent review items.

No Murata CAD artifact is retained. CAD state is `not-acquired`, authority is
`deny`, retained CAD path and hash are null, and disposition is
`not-acquired-no-substitute`. The candidate artwork is project review only;
release state and fabrication authority are both `deny`, and `accepted`
remains `false`.

The validator fails closed on exact identity, current integration source
binding, seven-reference replication, retained source identity and hash,
package and electrical data, manufacturer land guidance, project geometry,
rendered geometry digest, non-polar orientation, CAD uncertainty, and release
state. Root review, board integration, independent placement and process
review, DC-bias characterization, and fabrication evidence remain open.
