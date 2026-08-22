# Authoritative event capture contract

M2-04 stores bounded canonical front-end evidence next to an M0-05 decision record. It accepts only an outcome emitted by the STM32 `weapon-scorer`; capture neither evaluates electrical relations nor supplies a classification.

For every canonical snapshot, the STM32 owner calls `observe` with its strictly increasing acquisition sequence. When the scorer emits its result for that exact snapshot timestamp, it calls `capture`. `preSamples` includes that trigger snapshot; `postSamples` contain only strictly later snapshots. The capture layer keeps both windows bounded before exposing an immutable `CapturedDecisionRecord`.

The embedded M0-05 record carries the reason, rule-set and timing-table revisions, firmware identity, scoring boot ID, and the complete sequence/time range. `CapturedDecisionRecord` owns its embedded evidence; `rawCaptureRefs` remains empty until M2-08 persistence and content-addressing provide a real reference. The evidence envelope preserves `available`, `indeterminate`, and `unavailable` snapshots unchanged. An absent, non-monotonic, revision-mismatched, or application-originated input is rejected; the layer does not invent an uncertainty result.

This is intentionally not a transport, link, ESP32, journal, replay-rendering, or firmware-SDK contract.
