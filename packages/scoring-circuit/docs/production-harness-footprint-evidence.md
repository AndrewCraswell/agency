# Production scoring harness footprint evidence

**Disposition:** all four selected scoring-board harness headers remain
fabrication **DENY** and DNP. The isolated executable review record is
[`production-harness-footprint-evidence.ts`](../src/production-harness-footprint-evidence.ts).
It deliberately does not modify a board circuit, readiness register,
manufacturer-footprint adapter, or fabrication-release ledger and cannot emit
PCB artwork.

## Primary-source record

| Board reference | Exact header | Manufacturer drawing | Source-backed layout facts |
| --- | --- | --- | --- |
| `J_PISTE_HARNESS` | Molex Micro-Fit 3.0 `43650-0200` | `SD-43650-001`, revision D8 | two 1.02 mm plus or minus 0.05 mm component-side layout holes on a 3.00 mm pitch; 1.57 mm recommended board thickness; circuit 1 marking; 10.16 mm maximum board-edge placement |
| `J_WEAPON_HARNESS_L` | Molex Micro-Fit 3.0 `43650-0300` | `SD-43650-001`, revision D8 | three contact layout holes, with the same Micro-Fit geometry and edge limit |
| `J_WEAPON_HARNESS_R` | Molex Micro-Fit 3.0 `43650-0400` | `SD-43650-001`, revision D8 | four contact layout holes, with the same Micro-Fit geometry and edge limit |
| `J_PRIMARY_OUTPUTS_HARNESS` | Molex Mini-Fit Jr. `39-29-1067` | `SD-5569-002`, revision N1 | six 1.80 mm plus or minus 0.05 mm component-side contact layout holes in a two by three 4.20 mm grid; two unlocated 3.20 mm plus or minus 0.10 mm retention-or-mounting holes; drawing dimensions A 23.80 mm, B 8.40 mm, and C 13.80 mm; circuit 1 marking; 1.78 mm product-page board-thickness recommendation |

The model labels these as **manufacturer component-side layout holes**, not
finished holes or released plated copper. The adapter and board circuit remain
the authority that no artwork exists. `A`, `B`, and `C` drawing dimensions are
preserved under those exact drawing identifiers; they are not reinterpreted as
a released body or courtyard outline.

Primary sources:

- [Molex SD-43650-001 right-angle Micro-Fit drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43650/436500400_sd.pdf)
- [Molex Micro-Fit 43650 series](https://www.molex.com/en-us/products/series-chart/43650)
- [Molex SD-5569-002 Mini-Fit Jr. drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/556/5569/039291107_sd.pdf)
- [Molex 39-29-1067 product page](https://www.molex.com/en-us/products/part-detail/39291067)

## What the record does not claim

None of the four primary sources imported into this review record establishes
an exact production copper annular-ring pattern, fabricator finished-hole and
plating rules, solder-mask expansion, assembly courtyard, or a released
pin-in-paste aperture or selected assembly process. The source drawings are
not imported CAD, and their 3D models have not been overlaid with the selected
mates, enclosure, board edge, cable exit, clamp, and service volume.

The Mini-Fit source's two 3.20 mm features are deliberately typed as
`retention-or-mounting`: no source interpretation in this repository assigns
their coordinate relationship, final NPTH/PTH, copper, or mechanical function.
They must be settled in the imported exact CAD object rather than guessed from
a generic library.

## Release handoff

Keep `doNotPlace` and zero PCB artifact output until a layout owner completes
all of the following in a controlled release object:

1. Acquire the exact configured CAD and source revision for all four MPNs,
   then overlay every contact and retention or mounting feature with the
   manufacturer drawing, manufacturer 3D data, selected mates, board edges,
   enclosure, cable exit, clamp, and service access.
2. Define the fabricator-specific finished-hole, plating, annular ring, copper
   land, solder-mask, silkscreen, and courtyard rules. Obtain independent
   layout review of pin one and all cable-exit orientations.
3. Lock an assembly traveler. It must select and qualify wave or another
   through-hole process, including thermal profile, flux and wash policy,
   inspection, rework, connector and housing insertion, and lot traceability.
4. Qualify the exact mating housings and terminals from the production harness
   selection, controlled crimps, chassis clamp, pull, vibration, ESD and
   fault behavior, contact temperature, access, and de-energized service.
5. Attach fabrication preview and physical-mate evidence to the release
   change, then independently review it before any DNP or no-artwork gate is
   removed.

The tests prove only that the isolated record stays source-linked, maps to the
four selected headers and their single fabrication gates, retains the known
geometry, and fails closed. They do not constitute a CAD overlay, fabrication
review, harness qualification, or PCB release.
