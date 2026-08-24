# M4 one-channel analog experiment readiness package

## Status

**Status: DENY.** This package makes the one-channel experiment's physical
dependencies and test evidence reviewable. It does not authorize procurement,
assembly, copper, Gerbers, energized testing, production use, seven-channel
replication, or a scoring/FIE claim.

The executable contract is
[`src/one-channel-analog-readiness.ts`](../src/one-channel-analog-readiness.ts).
It contains exactly one row for each of the 45 physical references in the
committed experiment circuit. Every row is DNP and every release flag remains
false. The source circuit is electrically reconciled, but only the two
unpowered steps can be archived while footprint and fixture evidence remain
absent, and `evidenceCompleteForReview` remains false.

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

The circuit's 43 rows include the converter, regulator, reference, protection,
source switch, buffer, SAR, passives, six headers, and eight individual test
points. Part-specific manufacturer evidence replaces generic capacitor-family
pages for the KEMET MPNs.

The eight required support references are now in the standalone
source circuit and in its same-reference BOM. All are DNP, tied to the listed
device pins and isolated-domain return, and remain unreleased:

| Reference | Exact candidate | Pin/net connection and required role |
| --- | --- | --- |
| `C_REF_IN` | Murata `GRM188R71A105KA12D`, 1 uF X7R, 10 V, 0603 | `U_REF` input pin 2 (`S5V_ISO`) to `SGND` |
| `C_REF_REG_HF` | KEMET `C0603C104K3RACTU`, 100 nF X7R, 25 V, 0603 | `U_REF` output pin 6 (`REF_2V5`) to `SGND`, in parallel with 10-uF `C_REF_REG` |
| `R_REF_SAR` | Vishay Dale `RCWE0603R220FKEA`, 0.22 ohm, 1%, 0603 | Series feed from the REF5025-local node to the ADS8881-local reference node |
| `C_BUFFER_POS` | KEMET `C0603C104K3RACTU`, 100 nF X7R, 25 V, 0603 | ADA4177-1 pin 7 (`S5V_ISO`) to `SGND` |
| `C_BUFFER_NEG` | KEMET `C0603C104K3RACTU`, 100 nF X7R, 25 V, 0603 | ADA4177-1 pin 4 (`S5V_NEG`) to `SGND` |
| `C_NEG_IN` | Murata `GRM188R71A105KA12D`, 1 uF X7R, 10 V, 0603 | TPS60400 input pin 2 (`S5V_ISO`) to pin 4 (`SGND`) |
| `C_ISO_IN` | Murata `GRM188R71A225KE15D`, 2.2 uF X7R, 10 V, 0603 | NXE1 input pin 1 (`SYSTEM_5V`) to pin 2 (`SYSTEM_GND`); it does not cross isolation |
| `C_ISO_OUT` | Murata `GRM188R71A225KE15D`, 2.2 uF X7R, 10 V, 0603 | NXE1 output pin 6 (`S5V_ISO`) to pin 7 (`SGND`) |

TI requires a 1-uF to 10-uF input bypass for `REF5025A-Q1` and a 1-uF to
50-uF low-ESR output capacitor with ESR no greater than 1.5 ohm. `C_REF_REG` is
KEMET `T521B106M025ATE100`: 10 uF, 25 V polymer tantalum in a 1411 / 3528 B
case. Its [manufacturer datasheet](https://search.kemet.com/download/specsheet/T521B106M025ATE100)
specifies 100 milliohms maximum ESR at 25 C and 100 kHz, which is below the
1.5-ohm requirement. `C_REF_REG_HF` is only the REF5025-local high-frequency parallel
bypass. The separate ADS8881-local `C_REF` is Murata
`GRM21BR71A106KE51L`, 10 uF X7R, 10 V, 10%, 0805, fed through
`RCWE0603R220FKEA` 0.22 ohm. No smaller capacitor is placed in parallel at
the ADC REF pins. TI specifies three 1-uF ceramic capacitors for `TPS60400`: flying,
input, and output. The MLCC manufacturers publish impedance/ESR curves rather
than a single DC ESR maximum, so their impedance and dc-bias behavior are
unresolved physical characterization gates, not a claim that an unmeasured ESR
value is acceptable.

`supportCircuitReconciled` is structurally true only because all eight exact
references are populated in the standalone source circuit and match the
one-to-one BOM. It does not authorize assembly, an energized test, copper,
Gerbers, or fabrication. `poweredTestingAuthorized` remains false until each
exact footprint and the fixture have physical evidence; the validator rejects
isolated-rail, reference, normal, and guarded records before then. The optional
NXE EMI filter remains DNP and unselected until isolated-harness ripple,
startup, leakage, and emissions evidence selects a topology that preserves the
isolation boundary.

## Per-part physical evidence

Each of the 45 physical references requires its own record. The schema rejects
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
