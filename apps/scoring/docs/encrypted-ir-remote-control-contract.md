# Encrypted IR remote-control contract

**Status:** pre-prototype product requirement; hardware, protocol, and firmware evidence are not complete
**Decision date:** 2026-08-23
**Owners:** product, firmware, electrical, security, manufacturing, and compliance

## Decision and scope

The product includes a handheld infrared referee remote and an apparatus-side IR receiver. Every operational IR
command must be encrypted, authenticated, fresh, attributable to a paired remote, and accepted at most once. There is
no plaintext operational mode, shared production default key, unauthenticated compatibility fallback, or command path
that can create or alter an STM32 scoring decision.

This is a pre-prototype requirement. The active bench PCB may not be released for fabrication until the receiver
architecture, ESP32 interface, optical placement, power/reset behavior, protocol, key-provisioning boundary, and
manufacturing tests have converged. The existing ESP32 allocation has no spare raw GPIO, so the design must explicitly
reallocate a reset-safe input or select a bounded receiver/decoder peripheral. A generic I2C GPIO expander is not
credited with preserving IR pulse timing without measured evidence.

The supplied Skewered Fencing remote photograph and the manufacturer's public manual were reviewed only to identify
the required operator actions. The product must use its own industrial design, labels, command identifiers, encoding,
pairing protocol, cryptographic construction, and implementation. No reference-product artwork, firmware, identifier,
or wire protocol is an implementation input.

Functional reference evidence reviewed on 2026-08-23:

- user-supplied photograph of the handheld control face;
- [Skewered Fencing scoring-box manual](https://skewered-fencing.com/scoring-box-manual), including its interactive
  short/held button descriptions;
- the official local [Favero FA-15 user manual](favero-fa15-user-manual-en.pdf), especially the remote-control
  descriptions on pp. 8-10 and pairing behavior on p. 14; and
- the official [Favero FA-07 user manual](https://www.favero.com/get_file.php?id=160&lang=_en), especially its guarded
  remote mode and tournament-network bout-loading behavior.

These sources establish the requested operation set only. This contract is the project authority when reference-product
behavior changes or conflicts with the project's safety, security, rules, or ownership boundaries.

## Favero-compatible operator model

The remote must be familiar to a referee who routinely operates a Favero FA-15 without copying Favero industrial
design, protocol, artwork, or firmware. Compatibility means that the same operator concept produces the same bout-level
result unless this contract records a deliberate improvement. In particular:

- `Start/Stop`, score changes, manual rearm, load time, one-minute pause, time correction, penalty awards, back/undo,
  weapon selection, fencer swap, and a guarded reset-all/new-bout transition are first-class operations;
- awarding a red penalty also increments the opponent's score in the same accepted transaction;
- priority is assigned from an approved unbiased source for one-minute overtime and is removed by the next priority
  action unless an explicitly labeled supervisor override is used;
- reset cards, reset all/new bout, processor reset, clock reset, undo, and loaded-snapshot restore are different
  transitions;
- destructive actions are guarded, but `Start/Stop` remains direct so a referee can stop the clock immediately; and
- the apparatus exposes the current mode and accepted/rejected result rather than making the operator infer success
  from the remote's transmission LED.

Project improvements retained over the published reference behavior are authenticated encrypted commands, anti-replay,
per-pair credentials, explicit controller authority, event-sourced transitions, bounded direct `M:SS` entry, and an
authoritative loaded-snapshot operation. The Favero manuals reviewed do not document encryption, authentication, or
anti-replay properties for their IR protocol; this contract makes no claim about undocumented internals.

FIE `CLOCK-01` separately describes an encrypted **radio** connection. This project requires encrypted IR regardless,
but must not claim that IR satisfies that wording until the compliance owner obtains and records the applicable FIE or
SEMI interpretation. If it does not, an encrypted radio remote remains an additional release requirement.

## Authority boundary

- The ESP32 application domain owns IR reception, pairing, command authentication, operator controls, and the future
  authoritative bout-workflow service.
- The STM32 remains the sole authority for electrical acquisition, hit qualification, lockout, scoring timestamps,
  primary lamps, and the primary buzzer.
- A remote command is an operator intent. It changes state only after the owning state machine validates the current
  mode, authorization, bounds, and transition.
- Exactly one controller holds write authority for a bout at a time. The paired handheld, local application, and
  tournament controller may all be known, but authority acquisition, transfer, expiry, and forced recovery are explicit
  applied events. A read-only client cannot become a writer merely by sending a valid command.
- A command that requires an STM32 transition, including `bout-reset` or weapon selection, remains a request until the
  STM32 accepts it. The ESP32 cannot infer acceptance from transmission or link delivery.
- Remote failure, IR jamming, ESP32 reset, or application unavailability cannot fabricate a touch, clear a primary
  indication, reset the STM32 automatically, or prevent an otherwise healthy STM32 from scoring.

The match-clock and full bout-state ownership ADR remains a prerequisite for implementation. It must decide how an
accepted referee command, STM32 scoring record, countdown-clock transition, primary output, and replay event are
correlated without treating the STM32 scoring timestamp as a countdown clock.

## Required operator actions

The face-level lookup, command identifiers, guards, and feedback are canonical in the
[remote-control button reference](remote-control-button-reference.md). This section defines the underlying behavior.

`OPT` is a modifier when another control is pressed while it is held. Releasing a modifier chord sends only the
modified command; it must not also emit the unmodified `OPT` command. A standalone `OPT` press shows the current weapon
and a subsequent standalone press within the displayed selection window requests the next approved weapon.

Short, held, double, and modified presses are distinct inputs. Repeated optical frames belonging to one physical press
retain one `commandId` and execute at most once. A held or double action is emitted once after its reviewed threshold;
neither is a stream of short presses. Numeric labels `0` through `9` become digits only while a bounded entry mode is
active.

Required direct actions are:

- left/right score increment and decrement, with decrement floored at zero;
- clock `Start/Stop`, including the coupled passivity-clock transition owned by the bout state machine;
- left/right penalty award, where the first applicable award displays yellow and every applicable red award records the
  card and increments the opponent's score atomically; another card press never removes an issued card;
- a one-minute break;
- positive/negative clock correction while stopped, using one-second ticks normally and hundredth-second ticks while
  the stopped clock is inside the last ten seconds;
- `Back/Undo`, which creates a compensating applied event for the most recent reversible referee workflow action and
  never removes or rewrites history; and
- manual `Rearm`, distinct from clock control, output reset, new bout, and processor reset.

Required modified or guarded actions are:

- `OPT` plus a side card awards the next rules-valid P-card for that side;
- held `Pause` enters one-minute overtime with an unbiased priority assignment; the next held `Pause` removes priority,
  while manual priority assignment is supervisor-only;
- `OPT` plus `Pause` starts the configured medical-intervention clock, with the FA-15-compatible preset of five minutes
  retained until the applicable rules/compliance review approves another value;
- `OPT` plus `Back` atomically swaps every side-owned workflow value, including scores, penalty cards, P-cards, and
  priority, without changing immutable STM32 records;
- `OPT` plus `Rearm` advances through the approved auto-rearm settings, initially manual, one, three, and five seconds;
- `Reset Cards` clears penalty-card and P-card presentation without changing score, clock, match/period, priority, or
  `boutId`;
- `OPT` plus `Reset Cards` requests a guarded `New Bout/Reset All` transition;
- `Load Time` loads the explicitly configured starting duration, double `Load Time` loads one minute, and `OPT` plus
  `Load Time` enters bounded `M:SS` configuration;
- `OPT` plus `+Time` and `OPT` plus `-Time` change the explicitly named match/period field within the selected competition
  format; the data model must not conflate Favero's match counter with a ruleset period; and
- held `Reset Cards` requests sleep only when both clocks are stopped and the declared safe-idle conditions pass.

`New Bout/Reset All` is one atomic supervisor-owned operation. On acceptance it creates a new `boutId`, sets scores to
zero, clears penalty cards, P-cards, priority, breaks, medical state, passivity state, review position, and reversible
workflow history, sets the competition format to its initial match/period, loads the configured starting time, and asks
the STM32 to clear candidates, lockout, and primary indications. It is not complete until the STM32 accepts its owned
transition. A rejection leaves the complete pre-command state unchanged.

Loading a snapshot is a separate authenticated application/tournament-controller operation, not a handheld shortcut.
It must validate the complete snapshot before applying anything and then restore its declared `boutId`, revision,
scores, stopped/running clock state, remaining and configured time, cards, P-cards, match/period, priority, passivity,
weapon, and controller ownership atomically. Missing fields are invalid; they are never rendered as empty timer or score
values and never silently replaced by zero or an assumed three-minute clock.

## Bout workflow and applied events

The implementation must separate three artifacts:

1. `RemoteCommand`: authenticated operator intent received from IR.
2. `BoutStateEvent`: the accepted or rejected application/supervisor transition, with ordered identity and the complete
   resulting authoritative bout state when accepted.
3. `DecisionRecord`: an immutable STM32 scoring or diagnostic result. Remote input never creates one.

The bout snapshot must distinguish absent data from zero and contain at least:

- `boutId`, `boutRevision`, and monotonically increasing `eventRevision`;
- weapon and approved timing/configuration revision;
- left/right score, yellow-card state, red-card counts, and P-card state;
- configured duration, remaining time, clock status, and clock mode (`bout`, `break`, or `overtime`);
- explicitly typed competition match/period value, priority, medical intervention state, passivity state/time,
  auto-rearm setting, and last-scored side when known;
- active controller identity, controller kind, and authority revision; and
- source command identity, applied/rejected disposition, and correlation to an STM32 record when applicable.

Required applied causes include new bout, loaded snapshot, score increment/decrement/clear, clock start/stop/set/adjust,
break start, medical start/stop, overtime start, match/period change, priority assignment/clear, penalty-card award,
P-card award, manual/automatic rearm request result, side swap, reset cards, weapon request result, undo, controller
authority transfer, sleep request result, bout reset result, and command rejection. Rejection reasons must include at
least unauthenticated, stale, replayed, wrong apparatus, wrong controller authority, unsupported command, invalid mode,
clock running, out of bounds, incomplete snapshot, incompatible snapshot revision, entry timeout, owner unavailable,
and STM32 rejection.

Destructive configuration, weapon, new-bout, snapshot-load, clock-reset, and score-clear operations are rejected while
the bout clock is running. Authentication success never overrides state-machine guards. Undo creates a new applied
event restoring a prior reversible snapshot; it never deletes or rewrites history and cannot undo an STM32 decision.

## Encrypted IR protocol requirements

The security design must select a reviewed authenticated-encryption construction and implementation before schematic
release. The protocol must provide:

- a version, product/protocol identity, destination apparatus identity, paired remote identity, key epoch, monotonic
  command counter, unique `commandId`, press kind, bounded command payload, and authentication tag;
- confidentiality and integrity for the operational command and parameters, with all routing/version fields bound as
  authenticated associated data;
- nonce uniqueness across battery replacement, reset, interrupted nonvolatile writes, firmware update, and counter
  exhaustion;
- receiver-side anti-replay state that survives reset and rejects stale, duplicated, reordered-outside-window, wrong-key,
  wrong-apparatus, malformed, and unsupported frames before command dispatch;
- one execution for redundant transmissions of the same `commandId`, plus an explicit timeout after which a new press
  must use a new identifier and counter;
- bounded frame size, decode time, queue depth, rate, and diagnostic output under noise or deliberate flooding;
- cryptographic agility through an explicit suite/version change, never algorithm guessing or silent downgrade.

IR is line-of-sight and can be blocked or jammed. Encryption does not provide availability. Loss or interference must
leave current bout/scoring state unchanged and expose a bounded diagnostic without blocking STM32 scoring.

The minimum design is a one-way optical command link with a persistent logical pairing, not a continuously connected
session. If the selected hardware adds a return channel, its acknowledgement, timeout, retry, and security semantics
require the same review and must not weaken one-way fail-safe behavior.

The remote's indicator may report local transmission and battery state. Without a reviewed return channel it must not
claim that the apparatus accepted a command. The apparatus must provide visible or audible accepted/rejected feedback.

## Pairing, keys, and service

- Pairing is allowed only during an explicit physical/local pairing window on the apparatus and must visibly identify
  the target apparatus.
- Every production remote-to-apparatus relationship uses a unique credential. Development credentials and universal
  factory defaults are prohibited from releasable firmware.
- Pairing, replacement, unpairing, key rotation, lost-remote revocation, apparatus replacement, counter recovery, and
  secure factory reset require documented procedures and auditable results.
- Factory tooling may inject or derive credentials but must not export fleet root keys or place secrets in logs,
  diagnostics, source control, firmware artifacts, or ordinary manufacturer work instructions.
- A failed or partially completed provisioning transaction makes the remote/apparatus pair non-releasable until the
  controlled recovery procedure succeeds.

## Hardware and optical acceptance gates

Before prototype order release, the design must freeze and independently review:

- the exact IR emitter, receiver/demodulator or decoder, optical wavelength/carrier, current driver, filters, supply,
  ESD protection, reset defaults, ESP32 interface, test points, footprints, and population state;
- enclosure/window material assumptions, field of view, pointing tolerance, range, nearby-piste isolation, venue-light
  immunity, display/PWM interference, simultaneous-remotes behavior, and low-battery performance;
- a frontal operating range of at least 20 m under the approved venue-light envelope, a documented pointing-angle and
  adjacent-piste rejection envelope, a remote battery-life target of at least 300 operating hours under the declared
  use profile, and apparatus-side low-remote-battery indication;
- a measured latency and successful-command target suitable for start/stop operation, with numeric thresholds approved
  before component selection receives fabrication credit;
- fail-safe behavior when the receiver is absent, stuck active/inactive, flooded, unpowered, reset, or connected to a
  compromised ESP32;
- current and thermal budgets for worst-case repeated transmission and receiver activity.

The bench prototype must include the selected receiver path or an electrically equivalent, timing-equivalent
population option. A loose development-module hookup is useful exploration but is not prototype acceptance evidence.

## Manufacturer software package

The controlled package delivered for remote/apparatus manufacture must include:

1. Reproducible source and pinned toolchains for the remote firmware and apparatus IR receiver/decoder service.
2. Protocol schema, command vocabulary, state guards, press/hold/repeat timing, and normative golden frames.
3. Cryptographic-suite specification, key-slot and counter-storage layout, pairing/rotation/revocation behavior, and
   a separately controlled provisioning interface that does not disclose production root secrets.
4. Signed release binaries, target/board identities, digests, compatibility manifest, SBOM, licenses, programming
   instructions, and recovery images/procedure.
5. Host tests and hardware tests for every short/held action, entry mode, state guard, duplicate, replay, wrong key,
   wrong apparatus, corruption, counter interruption, low battery, optical noise, flood, reset, and power-loss case.
6. A production fixture protocol that verifies button matrix, LED/battery reporting, IR optical output, receiver range,
   pairing, encrypted command acceptance, duplicate suppression, and unpair/reprovision without logging secrets.
7. Serialized pass/fail evidence binding remote identity, apparatus identity, hardware revisions, firmware release,
   provisioning result, fixture revision, operator/station, and timestamp.

The manufacturer receives only the least privilege required for its approved role. Release signing, fleet-root custody,
and unrestricted service authorization remain separated from ordinary assembly and test access.

## Required verification scenarios

- Every direct, modified, held, and double action from a fresh explicitly configured bout, including proof that a
  modifier chord does not also execute the standalone `OPT` action.
- A loaded mid-bout snapshot with nonzero scores, stopped/running clock states, cards, period, and priority.
- Cold boot, new bout, and loaded snapshot always render valid numeric scores and time; absent or incomplete required
  state is rejected and visibly unavailable rather than rendered as empty values.
- A red penalty award records the card and opponent score in one revision; correction uses undo or reset cards and a
  repeated award never silently removes a card.
- Manual rearm, every auto-rearm setting, side swap, medical pause, random priority, priority removal, Reset Cards, and
  Reset All/New Bout produce distinct applied events and exact post-state snapshots.
- The handheld, local application, and tournament controller contend for write authority; only the active controller
  can mutate state, and authority transfer is atomic and audited.
- Duplicate optical bursts execute once; a later physical press executes once again.
- Wrong apparatus, revoked remote, wrong key epoch, stale counter, corrupt tag, unknown version, and unknown command are
  rejected without state change.
- Clock-running guards reject destructive operations while start/stop and explicitly allowed score/card operations
  remain deterministic.
- Reset Cards, Reset All/New Bout, STM32 rearm/reset, processor reset, clock reset/load, loaded snapshot, and undo remain
  distinct.
- IR loss, continuous noise, ESP32 reset, receiver failure, and link loss never create a touch or clear STM32 outputs.
- Power loss during counter persistence, pairing, applied-event persistence, and firmware update recovers without nonce
  reuse, replay acceptance, duplicated state transition, or an unrecoverable universal-key fallback.

## Delivery work units

| ID | Work unit | Depends on | Acceptance |
| --- | --- | --- | --- |
| `RC-01` | Approve match-clock, bout-state, scoring-rearm, and controller-authority ADR. | M0-04, M0-05, M0-10 | Every command and applied event has one owner; countdown and scoring time remain separate; handheld/app/tournament write authority and rearm/reset boundaries are unambiguous. |
| `RC-02` | Freeze remote-command, complete bout snapshot, controller-authority, and applied-event schemas. | `RC-01` | Versioned schemas and golden fixtures cover every command key in the button lookup, new bout, snapshot load, empty/invalid-state rejection, and authority transfer. |
| `RC-03` | Select encrypted IR protocol, pairing, anti-replay, counter persistence, and key custody. | `RC-01` | Independent security review approves the suite, threat response, provisioning boundary, rotation/revocation, reset recovery, and no-fallback rules. |
| `RC-04` | Select handheld electronics, button matrix, optical path, power system, and apparatus receiver architecture. | `RC-03`, BP-126 | Approved labels and ergonomics, exact parts/interfaces, at least 20 m frontal range target, 300-hour battery target, latency target, reset/fault behavior, and test access are ready for schematic and industrial design. |
| `RC-05` | Implement the pure authoritative bout-workflow reducer and initialization invariants. | `RC-01`, `RC-02` | Fresh bout, new bout, complete snapshot load, incomplete-snapshot rejection, and every transition always produce a complete valid state with no empty score or timer representation. |
| `RC-06` | Implement direct score, Start/Stop, load-time, final-ten-second correction, and one-minute-break commands. | `RC-05` | Symmetric boundary tests cover zero floors, stopped-clock guards, normal/final-ten-second increments, passivity-clock coupling, configured-time absence, and duplicate command IDs. |
| `RC-07` | Implement penalty-card and P-card award semantics. | `RC-05`, approved rules revision | Tests prove yellow/red counts, atomic opponent scoring for red, rules-valid P-card progression, no cycle-to-none behavior, undo, and Reset Cards separation. |
| `RC-08` | Implement overtime, unbiased priority, medical intervention, and competition-format transitions. | `RC-05`, approved rules revision | Seeded priority tests, priority removal, five-minute preset/configuration review, break/medical/overtime clock isolation, and typed match-versus-period bounds pass. |
| `RC-09` | Implement manual/automatic rearm, weapon request, side swap, Reset All/New Bout, and safe-idle sleep. | `RC-01`, `RC-05`, M1-06 | STM32 request/accept/reject correlation passes; side swap is atomic; new bout changes `boutId`; sleep and destructive actions fail closed while unsafe. |
| `RC-10` | Implement compensating-event undo and controller-authority arbitration. | `RC-02`, `RC-05` through `RC-09` | Undo scope is explicit and immutable decisions remain unchanged; handheld/app/tournament contention and transfer tests admit exactly one writer. |
| `RC-11` | Implement the simulator remote surface and command-level conformance suite. | `RC-02`, `RC-06` through `RC-10` | Every lookup row is executable by direct, modified, held, or double input; button-state fixtures prove no phantom standalone `OPT`, repeats, or empty initial displays. |
| `RC-12` | Implement authenticated application/tournament new-bout, snapshot-load, and controller-transfer APIs. | `RC-02`, `RC-05`, `RC-10` | API contract, authorization, idempotency, full-state validation, running-clock policy, recovery, and loaded-running/stopped snapshot tests pass. |
| `RC-13` | Implement and fuzz the apparatus IR receive, decrypt, authenticate, anti-replay, deduplicate, and dispatch service. | `RC-02`, `RC-03`, `RC-05` | Golden frames, malformed inputs, wrong identity/key/version, stale/reordered counters, flood bounds, reset persistence, and dispatch identity tests pass. |
| `RC-14` | Implement reproducible handheld button, modifier, hold/double, encrypted transmit, counter, battery, and LED firmware. | `RC-03`, `RC-04` | Lookup conformance, one-command-per-gesture, signed build, counter power-loss safety, low-battery reporting, and recovery tests pass on target hardware. |
| `RC-15` | Implement pairing, replacement, revocation, counter recovery, secure factory reset, and service tooling. | `RC-03`, `RC-13`, `RC-14` | Per-pair identity, least-privilege flows, interrupted provisioning, lost-remote recovery, and secret-free audit outputs pass a controlled service rehearsal. |
| `RC-16` | Integrate and validate the paired system on the bench PCB and production-intent enclosure path. | `RC-04`, `RC-11` through `RC-15`, BP-506 | Every command/guard plus range, angle, adjacent-piste, venue light, latency, battery, interference/flood, reset, replay, and unavailable-owner case produces accepted evidence. |
| `RC-17` | Implement the production fixture protocol and serialized remote/apparatus conformance record. | `RC-16` | Button matrix, labels, LED/battery, optical output, range sample, pairing, encrypted acceptance, duplicate suppression, unpair/reprovision, and identity binding pass without secret disclosure. |
| `RC-18` | Release the least-privilege manufacturer software package and controlled recovery package. | `RC-17` | Reproducible source/binaries, compatibility manifest, SBOM/licenses, provisioning separation, fixture assets, recovery procedure, and signing/credential custody pass a manufacturer dry run. |

## Exit criteria

This requirement is implementation-ready only when the ownership ADR, command and bout-event schemas, selected
cryptographic suite, receiver architecture, numeric optical/latency targets, ESP32 allocation, pairing/provisioning
procedure, manufacturer package manifest, and test plan are reviewed together. Prototype fabrication remains denied
while any of those inputs is unspecified or conflicts with the active board contract.
