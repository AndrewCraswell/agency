# Scoring circuit

A tscircuit architecture model for a premium, serviceable competition scoring apparatus. The STM32G474 scoring domain
owns electrical acquisition, timing, touch qualification, primary lamps, and the buzzer. A galvanically isolated
ESP32-S3 application domain owns the display, Ethernet, radio, storage, remote control, cloud services, and OTA.

Run `pnpm --filter @repo/scoring-circuit build`, then open `dist/index.html` to inspect the generated PCB placement,
logical schematic, and 3D board model in a tabbed preview. The build also emits Circuit JSON, a BOM in JSON and CSV
formats, and a machine-readable readiness report. The canonical component choices live in `src/component-decisions.ts`.
Critical connector and processor evidence is tracked separately in `src/part-readiness.ts`; the build exports that
manifest as `dist/critical-part-readiness.json` and refuses invalid approval claims.

The current generated `dist` board remains retained multi-assembly architecture evidence. It is not the canonical
one-board bench schematic or PCB described by the active prototype backlog.

Read `docs/esp32-prototype-backlog.md` for the active one-board prototype backlog, dependency graph, and physical-test
acceptance evidence. It keeps the exact STM32, ESP32-S3, isolation, and W5500 Ethernet silicon while deferring the
enclosure and factory-optimized implementation. The read-only LLM review workflows are documented in `judges/README.md`.
The encrypted IR referee remote is an in-scope pre-prototype requirement defined by
`../../apps/scoring/docs/encrypted-ir-remote-control-contract.md`; the active board remains denied until the receiver,
ESP32 interface, optical acceptance targets, and manufacturer-test boundary converge in the prototype backlog. The
bounded three-weapon sensing topology, ngspice model, and socketed fixture plan are documented in
`docs/analog-front-end.md`. The present-rule compatibility strategy and proposed FIE update are in
`docs/fie-modern-power-proposal.md`.

The M4-03 source, switch, reference, acquisition, timing, and error budget is in `docs/m4-03-analog-error-budget.md`. It
records conditional measurement gates and does not release the candidate front end for fabrication.

The one-channel protected experiment's exact candidate BOM, DNP footprint gates, fixture boundary, calibration evidence,
and controlled bring-up contract are in `docs/m4-one-channel-readiness-package.md`. It remains a denied characterization
package, not a production BOM or fabrication release.

The candidate processor allocations and their unresolved electrical conflicts are documented in
`docs/stm32-pin-allocation.md` and `docs/esp32-pin-allocation.md`. Exact connector evidence and remaining physical
verification gates are tracked in `docs/reel-socket-selection.md` and `docs/connector-cad-verification.md`. The
schematic-level ESP32 reset combiner, reset-gated HUB75 buffers, exact pull values, and power-off/SI test gates are in
`docs/reset-and-display-safing.md`. The USB-C UFP role, VBUS-only protection path, ESP32 USB mapping, test points, and
remaining service-port gates are in `docs/usb-c-service-power-architecture.md`. The selected application 3.3 V
regulator, exact support network, supervisor threshold margin, and thermal/startup calculation are in
`docs/application-3v3-rail.md`. The selected V5 buck stage, its explicit eFuse peak conflict, and its thermal/layout
release gates are in `docs/v5-power-stage.md`. The selected Adafruit 2277 EVT panel's end-to-end USB-PD,
application-rail, V5, shunt, and startup/inrush screen is in `docs/selected-panel-power-closure.md`. Production-oriented
mechanical roadmaps are intentionally excluded from the active backlog. Reusable component, footprint, analog, Ethernet,
connector, and power evidence remains available as technical input to the bench-prototype tasks.

## Fabrication status

This is an architectural placement and connectivity model, not a production schematic or routed PCB. It intentionally
marks the weapon analog front end and scoring-domain low-noise regulator as unselected because guessing those parts or
values would make the design look more complete than it is. Do not order boards from these outputs. Analog validation,
complete pin mapping, passives and protection selection, ERC, routing, DRC, SI/PI, thermal, EMC, safety, mechanical,
manufacturing, and independent mixed-signal review gates remain open.

The current critical-part manifest selects the ESP32-S3 module, W5500, Würth integrated-magnetics RJ45, Amphenol
high-cycle USB-C PD power/service receptacle. The Stäubli reel socket family remains a candidate; the manifest records
`66.9684-22` and `66.9684-25` as exact left/right bench samples only. None of these parts is marked
fabrication-approved: manufacturer land-pattern or CAD review, chassis load paths, sample fit, and qualification
evidence are still open gates.
