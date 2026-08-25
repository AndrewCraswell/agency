# BP-033 BSS138AKA display-buffer reference-binding candidate

This is a prototype-first, review-only binding for exactly two canonical
references:

| Reference | Manufacturer | Exact MPN | Canonical package spelling | Footprint token | Pin labels |
| --- | --- | --- | --- | --- | --- |
| `Q_DISPLAY_BUFFER_A_ENABLE` | Nexperia | `BSS138AKA` | `SOT-23` (`SOT23` source code) | `sot23` | 1 G, 2 S, 3 D |
| `Q_DISPLAY_BUFFER_B_ENABLE` | Nexperia | `BSS138AKA` | `SOT-23` (`SOT23` source code) | `sot23` | 1 G, 2 S, 3 D |

The exact reference set is deliberately only those two rows. The canonical
display circuit binds each gate sink to its corresponding buffer
`BUFFER_ENABLE_N` path and each source to `net.GND`; the candidate does not
change that topology or integrate a board footprint.

## Source and provenance

The exact orderable and package facts are reused from the retained BP-032
record. The official Nexperia PDF is not copied, renamed, or relabeled as
BP-033 evidence:

| Role | Source | SHA-256 | Reviewed scope |
| --- | --- | --- | --- |
| Canonical display circuit | `packages/scoring-circuit/src/index.circuit.tsx` | `AFF3BD13C2E5A22B63BD5E423B61F8266C53A11717D16E94A5183C1E1525A7F2` | Exactly the two references, `BSS138AKA`, `sot23`, and G/S/D labels |
| Canonical display support inventory | `packages/scoring-circuit/src/application-display-carrier-support.ts` | `CCF41BBF1DBB02A234007AB120652EE47A8F9DF5D531AAEFF2558F3F331A523D` | Exactly the two support rows, Nexperia, MPN, and SOT-23 package |
| BP-032 manufacturer-fact record | `packages/scoring-circuit/src/bp032-reset-support-footprints.ts` | `5357138FC9E2BF25B6C96272453754C28A700D265183590F078B7684E655BC2C` | Reused SOT23 package, pin map, Figure 19 land dimensions, and denied review state |
| Retained manufacturer primary source | `packages/scoring-circuit/docs/evidence/bp-032/nexperia-bss138aka-datasheet.pdf` | `39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9` | PDF pages 2, 11, and 12: Table 2, Table 3, Figure 18, and Figure 19 |

The retained PDF is Nexperia's **BSS138AKA 60 V, single N-channel Trench
MOSFET**, released 2 February 2024. Page 2 gives pin 1 gate, pin 2 source,
pin 3 drain and identifies the exact SOT23 orderable. Figure 18 gives the
package outline. Figure 19 gives the SOT23 reflow guidance: three 0.6 mm by
0.7 mm solder lands, 1.9 mm upper-row pitch, and 1.4 mm row-center span.

The project review input preserves the BP-032 top-view datum: pin 1 G at
(-0.95, -0.7) mm, pin 2 S at (0.95, -0.7) mm, and pin 3 D at (0, 0.7) mm.
Those coordinates are source-controlled review geometry derived from Figure
19, not released CAD or a fabrication land pattern. Solder mask, paste,
courtyard, pin-one marking, and final orientation still require independent
review.

## Validator and authority boundary

The source keeps a private, alias-free, deep-frozen baseline and exports a
separately `structuredClone`d and deep-frozen public graph. Validation compares
the supplied graph with separate actual and expected seen sets. It rejects
cycles, aliases, symbol or hidden keys, accessors, prototype drift, mutable
descriptor state, and inspection failures such as a throwing proxy. The
validator never uses the public graph as its expected baseline.

The candidate remains denied for manufacturer CAD import, board placement and
fit, orientation and courtyard acceptance, DRC, fabrication, release, and
acceptance. No artwork is generated. A passing validator means only that the
review input is internally consistent; it grants no schematic, PCB, assembly,
or manufacturing authority.

## Files and verification

- Source: `packages/scoring-circuit/src/bp033-display-buffer-bss138aka-reference-binding.tsx`
- Focused test: `packages/scoring-circuit/src/bp033-display-buffer-bss138aka-reference-binding.test.tsx`
- Review: this document

The BP-033 candidate adds no evidence copy under `docs/evidence/bp-033` and
does not edit the canonical ledger, backlog, board, or convergence records.
Physical fit, pin-one marking, continuity, DRC, placement, fabrication, and
release remain downstream gates.
