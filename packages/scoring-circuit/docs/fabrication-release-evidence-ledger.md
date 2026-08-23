# Fabrication release evidence ledger

`src/footprint-release-evidence.ts` gives the fabrication review one read-only
view across the USB-PD and power-stage manufacturer libraries. It joins the
exact MPNs from `fabrication-footprint-gates.ts` to the source libraries and to
the manufacturer-footprint adapter. It does not alter `index.circuit.tsx`,
clear `doNotPlace`, or generate a PCB footprint.

## Evidence states

| State | Meaning |
| --- | --- |
| `manufacturer-verified` | The source drawing contains the referenced datum and the library records it. This is still not a released CAD object. |
| `manufacturer-example` | The source provides an example, such as a stencil thickness or printed-area target. Assembly qualification is still required. |
| `manufacturer-specified` | The power-stage summary records a source-specified datum, but the complete locked CAD object and independent overlay are still open. |
| `transcribed` | A source-backed copper summary is recorded, but the adapter intentionally keeps it review-only because coordinates or compound geometry are incomplete. |
| `not-published` | The cited source does not publish this manufacturing datum. It must be defined and reviewed under the selected assembly process. |
| `not-imported` | The primary part-specific datum has not been acquired or imported. No geometry may be inferred from a generic package name. |

When both source libraries contain the same MPN, the ledger keeps the stronger
datum category for each manufacturing feature and marks the row `library:
merged`. This avoids discarding an exact USB-PD land pattern when the power
stage summary has the same capacitor, while preserving the adapter's canonical
DNP blockers.

The ledger intentionally reports source evidence separately from release
eligibility. Every row is `releaseState: deny` and `eligibleForPcb: false`.
`missingReleaseData` is copied from the adapter so that this audit cannot
silently drift from the DNP contract.

## Current critical rows

- `TPS25730ADREFR`: TI copper and stencil example are recorded; courtyard and
  solder-mask evidence remain open.
- `TPD4S201TRGRRQ1`, `TVS2200DRVR`, and `TPS259474ARPWR`: TI copper and
  stencil examples are recorded; assembly overlay, courtyard, mask, thermal,
  and power-path review remain open.
- `T523H107M035APE070`: KEMET copper and courtyard are recorded; paste,
  solder-mask, and capacitor validation remain open.
- `LMR43620MSC3RPERQ1` and `TPS56A37RPAR`: source land, mask, and stencil
  guidance is transcribed; compound-copper CAD import, courtyard, and board
  validation remain open.
- Exact MLCC records remain geometry-free until a part-specific manufacturer
  land pattern is acquired. Generic 0603, 0805, or 1210 artwork is prohibited.

## Conditions to close a row

Closing a row requires a focused CAD-import change that provides all of the
following in one independently reviewed object:

1. exact terminal copper and pin or polarity mapping;
2. solder-mask openings and paste apertures, including thermal-pad windowing;
3. a dimensioned courtyard and assembly orientation;
4. source revision and overlay evidence in the project record; and
5. layout, thermal, electrical, and assembly validation for the selected board.

Until all five are complete, the existing fabrication gate remains the source
of truth and the component stays DNP.
