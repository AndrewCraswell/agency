# BP-104 received-part and fixture physical-evidence intake

This document defines the bounded intake record for physical evidence from a received BP-104 fixture harness. It is an evidence contract, not a statement that hardware has been received, fitted, wired, or fabricated.

The executable schema and validator are in [`bp104-fixture-physical-evidence-intake.ts`](../src/bp104-fixture-physical-evidence-intake.ts). The exported `blankBp104FixturePhysicalEvidenceIntake` is a frozen, null-filled template. Its statement explicitly records that it makes no received-hardware, fit, continuity, crimp, or fabrication claim.

## Required record

Every intake must have an immutable intake ID, UTC recording timestamp, operator, reviewer, and an explicit `incomplete` or `accepted` status. Every evidence artifact is identified by an artifact ID, SHA-256, UTC capture timestamp, reviewer, media type, and accepted review status. Artifact IDs must be unique within one intake.

The validator requires these sections in fixed order:

- Four retained Molex source reviews for `43045-1200`, `43025-1200`, `43030-0007`, and `44242-0005`. Each review propagates an explicit `cadDisposition`. `43045-1200`, `43025-1200`, and `44242-0005` require `exact-retained-cad-artifact` plus exact CAD URL, retained path, hash, and artifact bytes. `43030-0007` alone permits `not-acquired-pattern-probe-returned-404` with null CAD URL, path, hash, and artifact while its exact drawing and independent review are complete. Drawing, CAD, and review artifacts are separately hash-bound.
- Four received-part records with quantity, manufacturer/material-number identity, visible marking, identity photo, receipt photo, reviewer, and accepted result. The terminal `43030-0007` minimum is seven pieces.
- De-energized mating-fit, orientation, and label evidence: sample-fit photo, circuit-one alignment, latch/lock seating, independent fixture stop, named signal labels, pin-one marker, reviewer, and an explicit `forcedMateObserved: false`.
- Four executable miswire-rejection records: swap, open, return-bond, and reversed-mate. Each requires a measurement artifact, an observed rejection, and a reviewer.
- Seven crimp/retention records in signal order (`LEFT_WEAPON_A`, `LEFT_WEAPON_B`, `LEFT_WEAPON_C`, `RIGHT_WEAPON_A`, `RIGHT_WEAPON_B`, `RIGHT_WEAPON_C`, `PISTE`), with cavity, terminal MPN, separate crimp and retention photos, reviewer, and accepted result.
- Strain-relief evidence showing the pull-load path bypasses the crimp and PCB and that the bend path was verified.
- Calibrated continuity evidence using the existing BP-104 continuity evaluator, a measurement artifact, instrument manufacturer/model/serial, calibration certificate and due date, calibration artifact, and matching reviewer/result fields. Instrument and calibration identity must match the continuity record.

The validator also rejects cycles, object aliases, accessors, symbols, sparse arrays, extra keys, malformed timestamps, non-SHA-256 hashes, duplicate artifact IDs, and mismatched retained source bytes. This keeps the record suitable for immutable evidence handoff rather than treating labels or prose as proof.

## Current source gate

The retained Molex drawing and CAD-preview artifacts are checked against the existing `benchPrototypeFixtureHarness` source discovery record. The current exact-MPN CAD probe for `43030-0007` returned HTTP 404 at the guessed pattern URL. Its source state is `not-acquired-pattern-probe-returned-404`; this records only that observation and does not claim Molex has no CAD at another URL. Therefore its CAD URL, path, hash, and CAD artifact remain null. A complete accepted intake is permitted through that explicit no-CAD disposition when its exact drawing and independent review are complete; the other three MPNs still require exact retained CAD artifacts.

## Evaluation

`evaluateBp104FixturePhysicalEvidenceIntake(value)` returns `{ accepted, status, reasons }`. Any missing, contradictory, unbound, or failed section returns `accepted: false` and `status: "incomplete"`. The intake reviewer must be exactly `root-final-reviewer` and differ from the operator; every section reviewer and artifact reviewer must match that independent intake reviewer. Timestamps are accepted only when the existing canonical UTC parser accepts their exact serialized form. An `accepted` status is accepted only when all sections and the underlying BP-104 harness evaluator pass; a complete record with `status: "incomplete"` is also rejected. `validateBp104FixturePhysicalEvidenceIntake(value)` throws for every non-accepted record.

No function in this contract grants fabrication authority, changes backlog/status, or approves a hardware build. Acceptance is an evidence-state result only and remains subject to root review.
