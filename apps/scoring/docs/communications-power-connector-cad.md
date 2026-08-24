# Communications and power connector CAD verification

**Task:** M4-11

**Disposition:** Fabrication deny. This is a primary-manufacturer source and
static-declaration reconciliation, not a CAD or physical-fit approval.

## Power-input boundary

USB-C PD through Amphenol `10177070-00011LF` remains the sole external
apparatus-power input and the USB 2.0 UFP service port. The planned request is
20 V, 3 A. `J_PWR_CARRIER`, Molex `43045-0400`, is a locking internal carrier
power-harness connector. It must not be presented as a second external power
inlet, source, or bypass around the PD controller and upstream eFuse.

## Source identity, checked 2026-08-24

Only manufacturer-owned product pages, drawings, and downloads appear here.
An acquired hash identifies bytes in this repository. A primary source that was
checked but was not locally acquired has no checksum and grants no geometry
credit.

| Interface | Selected part and exact mate | Primary manufacturer source | Local identity | Result |
| --- | --- | --- | --- | --- |
| RJ45 | Würth Elektronik `7499011121A`, `J_ETHERNET_MAGJACK` | [datasheet](https://www.we-online.com/components/products/datasheet/7499011121A.pdf), rev. `003.000`, dated 2023-07-11; [STEP](https://www.we-online.com/components/products/download/7499011121A%20%28rev1%29.stp), rev1 | `evidence/m4-11/we-7499011121a-datasheet.pdf`, SHA-256 `05B718A55907F45D2388BEA0EBEAADB60C7C93CE2C4C5CA582637936E890E350`; `evidence/m4-11/we-7499011121a-rev1.stp`, SHA-256 `44143609DA5D63A01551C85B343134BA5F027136C04CEBEFEA9ABA05AE6AFCD1` | Sources acquired; no project CAD import or overlay. Deny. |
| USB-C PD and service | Amphenol Communications Solutions `10177070-00011LF`, `J_USB_C` | [product page](https://www.amphenol-cs.com/product/1017707000011lf.html), [product drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf), [3D archive](https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip) | Product page checked. Drawing and 3D archive returned HTTP 403 from the manufacturer CDN, so neither has a local file or checksum. | Deny. Do not use a generic USB-C footprint. |
| Locking carrier power | Molex `43045-0400`, `J_PWR_CARRIER`; mate `43025-0400`; female crimp terminal `43030-0007` | [header product page](https://www.molex.com/en-us/products/part-detail/0430450400); [header drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450201_sd.pdf), `SD-43045-XXXX` rev E1; [mate drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430252400_sd.pdf), `430250000-SD` rev D; [terminal drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf), `SD-43030-XXXX` rev N9 | Exact rows checked on manufacturer sources. Direct local file acquisition timed out or was reset, so no Molex file or checksum is recorded. | Deny. No configured header/harness overlay exists. |

The Molex primary records identify the four-circuit right-angle, through-hole
header and its `43025-0400` locking receptacle plus `43030-0007` 20 to 24 AWG
female crimp terminal. That source check does not establish the released
harness wire, crimp tooling, seal or backshell, bend radius, or strain relief.

## Static reconciliation only

The tscircuit declarations and planning-board contract can support these
limited executable checks. They are not coordinate, footprint, STEP, panel,
or enclosure overlays.

| Check | Declared project state | Source constraint | Credit |
| --- | --- | --- | --- |
| `J_ETHERNET_MAGJACK` | The exact `7499011121A` declaration has an empty DNP footprint and no declared placement coordinates. | The acquired Würth drawing and STEP require an actual footprint and assembly placement. | No released geometry to overlay. |
| `J_USB_C` | The exact `10177070-00011LF` declaration is on the 110 mm by 55 mm communications planning board with 0.80 mm finished thickness and an empty DNP footprint. | The Amphenol product page specifies a 0.80 mm PCB thickness. Its drawing and STEP are unacquired. | Planning stackup compatibility only. |
| `J_PWR_CARRIER` | The exact `43045-0400` declaration is on the 290 mm by 135 mm application/display planning board with 1.60 mm finished thickness and an empty DNP footprint. | The Molex product page specifies 1.60 mm recommended PCB thickness. | Planning stackup compatibility only. |

No released PCB artwork, board coordinate system, enclosure CAD, cutout,
fastener, or strain-relief model exists in this worktree for these interfaces.
Therefore no exact hole, pad, shell-stake, panel-cutout, mating-axis, or
mechanical interference claim is made.

## Explicitly open gates

| Evidence | RJ45 | USB-C | Locking carrier power |
| --- | --- | --- | --- |
| Exact land pattern | Unverified | Unknown | Unverified |
| Board and enclosure CAD overlay | Unverified | Unknown | Unverified |
| Shield tabs or shell stakes | Unverified | Unknown | Unknown |
| Chassis fasteners and load path | Unknown | Unknown | Unknown |
| Installed-module service access | Unverified | Unverified | Unverified |
| Plug or harness strain relief | Unverified | Unverified | Unverified |

No fastener identity, position, tolerance stack, panel cutout, plug-load path,
or de-energized service trial is selected. A stackup compatibility result does
not verify physical fit, connector retention, chassis bonding, cable pull,
service reach, or production readiness.

## Required evidence before release

1. Acquire checksummed manufacturer drawings and CAD for the Amphenol and
   Molex selections through an authorized path, then reproduce the download
   identity in immutable evidence.
2. Import the exact selected land patterns and CAD models into released board
   and enclosure assemblies. Independently overlay pin one, every copper or
   hole feature, shield tabs or shell stakes, board edge, courtyard, mating
   axis, and enclosure cutout.
3. Release chassis fastener specifications, locations, torque, tolerance
   stack, and connector load paths.
4. Demonstrate the de-energized service sequence with latches, anchors, and
   required tools accessible.
5. Run production-equivalent plug-fit, extraction, cable-pull, harness bend,
   repeated-service, temperature, ESD, and EFT tests.

`src/communications-power-connector-cad.ts` is the executable fail-closed
record. Its test hashes each locally acquired Würth source and statically
checks the exact tscircuit declarations. It does not approve fabrication or
physical/service/strain-relief evidence.
