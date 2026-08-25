# BP-032 TI isolator footprint-evidence review

## Scope and outcome

This review-only candidate covers exactly the two populated BP-122 isolator
references. It does not modify the canonical isolation contract, board,
convergence record, ledger, or fabrication state.

| Canonical reference | Exact TI orderable | Package | BP-122 role |
| --- | --- | --- | --- |
| `U_ISO_MAIN` | `ISO7762FDWR` | DW SOIC-16 wide | Main six-channel boundary |
| `U_ISO_AUX` | `ISO7721FDR` | D SOIC-8 narrow | Auxiliary two-channel boundary |

The candidate is an independently frozen data graph. Its public object is a
separately frozen clone of a private baseline. Descriptor-safe comparison uses
separate actual and expected identity sets, requires exact prototype equality,
and compares enumerable, configurable, writable, and value fields. It rejects
accessors, proxies, aliases, cycles, null-prototype substitutions, descriptor
drift, and added fields. Validation also reads the existing BP-122 contract and
confirms the exact MPNs, references, channel directions, signals, and pins
remain aligned.

## Retained TI primary sources

No new manufacturer artifact was needed. The existing retained TI sources are
byte-hash bound by the executable candidate:

| Exact orderable | Retained artifact | TI document | Reviewed pages | SHA-256 |
| --- | --- | --- | --- | --- |
| `ISO7762FDWR` | `docs/evidence/bp-032/ti-iso7762.pdf` | `SLLSER1H` | 1, 4, 38, 42, 44 to 48 | `FC874E117FFEFC489C82677A76580002A55C9DFD0BEC7C800AF8300DBBF8FF22` |
| `ISO7721FDR` | `docs/evidence/bp-032/ti-iso7721.pdf` | `SLLSEP3G` | 1, 5, 34 to 38, 41, 43 | `FB039C00CEB601B93618004839B2108D3358777A019F2526BCA427B7F6C0649C` |

For `ISO7762FDWR`, pages 38, 42, and 44 are exact-orderable evidence; pages
45 to 48 supply package information; page 4 supplies the pin-one view; and
page 47 is a manufacturer land-pattern example. For `ISO7721FDR`, pages 37,
38, 41, and 43 are exact-orderable evidence; pages 34 to 37 supply package
information; page 5 supplies the pin-one view; and page 35 is a manufacturer
land-pattern example.

The authoritative source locations are [ISO7762 datasheet](https://www.ti.com/lit/ds/symlink/iso7762.pdf)
and [ISO7721 datasheet](https://www.ti.com/lit/ds/symlink/iso7721.pdf).

## Canonical pin-direction binding

`U_ISO_MAIN` binds `ISO7762FDWR` to the six BP-122 channels: score clock 2 to
15, MOSI 3 to 14, chip select 4 to 13, reset request 5 to 12, MISO 6 to 11,
and ESP32 heartbeat 7 to 10. The first four run scoring to application and the
last two run application to scoring.

`U_ISO_AUX` binds `ISO7721FDR` to STM32 heartbeat from scoring pin 3 to
application pin 6, plus the application-to-scoring service-only reverse lane
from application pin 7 to scoring pin 2. The latter remains neither a product
GPIO path nor a reset path.

## Geometry and release boundary

TI publishes the exact orderables, package information, pin-one views, and
land-pattern examples. The candidate labels the rendered copper, mask, paste,
and courtyard as project review inputs, not manufacturer CAD or an approved
placement. The DW rendering uses 16 pads at 1.27 millimeter pitch with a
11.90 by 9.99 millimeter project courtyard. The D rendering uses 8 pads at
1.27 millimeter pitch with a 7.40 by 4.91 millimeter project courtyard.

The project coordinate convention is top view with positive Y upward. For
both packages, pin 1 is at the upper-left, so it is the left-row pad at
positive `topYmm`; numbers increase down the left row. The highest-numbered
pin is the right-row pad at that same positive Y, and numbers then decrease
down the right row. The focused test asserts the pin 1, highest-numbered, and
low-side coordinates for each device. This convention is review geometry only
and does not substitute for TI CAD or layout-orientation approval.

For both parts, manufacturer CAD remains `not-acquired` and every gate remains
`deny`: CAD import, placement, physical isolation, release, and fabrication.
The physical-isolation gate still requires the board-specific slot, creepage,
clearance, copper keepout, return-path, decoupling, signal-integrity, EMC, and
powered or unpowered bench evidence. No candidate geometry, unit test, or
datasheet example authorizes a board release.
