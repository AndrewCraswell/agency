# BP-031 TI TPD4E05U06DQAR DQA project-footprint candidate

This review-only artifact covers the exact lane-B connector-side ESD shunt
`U_ESD`, replicated as `U_ESD_1` through `U_ESD_7`. It is isolated from every
board and does not approve schematic integration, layout, procurement,
fabrication, or release.

## Exact identity and primary source

The canonical selection is `Texas Instruments TPD4E05U06DQAR`, package
`DQA USON-10`. The selected row is bound to `U_ESD` in
`packages/scoring-circuit/src/one-channel-analog-readiness.ts`; BP-103 repeats
that identity for the seven analog cells.

The retained official source is:

| Source | Artifact | SHA-256 | Reviewed content |
| --- | --- | --- | --- |
| TI Rev. O datasheet | `packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf` | `C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6` | Page 4 TPD4 DQA pin map and functions; page 20 tape/reel exact orderable; pages 28-30 DQA0010A outline, land pattern, mask details, and stencil example; page 37 package-option addendum. |

The source URL is
<https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf>. The retained bytes are
hash-checked by the focused test. The source does not constitute an approval
of the project footprint.

## Package and pin map

TI identifies DQA0010A as a 10-pin USON package with a 2.4-2.6 mm body length,
0.9-1.1 mm body width, 0.55 mm maximum height, and 0.5 mm pitch. The TPD4
DQA top view on page 4 marks pin 1 at the top-left, pin 5 at the bottom-left,
pin 6 at the bottom-right, and pin 10 at the top-right. Pins 3 and 8 are GND; pins 6, 7,
9, and 10 are NC; pins 1, 2, 4, and 5 are the two protected differential
channels.

| Pin | TI name | Project review coordinate (mm) |
| ---: | --- | ---: |
| 1 | D1+ | (-0.4175, -1.0) |
| 2 | D1- | (-0.4175, -0.5) |
| 3 | GND | (-0.4175, 0.0) |
| 4 | D2+ | (-0.4175, 0.5) |
| 5 | D2- | (-0.4175, 1.0) |
| 6 | NC | (0.4175, -1.0) |
| 7 | NC | (0.4175, -0.5) |
| 8 | GND | (0.4175, 0.0) |
| 9 | NC | (0.4175, 0.5) |
| 10 | NC | (0.4175, 1.0) |

## Project geometry and dispositions

The TI land-pattern example gives 10 copper pads at 0.565 mm by 0.2 mm,
0.5 mm pitch, and 0.835 mm row-center spacing. The two GND pads 3 and 8 are
rendered at 0.565 mm by 0.4 mm, matching the enlarged center pads shown by the
TI pattern. TI's preferred non-solder-mask-defined example permits 0.07 mm
maximum mask expansion per edge; the candidate records that as a project
input. The TI 0.1 mm stencil example gives 0.565 mm by 0.2 mm regular apertures
and 0.36 mm center-pad apertures. Because the current tscircuit primitive
uses a symmetric per-edge paste margin, the review rendering uses a 0.02 mm
per-edge reduction on pads 3 and 8, producing 0.525 mm by 0.36 mm apertures;
this is explicitly project geometry and not claimed as TI CAD.

The review courtyard is 1.9 mm by 3.1 mm: the larger of the package and
rendered copper envelopes plus 0.25 mm on every side. It is only a project
review envelope.

No TI-native CAD, STEP, or external partner CAD artifact was acquired or
retained. `manufacturerCad.state` is therefore `not-acquired`, all CAD
authority is `deny`, project acceptance is `false`, and fabrication/release
remain denied. Pin-one orientation is recorded from the TI top view but still
requires independent assembly-orientation and board-fit review.

## Remaining gates

- acquire and independently review an exact TI or approved CAD artifact, or
  explicitly reconcile why the drawing-derived geometry is sufficient;
- review pin-one marking, assembly rotation, exposed-pad soldering, and
  courtyard/keepout behavior on the actual board;
- reconcile all seven `U_ESD` instances with BP-103 nets and schematic;
- run fabricator DRC and retain board artwork plus sample/continuity evidence;
- only then consider changing acceptance or fabrication authority.
