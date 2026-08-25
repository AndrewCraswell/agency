# BP-035 lane BOM convergence

BP-035 is the fail-closed reconciliation gate between the baseline BOM and the analog, processor, application, and connector lanes. It does not generate a purchase BOM, PCB geometry, or fabrication permission.

The evaluator requires BP-010, BP-031, BP-032, BP-033, and BP-034 as explicit inputs; an omitted artifact is accepted only with a named independent reviewer and rationale that it is not applicable. It compares exact board reference, MPN, package text, and intended population. It rejects duplicate references within a lane, selected baseline records absent from every footprint lane, all population disagreement including DNP versus TBD, every remaining TBD, identity or package drift, unresolved populated identities, and incomplete footprint evidence. It deliberately does not hide differences with reference aliases or package-name normalization.

Exact lane identities that are absent from the historical BP-010 baseline are copied into an explicitly marked BP-035 order-candidate projection. The projection never overwrites a historical reference, excludes TBD or incomplete identities, and rejects conflicting duplicate lane identities. This separates historical baseline coverage from the candidate BOM without silently normalizing lane data.

BP-034 rows are classified before reconciliation. Board-populated connector references reconcile against BP-010. External mates, cables, samples, and test tooling remain visible as external rows without being misrepresented as PCB references. Their physical receipt, fit, retention, strain, and continuity evidence belongs to BP-105/BP-502 and does not block BP-035.

Footprint state is per reference: `not-started`, `reviewed-unapproved`, or `approved`. Retained source files alone do not count as reviewed footprint evidence, and root-reviewed candidates remain blocked until their owning lane records explicit approval. BP-032 `U_ISO_POWER` is the first bounded `approved` lane footprint row; all other reviewed candidates remain unapproved.

The current result is `DENY` with 347 blockers across 247 references: 22 unresolved MPNs, 36 unresolved packages, 34 unresolved populations, 220 open footprint-evidence rows, 7 missing lane references, 8 missing baseline references, 12 population drifts, and 8 package drifts. `selection-blocked` is zero. Current footprint states are:

- BP-031: 42 approved and 71 reviewed-unapproved.
- BP-032: 1 approved and 50 reviewed-unapproved; 48 populated rows currently contribute open footprint blockers.
- BP-033: 89 reviewed-unapproved and 12 not-started.

BP-034 has exact source-backed selections for the USB-C cable (`USB2CC1M`) and Ethernet patch cable (`N201-003-BL`), so those selections do not contribute `selection-blocked` blockers. In particular:

- The exact BP-034 cable selections remain pre-order identities only; they do not claim purchase, receipt, mating, fit, retention, strain, continuity, SI/EMC, CAD/artwork, or release evidence.
- No BP-034 received-sample, mate, retention, strain, or continuity evidence is claimed by this gate.
- BP-031, BP-032, and BP-033 retain incomplete manufacturer drawing, CAD, generated artwork, independent orientation, or explicit approval gates.
- Baseline and downstream reference, package, and population differences remain enumerated blockers until they are corrected in their owning contracts.

An eventual `READY` result means only that an exact one-board prototype order candidate has converged. `fabricationDisposition` remains `DENY`, and production release remains false; schematic, layout, electrical validation, and fabrication authorization are separate gates.

Every evaluator result is recursively frozen, including blocker records, blocker source arrays, and unresolved-reference arrays, so downstream code cannot mutate reviewed convergence evidence.
