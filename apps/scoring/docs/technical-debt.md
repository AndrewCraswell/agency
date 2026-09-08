# Scoring technical debt

Only current, actionable findings belong here. Closed work is removed rather than archived.

| Priority | State | Description | Impact |
| --- | --- | --- | --- |
| High | ready | Close remaining TypeScript branch coverage gaps in workflow, remote authority, comparison capture and glossary validation without reducing the 100% thresholds. The shared epee contact kernel and strict-object helper now have complete focused coverage. | Restores the coverage gate and exercises rejection and boundary paths. |
| High | ready | Reconcile existing acquisition/application firmware with the native KiCad pinout and power-mode contract before board bring-up. See the current board design review rather than the earlier ESP32-only carrier plan. | Prevents old adapter assumptions from driving the new hardware incorrectly. |
| High | ready | Review and refresh the stale behavior-oracle manifest. The current check detects drift across existing runtime, simulator, firmware and environment artifacts, not just this cleanup. Do not regenerate it as a substitute for reviewing those changes. | Restores a trustworthy simulator baseline and the oracle verification gate. |
