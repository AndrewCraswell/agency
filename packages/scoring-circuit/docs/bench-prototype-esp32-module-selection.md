# BP-120 ESP32-S3 module selection

BP-120 records one clean-sheet selection only. The replacement for
`ESP32-S3-WROOM-1U-N16R2` is the integrated-antenna
`ESP32-S3-WROOM-1-N16R2`. It preserves the requirement for 16 MB Quad-SPI
flash and 2 MB Quad-SPI PSRAM. This artifact changes no BOM, schematic,
pin map, footprint, board, enclosure, backlog, or release record.

## Decision

| Field | Recorded value |
| --- | --- |
| Application reference | `U_APP` |
| Previous exact MPN | `ESP32-S3-WROOM-1U-N16R2` |
| Selected exact MPN | `ESP32-S3-WROOM-1-N16R2` |
| Antenna | WROOM-1 integrated PCB antenna |
| Flash | 16 MB Quad SPI |
| PSRAM | 2 MB Quad SPI |
| Ambient range | -40 to 85 C |
| Supply range | 3.0 to 3.6 V |
| Lifecycle evidence | Current Espressif catalog listing with exact-MPN purchase links and a bulk-order path |

The live manufacturer catalog was reviewed on 2026-08-25. That confirms a
current catalog listing, not distributor inventory, allocation, lead time, or
long-term supply. An authorized-distributor quote is still required before a
release decision.

## Primary-source binding

All selection facts use Espressif primary sources:

| Source | Use |
| --- | --- |
| [ESP32-S3-WROOM-1 and WROOM-1U datasheet v1.8](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf) | Exact N16R2 row, memory, supply, pad identity, dimensions, and land pattern |
| [Espressif ESP32-S3 module catalog](https://www.espressif.com/en/products/modules/esp32-s3/esp32-s3-wroom-1) | Current exact-MPN listing, purchase links, and bulk-order path |
| [WROOM-1 official footprint DXF](https://www.espressif.com/sites/default/files/modules-dxf/ESP32-S3-WROOM-1%20PCB%20Footprint.dxf) | Authoritative WROOM-1 footprint import and overlay input |
| [WROOM-1 official STEP model](https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1%203D%20Model.STEP) | Authoritative mechanical and enclosure-review input |
| [ESP32-S3 hardware design guidelines](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html) | Antenna placement, clearance, enclosure, and RF verification |

The selected package is the 18.0 mm by 25.5 mm by 3.1 mm WROOM-1 module with
40 perimeter terminals, exposed ground pad 41, and 1.27 mm perimeter pitch.
The official DXF and STEP are the only CAD identity for a future replacement.
Matching pad count is not evidence of land-pattern compatibility: an
independent DXF overlay and mechanical STEP review remain required.

## RF placement requirement

The WROOM-1 contains the PCB antenna. Espressif’s preferred placement is to
extend that antenna outside the base-board edge, with the antenna feed point
close to the edge. If that cannot be done, retain at least 15 mm clearance in
all directions around the antenna area: no copper, routing, or components.
Cut away the base board below the antenna area to minimize its effect. Keep
metal housing away from the antenna and verify the finished product for both
throughput and communication range.

This requirement replaces the former external-antenna model; it is not a
generic courtyard and does not approve a board placement.

## Mandatory migration list

| Obsolete 1U or external-antenna assumption | Required migration |
| --- | --- |
| `U_APP` is `ESP32-S3-WROOM-1U-N16R2` | Bind the next controlled update to `ESP32-S3-WROOM-1-N16R2`, retaining N16R2 memory. |
| Antenna is an integrated external connector | Model the selected WROOM-1 on-module PCB antenna. |
| External antenna, U.FL/MHF I/AMC mate, coax cable, retention, cable exit, and cable routing are required | Remove those module-level RF-chain requirements and review antenna-to-enclosure clearance instead. |
| 1U body is 18.0 by 19.2 by 3.2 mm | Use WROOM-1 body 18.0 by 25.5 by 3.1 mm and the official WROOM-1 STEP model. |
| 1U DXF, STEP, land pattern, EPAD-via location, and courtyard review apply | Replace them with WROOM-1 DXF and STEP and independently overlay the complete land pattern. |
| PCB antenna keepout is not applicable | Apply the integrated-antenna edge placement or the 15 mm all-direction clearance with no copper, routing, or components. |
| Cable and installed external antenna RF test close the RF path | Verify finished board and enclosure throughput and communication range with the integrated PCB antenna. |
| Same pad count makes it a drop-in schematic, pin map, power, reset, boot, or assembly replacement | Re-review the WROOM-1 pin table, supply and decoupling, EN/reset, boot straps, assembly stencil, and placement. |

## Boundary

The executable record is
[`src/bench-prototype-esp32-module-selection.ts`](../src/bench-prototype-esp32-module-selection.ts)
and its focused test is
[`src/bench-prototype-esp32-module-selection.test.ts`](../src/bench-prototype-esp32-module-selection.test.ts).
It records `selectionRecorded: true` but explicitly denies schematic, BOM,
pin-map, footprint, layout, and fabrication authority. Root-owned
reconciliation must make each controlled update separately.
