# BP-123 reset/watchdog physical-capture intake

`bp123-reset-watchdog-physical-evidence.ts` supplies a blank, immutable intake
template for the six capture classes already frozen by the BP-123
reset/watchdog contract: cold start, brownout, watchdog timeout, manual reset,
cross-domain containment, and power-off/backfeed.

The intake derives the exact rails, reset nets, observed signals, thresholds,
delays, watchdog limits, and injected-current limits from the canonical
contract. Each submitted capture must retain its exact metric list and units,
calibrated instrument identity, calibration artifact hash, UTC timestamp,
procedure and setup artifacts, input profile, sample assembly/revision/serial
identity, waveform file name and SHA-256 hash. All six captures must bind one
sample identity. The envelope also requires a separately identified reviewer,
canonical UTC review timestamp, and hashed review artifact. The reviewer must
not be any capture operator, and the reviewer artifact ID or digest must not
reuse a capture waveform/capture artifact.

The checked-in template has no sample, reviewer, instrument, waveform, capture,
or measurement. The evaluator can report only `incomplete` or
`ready-for-independent-review`; `physicalEvidenceAccepted` is always false.
A structurally complete test fixture demonstrates schema reconciliation only
and never represents physical evidence, BP-300 completion, fabrication
authority, or a released scoring apparatus.
