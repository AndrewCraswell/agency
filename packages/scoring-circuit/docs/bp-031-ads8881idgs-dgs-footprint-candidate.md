# BP-031 ADS8881IDGS DGS VSSOP-10 footprint candidate

This isolated review artifact covers the exact Texas Instruments
`ADS8881IDGS` orderable in the `DGS` `VSSOP-10` package. It is a candidate
footprint only. It is not instantiated on a board and does not approve
schematic integration, placement, procurement, fabrication, or release.

## Exact identity and source binding

The candidate binds the BP-101 `U_SAR` source identity to:

| Field | Value |
| --- | --- |
| Manufacturer | Texas Instruments |
| Exact MPN | `ADS8881IDGS` |
| Package | `DGS VSSOP-10` |
| Package drawing | `DGS0010A`, `4221984/A 05/2015` |
| Source contract | BP-101 |
| Canonical source | `packages/scoring-circuit/src/bench-prototype-analog-topology.ts`, reference `U_SAR` |

The source-control snapshot is tied to `refs/heads/main` at worktree creation:

| Upstream source | SHA-256 |
| --- | --- |
| `packages/scoring-circuit/src/bench-prototype-analog-topology.ts` | `1F888DD5AA328FAD823738F09A48502EF50189775D5E1920A09413A32C14360D` |
| `packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts` | `B2161E55788503DCD10BB96FDEBB502A1CE6C5D80159B8B5D9E5CC32C970E438` |

The candidate validator checks these exact hashes and reports an error for an
unknown or changed source snapshot. No shared BP-031 ledger or board file is
changed by this slice.

## Retained manufacturer evidence

The official TI ADS8881 Rev D datasheet is retained under the BP-031 evidence
namespace:

| Evidence | Retained artifact and SHA-256 | Scope |
| --- | --- | --- |
| TI `SBAS547D`, Rev D | `packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf` `EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8` | Exact `ADS8881IDGS` orderable identity and DGS package drawing/layout evidence |

Primary source: [TI ADS8881 datasheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf).
The reviewed pages are 6–7 for the DGS top-view pin map, page 50 for the exact
`ADS8881IDGS` orderable and its `VSSOP (DGS) | 10` package option, and 55–57
for the `DGS0010A` package drawing, example board layout, and example stencil
design. Page 50 is required identity evidence for this exact orderable; the
geometry remains sourced from the drawing and layout pages.

TI’s [ADS8881 product page](https://www.ti.com/product/ADS8881) lists
`VSSOP (DGS)` and links its CAD option to
[Ultra Librarian](https://vendor.ultralibrarian.com/TI/embedded/?gpn=ADS8881&package=DGS&pin=10).
No TI-native or partner CAD export was acquired or retained:

```text
manufacturerCad: state=not-acquired, authority=deny
partnerCad: availability=listed-by-ti-not-retrieved, retainedArtifactPath=null, authority=deny
```

The partner listing is evidence that a CAD route exists, not evidence that a
CAD object was acquired, verified against the exact MPN, or released for use.

## Manufacturer-derived geometry

The candidate transcribes the TI DGS0010A drawing and TI example board/stencil
layout. Coordinates use the top-view package datum with the long body axis on
the X axis and negative Y toward the top of the drawing.

| Parameter | Value | Authority |
| --- | ---: | --- |
| Body length | 4.75–5.05 mm | TI DGS0010A |
| Body width | 2.90–3.10 mm | TI DGS0010A |
| Maximum package height | 1.10 mm | TI DGS0010A |
| Lead/pad pitch | 0.50 mm | TI DGS0010A |
| Pad copper length along X | 1.45 mm | TI example board/stencil layout |
| Pad copper width along Y | 0.30 mm | TI example board/stencil layout |
| Pad-row center span | 4.40 mm | TI example board/stencil layout |
| Pad corner radius | 0.05 mm typical | TI example board/stencil layout |

The ten pad centers are:

```text
1=(-2.20,-1.00)  2=(-2.20,-0.50)  3=(-2.20, 0.00)  4=(-2.20, 0.50)  5=(-2.20, 1.00)
6=( 2.20, 1.00)  7=( 2.20, 0.50)  8=( 2.20, 0.00)  9=( 2.20,-0.50) 10=( 2.20,-1.00)
```

The renderer emits rectangular SMT pads at the manufacturer dimensions. The
TI drawing shows `R0.05` typical pad corners; this tscircuit candidate uses a
rectangular representation and records that approximation explicitly. The
candidate does not claim that this renderer is manufacturer CAD.

The selected non-solder-mask-defined project opening uses the TI `0.05 mm max
all around` guidance, giving a 1.55 mm × 0.40 mm opening per pad. The selected
paste aperture has zero project reduction, matching the TI example stencil
dimensions of 1.45 mm × 0.30 mm. These are rendered review inputs, not a
fabrication release.

TI does not publish a courtyard in the retained source. The candidate derives
a review courtyard from the maximum package and pad envelopes with 0.25 mm
project clearance: 6.35 mm × 3.60 mm, centered at (0, 0). Its
`sourceStatus` is `not-published`.

## Pin-one orientation

The TI top-view pin map and DGS0010A drawing place the pin-one identifier area
at the top-left. Pins 1 through 5 run top-to-bottom on the left edge; pins 6
through 10 return bottom-to-top on the right edge. The candidate maps pin 1 to
(-2.20, -1.00) at 0° project rotation and records this as
`manufacturer-drawing-derived`.

The root integration review independently matched this orientation to the
retained TI top view. The immutable candidate retains its pre-review status;
the canonical BP-031 ledger records the root-reviewed orientation and land
geometry separately while keeping release authority denied.

## Release disposition and gaps

The artifact intentionally fails closed:

```text
projectFootprint.state: review-only
projectFootprint.accepted: false
projectFootprint.fabricationAuthority: deny
releaseState: deny
fabricationAuthority: deny
accepted: false
```

The focused test verifies exact identity, source and evidence hashes, rendered
pad/mask/paste/courtyard geometry, pin-one coordinates, CAD denial, and the
canonical rendered-soup SHA-256:

```text
7A3D47D9C7F6B7F8BC1C67CB6329B579B21C9353581F510A18888B6A87D19783
```

Remaining gates are an acquired and hash-bound exact CAD object if required by
the final CAD workflow, board-level courtyard/edge and assembly review, and
final footprint/fabrication release. The canonical ledger now carries the
root-approved identity, drawing, pinout, copper geometry, orientation, and
seven-reference mapping, without granting board or fabrication authority.
