# BP-143 received-panel physical-evidence intake

`BP-143` has source snapshots and an exact selected connector/cable contract,
but it has no claimed received hardware or measurement result. The executable
intake in
[`src/bp-143-received-panel-evidence.ts`](../src/bp-143-received-panel-evidence.ts)
keeps its canonical record `absent` until a real submission exists. Its
authority remains `deny`; neither a complete intake nor this document approves
schematic integration, footprints, layout, or fabrication.

## Required identity and provenance

A real record must bind the exact Adafruit `2277` panel manufacturer, model,
PCB revision, and serial or asset ID; the exact `4170` signal cable with its
white pin-one stripe; the exact `4767` power cable and its `SMR-04V-N` /
`SMP-04V-NC` JST-SM mates; and the actual prototype assembly, board revision,
board serial or asset ID, and Samtec `TST-108-04-G-D-RA` header.

Receipt, procedure revision, setup, criteria, raw continuity, mating,
orientation, display-pattern, current, cable-drop, temperature, and fit
artifacts all require distinct IDs and lowercase SHA-256 content digests.
Each continuity meter, current meter, voltage meter, and thermal imager must
have a unique manufacturer, model, serial, calibration artifact/digest, and
validity period covering the canonical UTC record time. Receipt and record
times must be real canonical UTC values, ordered, and non-future.

## Required physical capture

The record requires de-energized continuity for all 16 straight-through HUB75
pins and all four contacts of both power branches. It then requires a
hash-bound record proving that the signal cable mates only to the panel INPUT,
the key is fully seated, both power latches engage, the panel and board pin-one
datums agree with the white stripe, and power polarity is confirmed.

At a retained declared display pattern, record average and peak current,
panel-end voltage, supply-end versus panel-end voltage and computed cable drop,
and per-branch current. Cable-drop voltage requires the identified calibrated
voltage meter, while branch current requires the identified calibrated current
meter; the panel-end voltage and display-pattern artifact must agree with the
current capture. Ambient and connector temperatures accept finite Celsius
values, including below zero. The fit record must show accessible panel INPUT and
latches, an unconnected panel OUTPUT, no forced signal or power cable bend,
and no observed interference.

The evaluator rejects substitution, pin or conductor swaps, a missing power
branch, an output-side mate, stale or incomplete calibration, non-finite or
inconsistent cable-drop readings, duplicate artifacts, aliases, accessors,
unknown fields, and incomplete fit records. Tests use synthetic evaluator
inputs only; they do not add a receipt or a measurement to the canonical
intake.

Numeric pass/fail limits are deliberately not invented in the schema. They
must be in the exact hash-bound procedure because the retained source material
does not publish every required continuity, voltage-drop, thermal, inrush, or
fit limit. Even after a complete record, all downstream release gates stay
`deny` pending their separate review.
