# BP-032 `J_STM_SWD` Samtec FTSH footprint evidence

Status: review-only candidate. This evidence slice remains unaccepted, with
release and fabrication authority denied.

## Exact selected connector

`J_STM_SWD` is bound to the exact Samtec orderable
`FTSH-105-01-L-DV-007-K`:

| Code field | Selected value | Meaning |
| --- | --- | --- |
| `105` | 5 positions per row | 2 rows, 10 positions total |
| `01` | `.120 in [3.05 mm]` lead style | Vertical SMT tail length |
| `L` | 10 microinch selective gold contact area, matte tin tail | Plating |
| `DV` | Double vertical | Surface-mount termination |
| `007` | Position 7 omitted | 9 populated PCB pads |
| `K` | Keying notch | Samtec print identifies `-K` for FFSD mating |

The Samtec FTSH print describes a `.050 in [1.27 mm]` double-vertical SMT
terminal strip. Its Figure 2 shows the `-K` configuration; the exact `-007`
omission is bound by the orderable code and retained package contract. The
retained footprint print shows the lower row beginning at pin 1 and the upper
row at pin 2, with odd pins on the lower row and even pins on the upper row.
Because pin 7 is omitted, the fourth lower-row land is absent.

## Retained official evidence

The evidence files are retained under
`packages/scoring-circuit/docs/evidence/bp-032`:

| Artifact | Official source | SHA-256 |
| --- | --- | --- |
| `samtec-ftsh-vertical-smt-print.pdf` | [Samtec FTSH series print](https://suddendocs.samtec.com/prints/ftsh-1xx-xx-xxx-dv-xxx-xxx-x-xx-mkt.pdf), printed pages 1–2 | `EF2961377445B9AD10762EA27519E7B59E5CBB5847DC0058D8E35C0D97C446A3` |
| `samtec-ftsh-vertical-smt-footprint.pdf` | [Samtec FTSH recommended PCB layout](https://suddendocs.samtec.com/prints/ftsh-1xx-xx-xxx-dv-xxx-footprint.pdf), printed pages 1–2 | `CAA205B92560423F3B0AEA9C69D6C38340D1B7F01B0655092994450E935EDCB3` |
| `samtec-ftsh-smt-catalog.pdf` | [Samtec FTSH SMT catalog](https://suddendocs.samtec.com/catalog_english/ftsh_smt.pdf) | `F918233908DD8D2FC733C6BBF6582018BE9ACAD50F1E193C27F8DC1E734EE754` |
| `samtec-ffsd-05-d-06-00-01-n.html` | [Samtec FFSD-05-D-06.00-01-N product page](https://www.samtec.com/products/ffsd-05-d-06.00-01-n) | `F5E68A077171E9C38D26D812B440138A236E6145167EA4914F82D1D8956D7933` |

The FTSH print and footprint drawing are manufacturer-primary geometry
evidence. The retained source files and hashes are checked by the executable
validator, including the relevant printed pages listed above. The retained
FFSD page identifies the exact BP-124 mating candidate, dual-row 1.27 mm
pitch, keyed polarization, and six-inch assembly code.

## Candidate land pattern

The manufacturer footprint print provides the following review inputs for the
generic double-vertical family:

- 1.27 mm pitch and 3.429 mm row-center span (`.135 in` reference).
- 2.794 mm pad length (`.110 in`).
- 0.74 mm inter-pad gap (`.029 in`) and 1.27 mm pitch imply a 0.5334 mm
  pad width (`.021 in`); this width is explicitly recorded as a derivation,
  not a claimed CAD export.
- Nine copper lands are retained for the five-column, two-row package after
  omitting pin 7. The lower-row pads are pins 1, 3, 5, 7, 9 in the generic
  drawing; the pin-7 land is removed, leaving pins 1, 3, 5, and 9. The upper
  row is pins 2, 4, 6, 8, and 10.
- Figure 2 is the manufacturer stencil-layout reference and specifies a
  0.0060 in [0.152 mm] stencil. It does not specify a final paste reduction.
- The retained drawing does not publish a numerical solder-mask expansion or
  a courtyard. The project record therefore keeps both denied.
- The `-K` key notch is the selected orientation feature. The drawing's NPTH
  locating feature applies to EPC/EC options, not this exact `-K` orderable;
  no alignment pin, pick-and-place pad, board lock, or ejector option is
  selected.

The machine-readable record in
`packages/scoring-circuit/src/bp032-ftsh-105-01-l-dv-007-k-footprint.ts`
retains nine explicit pads, the BP-124 signal map, pin-one datum, mating
identity, source hashes, and fail-closed validation. It is project review
input only, not a released board-library footprint.

## Denied downstream dispositions

The following dispositions are explicit review gates, not implied by the
presence of a drawing or a candidate pad list:

| Item | Retained state | Authority |
| --- | --- | --- |
| Exact Samtec CAD | Not acquired; product-page access is gated | Deny |
| Manufacturer solder mask | No numeric expansion or web rule in the retained print | Deny |
| Manufacturer paste | Stencil layout and 0.152 mm stencil thickness retained; final aperture reduction open | Deny |
| Manufacturer courtyard | Not published in the retained source | Deny |
| Project solder mask, paste, courtyard | Review-only candidate geometry | Deny |
| Project artwork | Not generated | Deny |
| Acceptance and fabrication | `accepted: false`, `releaseState: deny`, `fabricationAuthority: deny` | Deny |

Pin one remains the lower-left pad in the Samtec top-view convention at zero
board rotation, but its independent orientation review is still pending.

## CAD and acceptance boundary

Samtec's product page advertises instant CAD download, but no exact CAD archive
was acquired or retained in this slice. The generic series print is not
misrepresented as CAD. Consequently:

- manufacturer CAD state is `not-acquired-access-gated`;
- solder-mask, paste, courtyard, artwork, assembly, continuity, mating-fit,
  and final PCB-tool comparison remain denied;
- the evidence is `accepted: false`, `releaseState: deny`, and
  `fabricationAuthority: deny`;
- independent root review is required before any BP-032 status change.

The upstream BP-124 source files are bound by SHA-256 in the machine-readable
record but were not edited by this slice. Root should recheck those hashes and
the final PCB-library output before committing or updating the canonical
backlog.
