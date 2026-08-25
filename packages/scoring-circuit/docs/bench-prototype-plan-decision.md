# BP-000 clean-sheet plan decision

This record binds the canonical [prototype backlog](./esp32-prototype-backlog.md)
to explicit lane ownership while reserving final approval, commits, and status
changes for `root-final-reviewer`.

| Field | Value |
| --- | --- |
| Revision | `BP-000.3` |
| Decision | Approved compact clean-sheet ESP32-only critical path |
| Reviewed | 2026-08-25 UTC |
| Canonical plan | `packages/scoring-circuit/docs/esp32-prototype-backlog.md` |
| Machine-readable record | `src/bench-prototype-plan-decision.ts` |
| Final reviewer | `root-final-reviewer` |

## Lane ownership

| Lane | Workstream | Owner role |
| --- | --- | --- |
| A | Architecture, power contracts, and schematic control | `architecture-and-schematic-owner` |
| B | Analog, weapon interface, and fixture | `analog-and-weapon-fixture-owner` |
| C | ESP32, acquisition, reset, and recovery | `esp32-acquisition-and-recovery-owner` |
| D | Ethernet, display, encrypted IR, and outputs | `ethernet-display-and-application-io-owner` |
| E | Physical board implementation | `physical-bench-design-owner` |
| F | Firmware, fixture software, and physical evidence | `firmware-and-test-assets-owner` |

The executable record assigns each of the 32 canonical `BP-*` deliverables
exactly once. Former micro-task IDs remain implementation evidence rather than
separate blockers. The validator fails when a task is missing, duplicated,
extra, assigned to an
unknown lane, self-reviewed, or added to the Markdown backlog without a
matching machine-readable assignment.
