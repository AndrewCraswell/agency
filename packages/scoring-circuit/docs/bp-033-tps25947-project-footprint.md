# BP-033 TPS259474ARPWR RPW0010A project-footprint review

## Decision

This is an isolated BP-033 review-only transcription for both canonical
references that use the exact Texas Instruments orderable
`TPS259474ARPWR`:

| Reference | Circuit role | Device | Package |
| --- | --- | --- | --- |
| `U_VBUS_EFUSE` | USB-C VBUS eFuse | `TPS259474A` | VQFN-HR (RPW), 10-pin |
| `U_DISPLAY_LIMITER` | display branch limiter | `TPS259474A` | VQFN-HR (RPW), 10-pin |

The artifact is source-controlled review input. It does not instantiate either
reference in a board, change the canonical application-footprint ledger, or
authorize schematic integration, placement, routing, current capacity,
thermal performance, board fit, assembly, fabrication, or release.

The source and focused test are:

- [`src/bp033-tps25947-project-footprint.tsx`](../src/bp033-tps25947-project-footprint.tsx)
- [`src/bp033-tps25947-project-footprint.test.tsx`](../src/bp033-tps25947-project-footprint.test.tsx)

## Exact source binding

The canonical ledger remains unchanged. The new artifact records its exact
reference set and the ledger bytes used for this review input:

| Field | Bound value |
| --- | --- |
| Canonical source | `packages/scoring-circuit/src/bench-prototype-application-footprints.ts` |
| Canonical source SHA-256 | `EA10263933D3BC3CCFEAAA1EA00AEAAAB1797E367BF0EB6CCCDD680DE0E302A1` |
| Exact manufacturer | Texas Instruments |
| Exact orderable | `TPS259474ARPWR` |
| Exact device variant | `TPS259474A` |
| Exact package | VQFN-HR (RPW), 10-pin |
| Package drawing | `RPW0010A`, drawing revision `4225183/A` (August 2019) |

The ledger names two logical roles, while the active communications circuit and
BOM use one physical `U_EFUSE` reference. The artifact records that alias
explicitly rather than treating the two ledger rows as two active devices:

| Ledger role | Active circuit reference | Active BOM reference | Reconciled role |
| --- | --- | --- | --- |
| `U_VBUS_EFUSE` | `U_EFUSE` | `U_EFUSE` | Normal USB-C PD post-contract reverse-blocking eFuse |
| `U_DISPLAY_LIMITER` | `U_EFUSE` | `U_EFUSE` | Display branch limiter role in the active power contract; no second circuit instance |

The basis paths are retained as provenance only: the validator compares the
recorded basis and role reconciliation, but does not hash a mutable live file
at validation time.

The orderable addendum on the retained source identifies
`TPS259474ARPWR` as active production in `VQFN-HR (RPW) | 10`. The device
comparison table identifies the `TPS259474A` circuit-breaker auto-retry
variant with PG and PGTH functions. The package-information page gives a
nominal 2 mm by 2 mm package.

## Retained official TI evidence

The official PDF was already retained in the BP-033 evidence directory. This
slice reuses that immutable artifact by path and hash, and does not add a
duplicate copy:

| Evidence | Repository artifact | Official URL | Revision and reviewed pages | SHA-256 |
| --- | --- | --- | --- | --- |
| TI TPS25947 datasheet | `packages/scoring-circuit/docs/evidence/bp-033/ti-tps25947-datasheet.pdf` | [TI TPS25947 datasheet](https://www.ti.com/lit/ds/symlink/tps25947.pdf) | `SLVSFC9C` Rev. C, pages 1-6, 62-65, 67-71 | `051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC` |
| TI RPW0010A package drawing | same retained PDF | [TI TPS25947 datasheet](https://www.ti.com/lit/ds/symlink/tps25947.pdf) | `RPW0010A` drawing `4225183/A`, August 2019, pages 72-74 | `051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC` |

The focused test reads the retained bytes and fails if the recorded SHA-256,
path, byte length, document number, revision, URL, authority, or reviewed page
scope drifts. The validator also binds the complete source records, package
geometry, published copper/mask/paste/courtyard evidence, orientation, captured
authority booleans, deny gates, and persisted rendered-artwork hash.

## Pin map and exposed-pad disposition

The package top view on datasheet page 5 and the RPW0010A drawing use this
exact map:

| Pin | TI function | Review-land role |
| ---: | --- | --- |
| 1 | `EN/UVLO` | left edge, uppermost |
| 2 | `OVLO` | left edge |
| 3 | `PG` | left edge |
| 4 | `PGTH` | left edge, lowermost |
| 5 | `IN` | central HotRod power land |
| 6 | `OUT` | central HotRod power land |
| 7 | `DVDT` | right edge, lowermost |
| 8 | `GND` | right edge |
| 9 | `ILM` | right edge |
| 10 | `ITIMER` | right edge, uppermost |

RPW0010A has no separate unnumbered exposed thermal pad. Pins 5 and 6 are
numbered central HotRod power lands and are retained as `IN` and `OUT`; no
pad 11 or generic thermal pad is invented. The package outline gives the
nominal 2 mm by 2 mm size, 2.1 mm maximum body dimensions, 1 mm maximum
height, and 0.45 mm package pin pitch. The 0.5 mm values used in the review
rendering are land-row coordinate spacing values, not the package pitch.

## Published copper, mask, and paste evidence

The candidate records the page-73 copper example in the package top-view
frame. Coordinates use positive X to the right and positive Y toward the top
of the TI view. The rendered pad rectangles are explicitly a review
approximation: TI's drawing shows corner and land detail that is not accepted
as project copper by this slice.

| Pins | X (mm) | Y positions (mm) | Width (mm) | Height (mm) |
| --- | ---: | --- | ---: | ---: |
| 1-4 | -0.900 | 0.750, 0.250, -0.250, -0.750 | 0.600 | 0.250 |
| 5 | -0.275 | -0.325 | 0.300 | 1.750 |
| 6 | 0.275 | -0.325 | 0.300 | 1.750 |
| 7-10 | 0.900 | -0.750, -0.250, 0.250, 0.750 | 0.600 | 0.250 |

Page 73 shows the preferred non-solder-mask-defined option with a maximum
0.05 mm margin all around. It also shows the alternative solder-mask-defined
option with a minimum 0.05 mm margin all around. The candidate captures both
published values as review evidence and applies a 0.05 mm project-review
margin to its rendered pads. That is not a fabricator-specific mask release.

Page 74 publishes a 0.100 mm stencil example. The explicit printed-area
groups are:

| Pads | Published printed area |
| --- | ---: |
| 1, 4, 7, 10 | 93% |
| 5, 6 | 82% |

The page does not state a numeric reduction for pads 2, 3, 8, and 9. They are
therefore retained in an explicit `unquantifiedPadIds` list. The rendered
review artifact uses zero margin for those four apertures only as a visible
review placeholder, not as an accepted stencil process. The 93% and 82%
groups use symmetric rectangular reductions derived from the published areas.
That aperture shape is explicitly a review approximation; it is not a TI CAD
stencil import or an accepted assembly process. The 0.5 mm row spacing in the
rendered coordinates must not be read as the 0.45 mm package pitch.

The retained package drawing does not publish a courtyard. No courtyard,
thermal-via pattern, current-carrying copper, or board-fit envelope is emitted
as accepted evidence.

## Orientation and deny gates

The source-captured orientation is the TI top view with pin 1 at the
upper-left package identification. Pins 1 through 4 descend the left edge,
pins 5 and 6 occupy the central lower HotRod positions, and pins 7 through 10
ascend the right edge. The candidate records zero project rotation and keeps
independent board-orientation acceptance false.

All authority gates remain denied:

| Gate | State |
| --- | --- |
| Published identity, pin map, copper, mask, paste, and orientation captured | review evidence only |
| Native manufacturer CAD imported | false |
| Layout accepted | false |
| Current capacity accepted | false |
| Thermal performance accepted | false |
| Board fit accepted | false |
| Fabrication authorized | false |
| Release state | `deny` |

The rendered review geometry is bound to SHA-256
`2b05aa3d89eae2a366006507c35f744667daba4ce6e5af3ad731d527908d5cf4`.
That hash covers the ten rendered SMT pads and ten rendered paste apertures;
it is an artifact-integrity check, not fabrication approval.

## Verification

The focused test covers exact dual-reference and orderable/device/package
identity, all ten TI pin functions, the no-separate-exposed-pad decision,
retained PDF bytes and hash, page-73 copper and mask evidence, page-74 paste
groups, top-view orientation, rendered pad and paste counts, no courtyard,
absence of tscircuit errors, the rendered geometry hash, and fail-closed
identity, pin-map, source, and deny-gate drift.

No board, canonical ledger, BOM, backlog, or shared footprint file was edited
by this slice. No stage, commit, or approval was performed.
