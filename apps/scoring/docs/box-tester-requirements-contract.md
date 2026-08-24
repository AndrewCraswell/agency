# Tester requirements, independence, and coverage contract

**Contract:** BT-01
**Status:** planning baseline only

This is the executable coverage contract for the independent tester described in
[box-tester-roadmap.md](box-tester-roadmap.md). The machine-readable source is
[`../src/box-tester-requirements-contract.ts`](../src/box-tester-requirements-contract.ts).
It binds every frozen requirement family in the
[requirements-to-evidence ledger](requirements-to-evidence-ledger.md) to one
stimulus, independent observation, uncertainty statement, and retained evidence
class. This contract does not change USB-C PD boundaries or the approved C17
native and browser-WASM one-core architecture.

## Outcome independence

Virtual results exercise the corpus only. DUT decision and replay records are
secondary correlation evidence. A DUT run may pass only when the independent
physical observer sees the expected complete-apparatus result and infrastructure,
self-test, calibration, setup, and capture are valid. The virtual scope requires
only a virtual and infrastructure outcome. The DUT scope additionally requires a
passing DUT correlation and physical observer outcome; a failure in either is a
failure, while an unavailable or not-run participating outcome is
`indeterminate`. Infrastructure failure is `infrastructureError`. The evaluator
accepts only the exact canonical coverage row and an exact plain four-source
observation record, rejecting altered rows, accessors, inherited properties, extra
keys, and unknown outcomes.
No evaluation from this contract is a physical-qualification, FIE-approval, or
homologation claim.

| Requirement family | Independent stimulus | Independent observation | Uncertainty and retained evidence |
| --- | --- | --- | --- |
| REQ-NORM-GENERAL | Seven-conductor and piste paths | Measured conductor and piste state | Switch, resistance, leakage, cable error; immutable timeline |
| REQ-NORM-THREE-WEAPON | Approved three-weapon transitions | Lamps and buzzer correlated to measured lines | Timing, impedance, capacitance, observer error; scenario capture |
| REQ-NORM-OUTPUTS | Qualified, rejected, latched, reset outputs | Electrical, optical, or acoustic observer | Sensor and clock error; raw capture and non-events |
| REQ-NORM-POWER | Power, reset, brownout, recovery | Power and physical-output capture | Supply and timestamp error; boot-identity capture |
| REQ-HW-SCORING-AUTHORITY | ESP32 fault and link-loss conditions | STM32 output and unavailable-state observer | Fault-injection error; authority timeline |
| REQ-HW-SIGNAL-ALLOCATION | Declared line-state sequences | Measured lines and physical output | Measurement and skew error; line-map capture |
| REQ-PRODUCT-DECISION-RECORDS | Event, reset, replay triggers | Record correlated to physical output | Alignment and capture-loss error; digest and capture |
| REQ-PRODUCT-TRANSPORT | Valid, malformed, duplicated frames | Physical safe-state observer | Injection timing error; frame and line capture |
| REQ-SECURITY-TRUST | Authorized, rejected, update, recovery requests | Safe-output and unavailable-state observer | Provenance and observer error; audit capture |
| REQ-HW-ANALOG-PROTECTION | Threshold, fault, source, sink paths | Calibrated line and safe-result measurement | Instrument, impedance, temperature error; raw capture |
| REQ-HW-FIXTURE-CALIBRATION | Open, short, ground, cross-line, impedance | Tester self-measurement before DUT evaluation | Calibration, drift, leakage, delay, skew; self-test record |
| REQ-HW-INTERFACES | Reel, piste, connector, misuse paths | No-back-power and physical safe state | Contact, cable, supply error; interface capture |
| REQ-HW-SCHEMATIC-RELEASE | Safe-state and output-control conditions | Physical safe-output observer when hardware exists | Tolerance and measurement error; schematic reference |
| REQ-HW-LAYOUT-RELEASE | Interference, load, signal-integrity conditions | Physical output and line observer when hardware exists | Bandwidth, thermal, environment error; revision capture |
| REQ-PRODUCT-MANUFACTURING | Production escape-detection subset | Tester self-test and apparatus observer | Golden-unit and sampling error; retained result |
| REQ-PRODUCT-VALIDATION | Approved EVT operational cases | Complete-apparatus output observer | Tester and DUT error; immutable HIL timeline |
| REQ-PRODUCT-QUALIFICATION | Approved DVT matrix | Traceable physical-output observer | Instrument and environment error; qualification archive |
| REQ-PRODUCT-PRODUCTION | Service, provisioning, production cases | Independent production observer | Fixture correlation and sampling error; release record |
| REQ-PRODUCT-ENCRYPTED-IR | Authenticated command, replay, range cases | Physical output and safe-idle observer | IR timing, range, angle, venue-light error; provenance capture |

## Closed failure modes

The validator rejects a missing, unmapped, reordered, or duplicate requirement
family and a row without stimulus, observation, uncertainty, or evidence. An
explicitly unsupported row is `skipped`, never `pass`. BT-02 remains responsible
for the electrical interface and USB-C PD boundary; BT-06 through BT-10 remain
required before any physical-output correlation or qualification conclusion.
