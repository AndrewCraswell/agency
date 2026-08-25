# BP-033 Yageo RC0603FR-0710KL bridge candidate

This review-only BP-033 slice binds the exact orderable Yageo `RC0603FR-0710KL`,
10 kOhm, 1%, 0603 (1608 metric) resistor to the 26 canonical application
references. It does not edit or duplicate the canonical application ledger.

The references are cross-checked at module load and by the focused test against
`packages/scoring-circuit/src/bench-prototype-application-footprints.ts`:

- `R_APP_REG_PGOOD` from BP-142.
- `R_W5500_RESET_PULLUP` from BP-123/BP-140.
- The 21 BP-144 Hub75 references: `R_HUB75_R1_PD`, `R_HUB75_G1_PD`,
  `R_HUB75_B1_PD`, `R_HUB75_R2_PD`, `R_HUB75_G2_PD`, `R_HUB75_B2_PD`,
  `R_HUB75_A_PD`, `R_HUB75_B_PD`, `R_HUB75_C_PD`, `R_HUB75_D_PD`,
  `R_HUB75_CLK_PD`, `R_HUB75_LAT_PD`, `R_HUB75_OE_PULLUP`,
  `R_HUB75_UNUSED_B_A6_PD`, `R_HUB75_UNUSED_B_A7_PD`,
  `R_HUB75_UNUSED_B_A8_PD`, `R_HUB75_PANEL_OE_PULLUP`,
  `R_BUFFER_A_ENABLE_PULLUP`, `R_BUFFER_A_GATE`, `R_BUFFER_B_ENABLE_PULLUP`,
  and `R_BUFFER_B_GATE`.
- `R_IR_PULLUP` from BP-146.
- `R_FRAM_WP_PULLUP` and `R_FRAM_HOLD_PULLUP` from BP-145.

## Retained evidence and reuse provenance

The exact retained source is the existing BP-125 Yageo datasheet at
`packages/scoring-circuit/docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf`.
Its retained-byte SHA-256 is
`EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497`.
This BP-033 slice records the existing BP-032 source entry and adds no PDF.

The review-only project geometry and rendered artwork are reused explicitly from
`bp032-yageo-rc0603-resistor-footprint-evidence`. The retained rendered-artwork
digest is
`C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8`, generated
with tscircuit `0.0.2271`. Reuse is provenance only; the footprint is not
source-accurate manufacturer land-pattern evidence.

The candidate export is deeply frozen. Its validator first cross-checks the
BP-032 Yageo source candidate, then compares against a private independently
cloned and frozen expected graph rather than against the value being validated.
The descriptor-safe exact-data-graph comparison rejects hidden and symbol
properties, accessors, prototype changes, cycles, alias changes, ordinary field
changes, and deny-state changes without invoking getters. The focused test
independently hashes the retained PDF and rendered geometry, checks the frozen
export, and mutates the package, acceptance, and reused geometry fields to
prove fail-closed behavior.

## Deny state

Manufacturer land pattern, manufacturer CAD, board placement, fit and clearance,
mechanical load, assembly process, release, fabrication, and acceptance remain
denied. `manufacturerCad.artifactPath` is explicitly `null`; no placement or
fabrication conclusion is implied by the reused review geometry.
