# Seven-conductor logical signal contract

**Contract:** M0-03
**Status:** review draft; not a released connector pinout, analogue schematic, or hardware calibration
**Scope:** seven external logical conductors, acquisition phases, logical observations, illegal states, and input-safe behavior

## Purpose and authority

This contract defines the STM32 acquisition boundary before the physical front end is designed. It applies to the logical conductors in [`scoring-glossary.md`](scoring-glossary.md), not to MCU pins, connector contacts, protective earth, chassis, or an unpublished commercial apparatus topology.

The normative source is the August 2026 FIE Material Rules as cited in [`fie-traceability-matrix.md`](fie-traceability-matrix.md): GEN-01 through GEN-07, FOIL-01 through FOIL-05, EPEE-01 through EPEE-05, SABRE-01 through SABRE-07, and OUT-01 through OUT-05.

The FIE rules require specified scoring and diagnostic outcomes. They do **not** prescribe the names `A`, `B`, and `C`, a seven-conductor pinout, excitation polarity, source impedance, ADC/comparator thresholds, sample rate, or an analogue topology.

Every statement labelled **FIE requirement** restates a cited matrix row. Every statement labelled **Product contract** is this project's deterministic representation choice. A product choice is not an FIE limit, approval, or schematic instruction.

## Boundary and conductor identities

| Logical conductor | Product contract meaning | Not a claim about |
| --- | --- | --- |
| `left.A` | Left-side primary weapon-contact conductor | A connector pin, lamp color, weapon type, or source polarity |
| `left.B` | Left-side first return/control conductor | A connector pin, lamp color, or a particular bodywire wire |
| `left.C` | Left-side second return/control conductor | A connector pin, lamp color, or a particular bodywire wire |
| `right.A` | Right-side primary weapon-contact conductor | A connector pin, lamp color, weapon type, or source polarity |
| `right.B` | Right-side first return/control conductor | A connector pin, lamp color, or a particular bodywire wire |
| `right.C` | Right-side second return/control conductor | A connector pin, lamp color, or a particular bodywire wire |
| `piste` | Shared conductive-piste reference conductor | Protective earth, chassis earth, signal ground, or an MCU ground pin |

**Product contract:** `A`, `B`, and `C` are stable conductor identities. A weapon phase selects their functional relation; no implicit wiring convention is allowed. `left` and `right` identify apparatus positions and do not imply red or green lamp assignment.

**FIE requirement:** the piste is conductive and earthed at its centre, and a hit on earthed material, guard, or conductive piste must not register where the weapon rules require it (GEN-03, GEN-06, EPEE-04). `piste` names the resulting measured reference relation only. It does not specify mains, chassis, or isolation implementation.

## Phase perspective

An acquisition phase has an explicit perspective so that a side-local
observation is never mistaken for a cross-side target observation:

| Perspective | Meaning |
| --- | --- |
| `acting-side` | The `side` field is the side whose weapon is being evaluated. `opposingTargetSide` is the other side. A permitted relation may involve the acting-side weapon and the opposing side's conductive target/non-target return. |
| `affected-side` | The `side` field is the side whose local loop, guard/piste reference, equipment, or control circuit is being assessed. All required relations are same-side unless the phase table explicitly says otherwise. |

`opposingTargetSide` is derived deterministically: it is `right` when
`actingSide` is `left`, and `left` when `actingSide` is `right`. A phase uses
cross-side relations only when its table identifies the `acting-side`
perspective. Such relations are legal target-context observations, not
`crossLine` faults. Any other cross-side relation is `crossLine`.

## Acquisition model

One acquisition cycle emits ordered phase records for the selected weapon. A phase record contains:

| Field | Meaning |
| --- | --- |
| `weapon` | `foil`, `epee`, or `sabre` |
| `phase` | Stable phase name from the relevant table below |
| `side` | `left` or `right`, interpreted by the required `perspective` field |
| `perspective` | `acting-side` or `affected-side`, as fixed by the relevant phase row |
| `atUs` | Monotonic observation instant in integer microseconds |
| `relations` | Named electrical relations, including state and measured interval where available |
| `status` | `available`, `indeterminate`, or `unavailable` for the complete phase |

A relation names its endpoints in lexical order, for example `left.A<->left.B`. Its state is one of the glossary states: `open`, `closed`, `grounded`, `crossLine`, `outOfRange`, `indeterminate`, or `unavailable`. A measured resistance carries `resistanceMilliOhms` and uncertainty or a bounded interval. A zero-ohm measurement is not missing; `null` means not measured.

**Product contract:** an observation is deterministic only when its phase, endpoints, state, timestamp, and status are explicit. A phase record does not assert that every unmeasured pair is open.

The released front end may use switched source/sink paths, passive sensing, or another reviewed method. This contract constrains the observable behavior rather than choosing that circuit:

1. A phase declares every relation it actively observes. It may not infer a relation from an unnamed conductor.
2. At most one declared stimulus owner may drive a logical conductor in a phase. All other connections to it are a reviewed observation path or inactive.
3. A scoring input may be derived only from a named phase result, never directly from voltage polarity, ADC code, comparator level, or an unstated threshold.
4. A reading that cannot be associated with exactly one completed phase is `indeterminate`; an absent or untrusted reading is `unavailable`.
5. A path observed outside the active phase's permitted relations is `crossLine` and therefore a line fault, not an alternate scoring route.

Source amplitude, current limit, source/sense impedance, settling time, sample period, calibration coefficients, and conversion thresholds are open analogue-design inputs. M4-01 through M4-08 must define and measure them before the physical-to-logical converter is released.

## Weapon phase profiles

The profiles define required logical observations. A listed relation need not be a direct wire-to-wire measurement; the released front end must declare how it establishes the relation.

### Foil

| Phase | Perspective | Required observations | Rule-layer input | Basis |
| --- | --- | --- | --- | --- |
| `foil-circuit-integrity` | `acting-side` | Acting-side `A<->B` loop integrity and any declared return relation needed to identify a break | `foilCircuitBreak`: `open`, `closed`, `indeterminate`, or `unavailable` | **FIE requirement:** a break in permanently circulating foil-circuit current registers a hit (FOIL-01). **Product contract:** `A<->B` is the canonical logical loop name. |
| `foil-target-context` | `acting-side` | The acting-side weapon against the opposing target side's declared conductive target/non-target return, plus the relevant piste/ground context | `foilTargetContext`: `target`, `nonTarget`, `grounded`, `indeterminate`, or `unavailable` | **FIE requirement:** valid and non-valid outcomes and guard/piste rejection differ (FOIL-01 through FOIL-03). **Product contract:** target context is never inferred from the break alone or from an unreviewed `A`/`B`/`C` binding. |
| `foil-insulation-diagnostic` | `affected-side` | Affected-side weapon-to-own-conductive-equipment relation when anti-blocking mode is selected | `foilInsulationFault`: `withinRange`, `outsideRange`, `indeterminate`, or `unavailable` | **FIE requirement:** FOIL-04 defines yellow-indication guarantee bands. The 450-475-ohm band remains `indeterminate` under INT-04. |

A circuit break with an untrusted target context is not an on-target or off-target hit. It is `indeterminate` or `unavailable`. A grounded guard/piste path must not be represented as a target path.

### Epee

| Phase | Perspective | Required observations | Rule-layer input | Basis |
| --- | --- | --- | --- | --- |
| `epee-tip-loop` | `affected-side` | Same-side `A<->B` tip-loop continuity | `epeeCircuitComplete`: `open`, `closed`, `indeterminate`, or `unavailable` | **FIE requirement:** contact completing the epee circuit is the scoring condition (EPEE-01). **Product contract:** `A<->B` is the canonical logical tip-loop name. |
| `epee-ground-reference` | `affected-side` | Declared same-side weapon/guard reference relation and its relation to `piste` | `epeeGroundedMaterial`: `grounded`, `notGrounded`, `indeterminate`, or `unavailable` | **FIE requirement:** guard, earthed material, and piste hits must not signal (EPEE-04). **Product contract:** ground is evaluated separately from tip-loop continuity. |
| `epee-line-integrity` | `affected-side` | Each same-side relation needed to establish the preceding two inputs | `epeeLineIntegrity`: `intact`, `crossLine`, `outOfRange`, `indeterminate`, or `unavailable` | **Product contract:** an integrity fault cannot be converted into a hit or grounded-material rejection. |

A closed `epee-tip-loop` with `epeeGroundedMaterial: grounded` is a `groundedMaterialRejection`, not a candidate hit. A closed loop with an indeterminate or unavailable ground reference does not qualify and creates the corresponding diagnostic outcome. Contact duration, the exceptional-resistance envelope, and epee lockout remain M1 decisions; this profile introduces no timing or resistance threshold.

### Sabre

| Phase | Perspective | Required observations | Rule-layer input | Basis |
| --- | --- | --- | --- | --- |
| `sabre-target-contact` | `acting-side` | The acting-side primary weapon-contact relation against the opposing target side's declared conductive target/non-target return | `sabreTargetContact`: `target`, `nonConductiveSurface`, `indeterminate`, or `unavailable` | **FIE requirement:** an uninsulated sabre contacting opposing conductive jacket, glove, or mask is a valid-target context; a non-conductive surface must not signal (SABRE-01). |
| `sabre-own-equipment` | `affected-side` | Affected-side weapon-to-own-conductive-equipment relation | `sabreOwnEquipmentFault`: `present`, `absent`, `indeterminate`, or `unavailable` | **FIE requirement:** own guard/blade contact has yellow diagnostic behavior and does not itself prevent a valid hit (SABRE-01, SABRE-02, SABRE-04). |
| `sabre-blade-contact` | `acting-side` | Acting-side blade/guard against the opposing side's blade/guard relation needed to identify an opponent-blade or guard sequence | `bladeContact`: `present`, `absent`, `indeterminate`, or `unavailable` | **FIE requirement:** whipping-over while blade/guard contact persists must not signal (SABRE-03, SABRE-06). |
| `sabre-bc-control` | `affected-side` | Declared B/C control relation for the affected side | `sabreCircuitBCFault`: `normal`, `controlBreak`, `abnormalChange`, `indeterminate`, or `unavailable` | **FIE requirement:** B/C and control-circuit breaks have white-diagnostic behavior (SABRE-02, SABRE-07). **Product contract:** this names the observation but does not decide persistence or reset. |

FIE names B and C in its sabre fault behavior but does not publish a seven-conductor topology. The released physical map must bind the sabre target-return and B/C relations to the seven conductors without changing these logical input names.

## Deterministic projection to logical inputs

For each side and `atUs`, the acquisition layer uses this order:

1. Select the configured weapon profile. A missing or mixed profile produces `unavailable`.
2. Require all mandatory phases for the proposed input to be `available` and from the same acquisition cycle. A missing phase produces `unavailable`.
3. If a required relation is `crossLine` or `outOfRange`, emit a line-fault observation. Do not produce a scoring boolean.
4. If a required relation, measurement interval, or transition time is `indeterminate`, emit `indeterminate`. Do not produce a scoring boolean.
5. Map only the named phase states in the weapon table. Endpoint policies must already be released by the applicable M1 task.
6. Retain all contributing phase records and intervals as decision evidence.

| Weapon | Input | Source phase |
| --- | --- | --- |
| Foil | `foilCircuitBreak` | `foil-circuit-integrity` |
| Foil | `foilTargetContext` | `foil-target-context` |
| Foil | `foilInsulationFault` | `foil-insulation-diagnostic` when the selected apparatus mode requires it |
| Epee | `epeeCircuitComplete` | `epee-tip-loop` |
| Epee | `epeeGroundedMaterial` | `epee-ground-reference` |
| Epee | `epeeLineIntegrity` | `epee-line-integrity` |
| Sabre | `sabreTargetContact` | `sabre-target-contact` |
| Sabre | `sabreOwnEquipmentFault` | `sabre-own-equipment` |
| Sabre | `bladeContact` | `sabre-blade-contact` |
| Sabre | `sabreCircuitBCFault` | `sabre-bc-control` |

No phase maps directly to a lamp, buzzer, referee score, or winner. The weapon rule layer owns qualification, lockout, and classification; output ownership is M0-04.

## Legal, illegal, and diagnostic states

| State | Condition | Required outcome |
| --- | --- | --- |
| Legal observation | Mandatory phases completed, each relation belongs to the selected phase, and required states agree | Project the named logical input and retain evidence. |
| Legal non-scoring observation | A required relation is confirmed `open`, `notGrounded`, or `nonConductiveSurface` for that phase | Project the non-scoring input. Do not call it a fault. |
| Grounded-material observation | Foil or epee ground-reference phase confirms `grounded` | Produce the weapon's grounded rejection or non-target context; never a hit. |
| Cross-line state | A non-permitted conductor relation is observed in an active phase | `line-fault`; suppress qualification on every affected side until acquisition is trusted. |
| Contradictory state | A relation is both open and closed, grounded and not grounded, or target and non-target in one cycle | `indeterminate` and preserve both observations. |
| Boundary-overlap state | Measurement uncertainty overlaps a released decision boundary | `indeterminate`; do not infer a threshold outcome. |
| Out-of-range state | Measurement is outside the declared calibrated or fixture range | `line-fault` or `unavailable` according to acquisition health policy; never a hit. |
| Incomplete phase set | A phase is missing, stale, for another weapon, or from another cycle | `unavailable`; no candidate starts or continues. |
| Unauthorised excitation | More than one stimulus owner, an undeclared source, or source/sense behavior outside the phase profile | `unavailable` plus acquisition fault; outputs safe inactive. |

An illegal state on one side must not fabricate, erase, or reclassify an independent valid observation on the other. Shared-front-end containment is an M0-04/M4 design decision and must be explicit.

## Safe inactive behavior

`safeInactive` has the glossary meaning: an output state in which its owner cannot assert a hit, diagnostic lamp, or audible signal. It is not an input reading and does not mean a physical conductor is open.

**Product contract:** before the scoring authority passes self-test, with a missing weapon profile, on malformed or illegal acquisition, during calibration uncertainty, or after a power, clock, or processor fault:

- no new candidate, qualified hit, registered hit, lamp event, or audio request is created;
- every active excitation is disabled or held in its reviewed non-scoring inactive condition, with no undeclared stimulus owner;
- outputs controlled by an unavailable owner are `safeInactive`;
- the cause, affected phase, side where known, and raw observations are retained as diagnostic evidence when storage is available; and
- recovery requires a complete legal cycle under the configured profile. Samples acquired while unavailable are never reinterpreted.

**FIE requirement:** signal lamps remain on until reset (GEN-04, OUT-01). Safe inactive prevents a new assertion; it does not give a processor, fault, or ESP32 reset authority to clear a previously latched signal. Supervisor reset and latch ownership remain M0-04/M0-10 decisions.

The electrical inactive level, output polarity, discharge behavior, and maximum residual excitation require M4 measurement and M5 schematic review. This contract intentionally does not design the analogue schematic.

## Existing epee boolean adapter

The current [`epee.ts`](../src/epee.ts) and [`device.ts`](../src/device.ts) model is a two-boolean emulator baseline. It represents only the confirmed subset of this contract:

| Current field | Contract projection | Limitation |
| --- | --- | --- |
| `EpeeContact.isTipClosed` | `true` only for confirmed `epeeCircuitComplete: closed`; `false` only for a confirmed `open` test-vector observation | Cannot represent indeterminate, unavailable, cross-line, resistance, or timing uncertainty. |
| `EpeeContact.isGrounded` | `true` only for confirmed `epeeGroundedMaterial: grounded`; `false` only for confirmed `notGrounded` | Cannot identify the physical guard/piste path or an untrusted reference. |
| `isTipClosed && !isGrounded` | Legacy candidate input after both preceding projections are confirmed | Not a qualified hit, physical circuit definition, or fallback for an unavailable phase. |
| `FrontEndReading.aToBClosed` | Legacy encoding of confirmed same-side `epeeCircuitComplete` | The name matches logical `A<->B` but does not release physical wiring. |
| `FrontEndReading.guardOrPisteGrounded` | Legacy encoding of confirmed `epeeGroundedMaterial` | Combines guard and piste evidence and cannot become the future diagnostic record. |

No code changes are made by this contract. Until M1/M2 replace the adapter, tests must not encode `indeterminate`, `unavailable`, `crossLine`, or `outOfRange` as `false`. That would make a missing measurement resemble a confirmed open or ungrounded observation.

## Physical-map blockers and review gates

| ID | Unresolved physical mapping or decision | Why it blocks finalization | Required closure evidence |
| --- | --- | --- | --- |
| SIG-01 / INT-01 | Bind each logical `A`, `B`, `C`, and `piste` conductor to connector contacts, harness wires, and actual foil/epee/sabre bodywire functions | Without it, a phase cannot be implemented or fixture-tested against a physical apparatus. | Electrical-owner review, keyed harness/pin map, and M4-13 evidence. |
| SIG-02 | Exact excitation and observation path for every phase, including isolation and permissible cross-side measurement | FIE outcomes do not establish source polarity, current path, or source/sense safety. | M4-01 model review and M4-08 measured threshold/timing report. |
| SIG-03 | Physical relation proving epee guard/earthed material versus piste grounding | A closed tip loop must be rejected when grounded, but current booleans do not retain the path. | M4-05 fixture matrix and M4-08 correlation. |
| SIG-04 | Foil target, return, weapon-to-jacket, and piste relation map, including the FOIL-03 exception | A foil break alone cannot classify target or grounded context. | Reviewed phase map and M1-03/M1-04 vectors backed by M4 measurements. |
| SIG-05 | Sabre opposing target-return map and B/C control relation, including white-diagnostic persistence and reset | FIE names B/C behavior but does not publish the topology or persistence implementation. | Software/electrical review, M0-05 schema, M1-05 state diagram, and M4 evidence. |
| SIG-06 | Analogue calibration range, measurement uncertainty, and conversion thresholds | Boundary readings cannot safely project without them. | Calibrated fixture, uncertainty budget, and M4-08 report. |
| SIG-07 / INT-07 | Optional epee orange indication, foil anti-blocking mode, and ordinary audio policy | These change applicable diagnostics, not FIE scoring authority. | Product decision record with M0-04 and output-test plan. |

M0-03 is ready for software and electrical review as a logical contract. It is not ready to release a connector pinout, STM32 allocation, analogue schematic, or physical-to-logical converter until SIG-01 through SIG-06 close.

## Documentation-only acceptance

Reviewers should confirm that:

1. every conductor has one logical meaning without becoming a claimed pinout;
2. every weapon phase yields named observations rather than invented electrical thresholds;
3. every illegal, indeterminate, and unavailable state has a deterministic diagnostic or safe-inactive outcome;
4. the epee boolean baseline is a limited adapter, not the future front-end contract; and
5. all FIE claims trace to the matrix and all product choices remain labelled.
