# BP-033 W5500 project-footprint candidate

This is an isolated review artifact for `U_W5500`, WIZnet `W5500`. It does not
instantiate a board component, alter the shared application ledger, or permit
layout, routing, signal-integrity, assembly, or fabrication work.

## Source and drawing applicability

The source is the retained official
[`W5500 Datasheet Version 1.1.0`](https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf),
`docs/evidence/bp-033/wiznet-w5500-datasheet.pdf`, SHA-256
`7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D`.
The candidate uses pages 2, 7, and 64 through 65: WIZnet identifies the part
as a 48-pin, 7 mm by 7 mm, 0.5 mm-pitch LQFP; Figure 26/27 apply to the
post-July-2021 package revision.

The drawing specifies a 9 mm lead-tip span, 7 mm body, 0.17 to 0.27 mm lead
width, and 0.45 to 0.75 mm lead length. It shows no exposed thermal pad. The
bottom-centre hole/recess mentioned by WIZnet is not an exposed pad, so this
candidate contains no central copper, mask, or paste aperture.

## Project geometry

`src/bp033-w5500-project-footprint.tsx` is the source-controlled candidate. It
places 48 rectangular pads at 0.5 mm pitch, with pin 1 at `(-4.35, 2.75)` mm
and the source top-view pin sequence continuing counter-clockwise. Its 1.50 mm
by 0.30 mm copper pads, 0.05 mm mask expansion, 0.05 mm paste reduction, and
10.8 mm square courtyard are project review inputs, not manufacturer land
pattern recommendations.

The candidate has no retained first-party CAD. CAD import, independent pin-one
orientation review, central-recess/thermal-pad disposition review, board fit,
and manufacturing review remain open. Every acceptance value is false and the
release state is `deny`.
