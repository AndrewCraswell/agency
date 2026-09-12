# Scoring technical debt

Only current, actionable findings belong here. Closed work is removed rather than archived.

| Priority | State | Description | Impact |
| --- | --- | --- | --- |
| High | ready | Close remaining TypeScript branch coverage gaps in workflow, remote authority, comparison capture and glossary validation without reducing the 100% thresholds. The shared epee contact kernel and strict-object helper now have complete focused coverage. | Restores the coverage gate and exercises rejection and boundary paths. |
| High | ready | Reconcile acquisition/application firmware with each native board's actual pinout, transport and power contract before bring-up. Start with the active virtual box; preserve the frozen combined variant separately. See the [hardware index](../../../packages/scoring-circuit/README.md). | Prevents older carrier or combined-board assumptions from driving the virtual hardware incorrectly while keeping one shared scoring core. |
