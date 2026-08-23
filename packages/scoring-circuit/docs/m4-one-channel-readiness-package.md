# M4 one-channel analog experiment readiness package

## Status

**Status: DENY.** This package makes the one-channel experiment's physical
dependencies and test evidence reviewable. It does not authorize procurement,
assembly, copper, Gerbers, energized testing, production use, seven-channel
replication, or a scoring/FIE claim.

The executable contract is
[`src/one-channel-analog-readiness.ts`](../src/one-channel-analog-readiness.ts).
It contains exactly one row for each of the 36 physical references in the
committed experiment circuit. Every row is DNP and every release flag remains
false. While the seven support references are absent, only the two unpowered
steps can be archived and `evidenceCompleteForReview` remains false.

## Connector safety

The standalone experiment circuit now declares the normal and guarded board
headers as male, matching the exact candidates:

| Interface | Board part and mate | Physical separation |
| --- | --- | --- |
| Normal fixture | Molex `43650-0300` Micro-Fit 3.0 three-circuit right-angle header; mate `43645-0300` | Shrouded, polarized, locking three-position, 3.0 mm family |
| Guarded force | JST `B2B-PH-K-S(LF)(SN)` two-circuit header; mate `PHR-2` | Shrouded, polarized, locking two-position, 2.0 mm family |

The pitch, position count, shroud, and mating families are different, so the
normal and guarded harnesses are physically incompatible. The cable drawings,
pin-one orientation, drill pattern, strain relief, and assembled keying test
remain mandatory evidence before a fixture may be attached.

## Circuit reconciliation gate

The circuit's 36 rows include the converter, regulator, reference, protection,
source switch, buffer, SAR, passives, six headers, and eight individual test
points. Part-specific manufacturer evidence replaces generic capacitor-family
pages for the KEMET MPNs.

The review also found support parts missing from the committed experiment
circuit. Exact DNP 0603 candidates and their part-specific evidence are now
selected, but they are not silently treated as present:

| Missing reference | Exact candidate | Required role |
| --- | --- | --- |
| `C_REF_IN` | `GRM188R71A105KA12D` | REF5025A-Q1 1 uF input bypass |
| `C_REF_OUT_HF` | `C0603C104K3RACTU` | REF5025A-Q1 local 100 nF output bypass in parallel with `C_REF` |
| `C_BUFFER_POS`, `C_BUFFER_NEG` | `C0603C104K3RACTU` | ADA4177-1 local positive- and negative-rail bypass |
| `C_NEG_IN` | `GRM188R71A105KA12D` | TPS60400 required 1 uF input capacitor, completing its three-capacitor network |
| `C_ISO_IN`, `C_ISO_OUT` | `GRM188R71A225KE15D` | NXE1 2.2 uF characterization candidates pending startup, ripple, and stability measurement |

`supportCircuitReconciled` is therefore required to remain false. The optional
NXE EMI filter is also DNP and unselected until isolated-harness ripple,
startup, leakage, and emissions evidence selects a topology without bridging
the isolation boundary. No layout or fabrication review may proceed while
these gates remain open.

The evidence validator mechanically rejects isolated-rail, reference, normal,
or guarded results while this reconciliation flag is false. Digests and review
records cannot substitute for the absent electrical parts.

## Per-part physical evidence

Each of the 36 physical references requires its own record. The schema rejects
missing, extra, duplicate, substituted, or package-mismatched rows. Each row
binds:

- exact reference, MPN, and package;
- manufacturer drawing and manufacturer CAD SHA-256 digests;
- released-artwork SHA-256 digest;
- independent reviewer identity, UTC review time, and explicit pass;
- as-built MPN, package, quantity, and component lot.

This records identity, not authority. The exact manufacturer drawing, land
pattern, copper, mask, paste or drill, courtyard, pin one or polarity, assembly
orientation, and measured overlay still need independent review.

## Fixture, calibration, and bring-up evidence

The evidence package requires one calibrated asset for each typed category:
isolated supply, DMM, oscilloscope, differential voltage probe, isolated current
probe, resistance standards, capacitance bank, and temperature chamber. Each
asset is bound to a calibration certificate, calibration due time, and settings
digest. Calibration validity must cover each recorded step. Categories, asset
IDs, and certificate IDs must each be unique; duplicates or expired records
fail closed.

The fixture record binds the interlock certificate, exact design revision,
approval time, and design digest. Bring-up must archive these ordered steps:

1. unpowered inspection;
2. isolation and continuity;
3. isolated-rail power;
4. reference verification;
5. normal-fixture permit;
6. normal matrix;
7. guarded-fixture permit;
8. guarded matrix.

Every step records typed numeric or Boolean observations, explicit units,
values, fixed minimum/maximum or expected values, result ID, limits ID, limits
digest, artifact digest, completion time, and an empty stop-failure list. A
claimed pass outside the fixed bounds is rejected; a digest provides provenance
only. Reviews and steps cannot postdate capture, step times are strictly
ordered, and fixture approval must precede the permit. Powered evidence
requires an external permit issued before the observation and bound to the same
fixture-interlock revision.
Any stop failure, missing permit, stale calibration, sequence error, rail fault,
unexpected code, relay disagreement, or trace omission is unavailable evidence,
never a favorable result.

Never connect a weapon, piste cable, ESD gun, EFT generator, surge generator,
or direct force source. See
[the protected experiment](m4-one-channel-protected-experiment.md) for the
bounded matrix and [the fixture blocker](m4-05-fixture-blocker.md) for the
external safety requirements.
