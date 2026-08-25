# BP-032 ESP32 processor footprints

`BP-032` now records only the sole-controller P0 processor lane: one
`ESP32-S3-WROOM-1U-N16R2` module and its five selected boot, reset, and 3.3 V
support parts. STM32, processor isolation, isolated-link power, cross-domain
reset, SWD, and populated service headers are superseded P0 concepts and have
no active ledger rows.

The module record binds the retained Espressif datasheet, DXF, and STEP assets.
It records the 40 perimeter lands, exposed ground pad 41, nine ground-pad vias,
and manufacturer top-view pin-one datum. This is candidate evidence, not a
released board footprint.

All release gates remain denied: independent module overlay, EPAD via/paste,
mask, courtyard, support-part orientation, antenna cable/enclosure clearance,
and board-artwork review are still required before fabrication.
