# BP-000 approved-plan decision artifact

This is the BP-000 decision record for the canonical [bench prototype plan](./bench-prototype-plan.md).
It freezes the six planning lanes and assigns every canonical BP work unit to a role-based owner. Personal names are
not inferred. The `root-final-reviewer` role is the final reviewer for every lane and every work unit, so an
implementation agent cannot approve or close its own work.

The machine-readable source is
[`src/bench-prototype-plan-decision.ts`](../src/bench-prototype-plan-decision.ts), and its focused validator is
[`src/bench-prototype-plan-decision.test.ts`](../src/bench-prototype-plan-decision.test.ts). The validator fails closed
if the canonical task set changes without an assignment, if an assignment is duplicated or extra, if an owner or
reviewer is blank, if the owner and reviewer are the same, or if a lane owner drifts.

## Decision record

| Field | Value |
| --- | --- |
| Work unit | `BP-000` |
| Artifact revision | `BP-000.1` |
| Decision | Approved plan revision |
| Canonical plan | `packages/scoring-circuit/docs/bench-prototype-plan.md` |
| Prepared by | `implementation-agent` |
| Final reviewer | `root-final-reviewer` |
| Approval state | Approved by `root-final-reviewer` on 2026-08-24 UTC |
| Scope | Lane and work-unit ownership only; no work-unit status changes |

## Lane ownership

| Lane | Workstream | Owner role | Reviewer role |
| --- | --- | --- | --- |
| A | Architecture and schematic control | `architecture-and-schematic-owner` | `root-final-reviewer` |
| B | Analog and weapon fixture | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| C | Processors and isolation | `processors-and-isolation-owner` | `root-final-reviewer` |
| D | Ethernet, display, and application I/O | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| E | Physical bench design | `physical-bench-design-owner` | `root-final-reviewer` |
| F | Firmware and test assets | `firmware-and-test-assets-owner` | `root-final-reviewer` |

## Work-unit assignments

Every ID below is present exactly once in the machine-readable decision artifact.

| ID | Lane | Owner role | Reviewer role |
| --- | --- | --- | --- |
| `BP-000` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-010` | E | `physical-bench-design-owner` | `root-final-reviewer` |
| `BP-020` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-030` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-031` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-032` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-033` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-034` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-035` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-040` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-050` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-100` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-101` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-102` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-103` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-104` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-105` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-106` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-120` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-121` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-122` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-123` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-124` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-125` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-126` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-140` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-141` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-142` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-143` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-144` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-145` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-146` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-300` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-301` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-302` | E | `physical-bench-design-owner` | `root-final-reviewer` |
| `BP-303` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-400` | E | `physical-bench-design-owner` | `root-final-reviewer` |
| `BP-401` | E | `physical-bench-design-owner` | `root-final-reviewer` |
| `BP-402` | E | `physical-bench-design-owner` | `root-final-reviewer` |
| `BP-403` | A | `architecture-and-schematic-owner` | `root-final-reviewer` |
| `BP-500` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-501` | F | `firmware-and-test-assets-owner` | `root-final-reviewer` |
| `BP-502` | E | `physical-bench-design-owner` | `root-final-reviewer` |
| `BP-503` | F | `firmware-and-test-assets-owner` | `root-final-reviewer` |
| `BP-504` | F | `firmware-and-test-assets-owner` | `root-final-reviewer` |
| `BP-505` | C | `processors-and-isolation-owner` | `root-final-reviewer` |
| `BP-506` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-507` | D | `ethernet-display-and-application-io-owner` | `root-final-reviewer` |
| `BP-508` | B | `analog-and-weapon-fixture-owner` | `root-final-reviewer` |
| `BP-509` | F | `firmware-and-test-assets-owner` | `root-final-reviewer` |
| `BP-510` | F | `firmware-and-test-assets-owner` | `root-final-reviewer` |
| `BP-511` | F | `firmware-and-test-assets-owner` | `root-final-reviewer` |

The canonical plan's status table is updated separately after the implementation, verification, root review, and
commit gates are met.
