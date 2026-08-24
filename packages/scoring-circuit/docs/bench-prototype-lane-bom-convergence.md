# BP-035 lane BOM convergence

BP-035 is the fail-closed reconciliation gate between the baseline BOM and the analog, processor, application, and connector lanes. It does not generate a purchase BOM, PCB geometry, or fabrication permission.

The evaluator requires BP-010, BP-031, BP-032, BP-033, and BP-034 as explicit inputs; an omitted artifact is accepted only with a named independent reviewer and rationale that it is not applicable. It compares exact board reference, MPN, package text, and intended population. It rejects duplicate references within a lane, every board-lane reference absent from the baseline, selected baseline records absent from every footprint lane, all population disagreement including DNP versus TBD, every remaining TBD, identity or package drift, unresolved populated identities, and incomplete footprint or received-sample evidence. It deliberately does not hide differences with reference aliases or package-name normalization.

BP-034 rows are classified before reconciliation. Board-populated connector references reconcile against BP-010. External mates, cables, samples, and test tooling retain their order and sample-evidence blockers without being misrepresented as PCB references.

The current result is `DENY` for a prototype order candidate. BP-034 now has exact source-backed selections for the USB-C cable (`USB2CC1M`) and Ethernet patch cable (`N201-003-BL`), so those selections do not contribute `selection-blocked` blockers. In particular:

- The exact BP-034 cable selections remain pre-order identities only; they do not claim purchase, receipt, mating, fit, retention, strain, continuity, SI/EMC, CAD/artwork, or release evidence.
- No BP-034 received-sample, mate, retention, strain, or continuity evidence has been accepted.
- BP-031, BP-032, and BP-033 retain unreviewed manufacturer drawing, CAD, generated artwork, and independent orientation gates.
- Baseline and downstream reference, package, and population differences remain enumerated blockers until they are corrected in their owning contracts.

An eventual `READY` result means only that an exact one-board prototype order candidate has converged. `fabricationDisposition` remains `DENY`, and production release remains false; schematic, layout, electrical validation, and fabrication authorization are separate gates.

Every evaluator result is recursively frozen, including blocker records, blocker source arrays, and unresolved-reference arrays, so downstream code cannot mutate reviewed convergence evidence.
