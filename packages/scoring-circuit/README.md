# Scoring circuit

A tscircuit architecture model for a premium, serviceable competition scoring apparatus. The STM32G474 scoring domain
owns electrical acquisition, timing, touch qualification, primary lamps, and the buzzer. A galvanically isolated
ESP32-S3 application domain owns the display, Ethernet, radio, storage, remote control, cloud services, and OTA.

Run `pnpm --filter @repo/scoring-circuit build`, then open `dist/index.html` to inspect the generated PCB placement,
logical schematic, and 3D board model in a tabbed preview. The build also emits Circuit JSON, a BOM in JSON and CSV
formats, and a machine-readable readiness report. The canonical component choices live in `src/component-decisions.ts`.
Critical connector and processor evidence is tracked separately in `src/part-readiness.ts`; the build exports that
manifest as `dist/critical-part-readiness.json` and refuses invalid approval claims.

Read `docs/production-board-plan.md` for the requirements matrix, event replay design, component rationale, reliability
program, compliance work, and release gates. The read-only LLM review workflows are documented in `judges/README.md`.
The bounded three-weapon sensing topology, ngspice model, and socketed fixture plan are documented in
`docs/analog-front-end.md`. The present-rule compatibility strategy and proposed FIE update are in
`docs/fie-modern-power-proposal.md`.

The M4-03 source, switch, reference, acquisition, timing, and error budget is in `docs/m4-03-analog-error-budget.md`. It
records conditional measurement gates and does not release the candidate front end for fabrication.

The candidate processor allocations and their unresolved electrical conflicts are documented in
`docs/stm32-pin-allocation.md` and `docs/esp32-pin-allocation.md`. Exact connector evidence and remaining physical
verification gates are tracked in `docs/reel-socket-selection.md` and `docs/connector-cad-verification.md`.

## Fabrication status

This is an architectural placement and connectivity model, not a production schematic or routed PCB. It intentionally
marks the weapon analog front end and scoring-domain low-noise regulator as unselected because guessing those parts or
values would make the design look more complete than it is. Do not order boards from these outputs. Analog validation,
complete pin mapping, passives and protection selection, ERC, routing, DRC, SI/PI, thermal, EMC, safety, mechanical,
manufacturing, and independent mixed-signal review gates remain open.

The current critical-part manifest selects the ESP32-S3 module, W5500, Würth integrated-magnetics RJ45, Amphenol
high-cycle USB-C receptacle, and Neutrik locking power connector. The Stäubli reel socket family remains a candidate;
the manifest records `66.9684-22` and `66.9684-25` as exact left/right bench samples only. None of these parts is marked
fabrication-approved: manufacturer land-pattern or CAD review, chassis load paths, sample fit, and qualification
evidence are still open gates.
