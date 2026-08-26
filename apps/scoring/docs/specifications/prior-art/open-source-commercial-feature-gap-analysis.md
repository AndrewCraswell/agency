# Open-source versus commercial scoring-machine feature gaps

**Snapshot:** 2026-08-25  
**Open-source pins:** three competitive scoring-system implementations plus one architecture benchmark selected from the repositories ranked in the
[GitHub catalog](fencing-scoring-github-catalog.md#most-complete-repositories)  
**Commercial baseline:** [commercial scoring-machine feature catalog](../commercial-scoring-machine-feature-catalog.md)

This analysis asks what the strongest public repositories demonstrate compared with the granular capabilities claimed
for FA-15, FA-07, FULL-ARM-05, Virtual Scoring Machine (VSM), and Skewered. The commercial catalog uses binary
manufacturer-claim coverage; this analysis keeps more granular evidence states because public source can distinguish
implemented, partial, and designed behavior. It is not a conformance verdict. `Not found` means the feature was not
evidenced in the inspected commit, not that it could not exist on another branch or in unreleased hardware.

This revision incorporates the current commercial baseline:

- VSM adds comparison pressure around self-start, fencer-operated scoring, editable timing with a visible non-standard
  state, event replay, team workflow, configurable sounds, real-time line diagnostics, repeaters, and tournament/video
  integration.
- Skewered remains the reference for a live strip-event timeline, touch-centered review, explicit recovery controls,
  and a locally recoverable update path.
- FA-15 is not credited with native RS422-FPA, Cyrano, or finals identity display. Its documented serial ports are for
  Favero master/slave repetition; the reviewed material does not establish an FA-07 protocol-gateway mode.
- FULL-ARM-01, WF1, and wireless weapon acquisition are outside the competitive baseline. Wireless rows below cover
  downstream referee control, state distribution, and repeaters, not wireless hit acquisition.

Every feature ID in the commercial catalog is represented directly below.

## Repositories and shorthand

| Shorthand | Inspected repository | Role |
| --- | --- | --- |
| `OP` | [pietwauters/esp32scoringdeviceMqtt@ed6485efeb](https://github.com/pietwauters/esp32scoringdeviceMqtt/tree/ed6485efeb) | Broadest three-weapon product implementation, paired with separate open hardware |
| `WN` | [wnew/fencing_scoring_box@2b1698f599](https://github.com/wnew/fencing_scoring_box/tree/2b1698f599) | Influential minimal three-weapon Arduino baseline |
| `JB` | [joejensen/fencingbox@b14f231e4a](https://github.com/joejensen/fencingbox/tree/b14f231e4a) | Legacy PCB, PIC firmware, remote, score workflow, and timing editor |
| `SE` | [phillip-toone/sentinel@55f8559b31](https://github.com/phillip-toone/sentinel/tree/55f8559b31) | Architecture benchmark: continuity scanning, physical experiments, host tests, and deterministic-core planning; no production scorer |

`CO` is retained in the broader catalog as sabre-specific algorithm prior art, but it is not a three-weapon product.
`SE` remains in the matrix because its acquisition architecture and verification method are unusually strong, but its
repository explicitly states that production firmware has not been implemented. Blue `SE` entries therefore represent
designed or researched coverage, not product implementation.

Coverage legend:

- ✅ - implemented or directly evidenced in the pin.
- 🟡 - partial, limited, manual-only, or known non-conforming implementation.
- 🔵 - designed, researched, or documented but not implemented as production behavior.
- ❌ - not found in the inspected pin.
- ➖ - outside that repository's intended role.

## 1. Weapon-scoring coverage

| Commercial feature ID or derived requirement | OP | WN | JB | SE | Gap interpretation |
| --- | --- | --- | --- | --- | --- |
| `SC-001` wired foil scoring | ✅ | ✅ | ✅ | 🔵 | Implemented in three scorers; needs common oracle validation |
| `SC-002` wired epee scoring | ✅ | ✅ | ✅ | 🔵 | Broad implementation, but electrical boundaries remain weakly evidenced |
| `SC-003` wired sabre scoring | ✅ | 🟡 | 🟡 | 🔵 | OP is the only competitive peer with meaningful sabre authority; WN lacks whipover and JB's handler is a stub |
| `SC-006` foil 14 +/- 1 ms qualification | ✅ | ✅ | 🟡 | 🔵 | Constants exist; continuous-boundary and jitter evidence is missing |
| `SC-007` foil 300 +/- 25 ms lockout | ✅ | ✅ | ✅ | 🔵 | Constants are common; edge inclusivity and event-order tests are not |
| `SC-008` epee 2-10 ms qualification | ✅ | ✅ | 🟡 | 🔵 | JB defaults to 5 ms; all need threshold sweeps and sampled-signal proofs |
| `SC-009` epee 45 +/- 5 ms double-hit window | ✅ | ✅ | ✅ | 🔵 | Implemented; exact start/stop reference and boundary vectors need proof |
| `SC-010` sabre 0.1-1.0 ms qualification | ✅ | 🟡 | ❌ | 🔵 | WN-family assumptions and sampling need revalidation |
| `SC-011` sabre 170 +/- 10 ms lockout | ✅ | 🟡 | ❌ | 🔵 | WN variants contain both obsolete 120 ms and current 170 ms values |
| `SC-012` sabre whipover rejection | ✅ | ❌ | ❌ | 🔵 | Highest-risk algorithmic gap; CO calls its implementation untested |
| `SC-013` foil valid/off-target distinction | ✅ | ✅ | ✅ | 🔵 | Implemented but not supported by a shared resistance/context suite |
| `SC-014` grounded-piste rejection | 🟡 | 🟡 | 🟡 | 🔵 | Tester supplies useful stimulus ideas; scorers lack published complete boundary evidence |
| `SC-015` own guard/weapon suppression | 🟡 | 🟡 | 🟡 | 🔵 | Same gap: code paths exist, conformance evidence does not |
| `SC-016` open-circuit/disconnected behavior | ✅ | 🟡 | 🟡 | 🔵 | Product behavior and noise suppression vary and are rarely tested |
| `SC-017` automatic rearm | ✅ | ✅ | ✅ | 🔵 | Common feature, but reset/audio/light timing is not normalized |
| `SC-018` manual rearm | ✅ | ❌ | ✅ | 🔵 | Missing from minimalist boxes |
| `SC-019` selectable timing standards | 🟡 | ❌ | ✅ | 🔵 | JB has an editor; no pin demonstrates the guarded standard/custom mode and visible identity found in VSM and Skewered |
| `SC-020` unmistakable non-FIE-mode indication | ❌ | ❌ | ❌ | 🔵 | Important safety/operations gap when timing is editable |
| `TR-001` rapid-hit epee training | ✅ | ❌ | 🟡 | 🔵 | Not consistently treated as a first-class, visibly non-competition mode |
| `TR-002` automatic epee score increment | ✅ | ❌ | ✅ | 🔵 | Only product-oriented implementations include it |
| `TR-003` manual epee score mode | ✅ | ❌ | ✅ | ❌ | Product-oriented implementations retain manual scoring when automatic epee scoring is disabled |
| `TR-006` self-referee start | ❌ | ❌ | ❌ | ❌ | VSM and Skewered both establish this as a useful training/club workflow, but it remains optional and non-normative |
| `TR-007` fencer-operated score donation | ❌ | ❌ | ❌ | ❌ | VSM and Skewered independently document an on-strip acknowledgement gesture; no shortlisted pin does |
| `TR-008` alternate league timing preset | ❌ | ❌ | ❌ | ❌ | No shortlisted pin offers a named, guarded alternate-league preset comparable to Skewered's WFL mode |
| `TR-009` user-defined per-weapon lockout | 🟡 | ❌ | ✅ | ❌ | OP exposes timing configurability and JB has an editor, but neither establishes the visible rules-profile guard expected from VSM/Skewered |

## 2. Bout and referee workflow

| Commercial feature ID | OP | WN | JB | SE | Gap interpretation |
| --- | --- | --- | --- | --- | --- |
| `BT-001` two-sided score display/control | ✅ | ❌ | ✅ | ❌ | Mature in OP/JB; absent in scoring-core examples |
| `BT-002` score increment and decrement | ✅ | ❌ | ✅ | ❌ | OP/JB provide the product workflow; command boundaries and audit behavior remain unspecified |
| `BT-003` clock start/stop | ✅ | ❌ | ✅ | ❌ | Same split between product systems and scoring cores |
| `BT-004` configurable initial bout time | ✅ | ❌ | ✅ | ❌ | OP/JB expose clock setup, but accepted ranges and invalid-input behavior need a product contract |
| `BT-005` one-minute break | 🟡 | ❌ | 🟡 | ❌ | Exact break-state behavior is not well evidenced |
| `BT-006` one-minute extra time | 🟡 | ❌ | 🟡 | ❌ | Needs explicit tie/priority transition tests |
| `BT-007` final-10-second precision display | 🟡 | ❌ | 🟡 | ❌ | No documented display-conformance evidence comparable to the Favero, VSM, and Skewered behavior claims |
| `BT-008` period/match counter | ✅ | ❌ | 🟡 | ❌ | Product workflow gap outside OP |
| `BT-009` random priority assignment | ✅ | ❌ | ✅ | ❌ | Needs deterministic test injection for random assignment |
| `BT-010` manual priority assignment/removal | ✅ | ❌ | ✅ | ❌ | Manual override and clear behavior need explicit state-transition tests |
| `BT-011` yellow-card state | ✅ | ❌ | 🟡 | ❌ | OP is the most complete public reference |
| `BT-012` red-card state with opponent point | ✅ | ❌ | 🟡 | ❌ | Automatic opponent-point behavior and undo semantics need direct tests |
| `BT-013` P-card workflow | 🟡 | ❌ | ❌ | ❌ | Granular simultaneous P-card state and protocol projection need verification |
| `BT-014` passivity elapsed-time indicator | 🟡 | ❌ | ❌ | ❌ | Major modern-bout gap; elapsed-state projection needs one authoritative timer |
| `BT-015` passivity expiry stops clock and blocks touches | 🟡 | ❌ | ❌ | ❌ | Stop, block, acknowledge, and clear transitions need an explicit state machine |
| `BT-016` medical break/intervention | ❌ | ❌ | ❌ | ❌ | Four of five commercial peers advertise a medical/intervention timer or workflow; none is evidenced in the shortlist |
| `BT-017` fencer status | ❌ | ❌ | ❌ | ❌ | Required mainly for competition-manager integration |
| `BT-018` team reserve state | ❌ | ❌ | ❌ | ❌ | FA-07-level competition feature absent from shortlist |
| `BT-019` left/right swap | 🟡 | ❌ | 🟡 | ❌ | Needs whole-state swap semantics, not just display inversion |
| `BT-020` undo | ❌ | ❌ | ❌ | ❌ | FA-15, VSM, and Skewered establish undo as a high-value operator-recovery feature; a complete implementation needs an event journal |
| `BT-021` block destructive controls while clock runs | 🟡 | ❌ | 🟡 | ❌ | Needs one centralized command-authority guard |
| `BT-022` clear/new bout | ✅ | ❌ | ✅ | ❌ | Must be guarded, auditable, and undoable or explicitly irreversible |

## 3. Display, diagnostics, and operator feedback

| Commercial feature ID | OP | WN | JB | SE | Gap interpretation |
| --- | --- | --- | --- | --- | --- |
| `UI-001` red/green valid-hit lights | ✅ | ✅ | ✅ | 🔵 | Common baseline |
| `UI-002` white off-target lights | ✅ | ✅ | ✅ | 🔵 | Common foil baseline, but physical output evidence remains separate |
| `UI-003` ground/fault indicators | 🟡 | 🟡 | 🟡 | 🔵 | Equipment tester has stronger diagnostic depth than most scorers |
| `UI-004` live strip-event timeline | ❌ | ❌ | ❌ | 🔵 | No shortlisted scorer matches Skewered observability |
| `UI-005` freeze timeline on touch | ❌ | ❌ | ❌ | 🔵 | Requires bounded pre-hit event capture |
| `UI-006` scroll/review prior touch | ❌ | ❌ | ❌ | 🔵 | VSM event replay and Skewered touch review make an event journal plus deterministic replay a competitive requirement |
| `UI-007` parry/blade-contact visualization | ❌ | ❌ | ❌ | 🔵 | VSM EIDs and Skewered timelines expose acquisition information that public scorers do not promote into the UI |
| `UI-008` annotate late/whipover/short contacts | ❌ | ❌ | ❌ | 🔵 | VSM and Skewered both expose rejected-contact reasons; this remains a major explainability gap |
| `UI-009` second-touch millisecond delta | ❌ | ❌ | ❌ | 🔵 | VSM and Skewered both retain useful timing detail; public scorers generally discard it after classification |
| `UI-010` display rotation | 🟡 | ❌ | ❌ | ❌ | Mounting-oriented display configuration is rarely treated as a product contract |
| `UI-011` adjustable volume | ✅ | 🟡 | ✅ | ❌ | Common but inconsistently documented/tested |
| `UI-013` distinct event sounds | 🟡 | 🟡 | 🟡 | ❌ | VSM's event-sound map reinforces the need for an audio state contract tied to scoring and reset states |
| `UI-014` local self-test | 🟡 | 🟡 | 🟡 | 🔵 | VSM and Skewered add operator-facing diagnostics, but no shortlisted scorer offers a complete boot/service suite |
| `UI-015` persistent line-fault visualization | 🟡 | 🟡 | 🟡 | 🔵 | VSM real-time A/B/C diagnostics and Skewered timelines strengthen the case for tester-grade diagnostics in the box |
| `UI-016` visible firmware identity | ✅ | 🟡 | ✅ | ❌ | Release identity exists but FIE/non-FIE behavior identity is not consistently guarded |
| `UI-017` remote battery on apparatus | 🟡 | ❌ | ❌ | ❌ | Product-serviceability gap |

## 4. Control, protocols, repeaters, update, and recovery

| Commercial feature ID | OP | WN | JB | SE | Gap interpretation |
| --- | --- | --- | --- | --- | --- |
| `IO-001` handheld referee remote | ✅ | ❌ | ✅ | ❌ | OP/JB demonstrate operator control; security properties are not established |
| `IO-002` remote association/isolation | 🟡 | ❌ | 🟡 | ❌ | No shortlisted scorer demonstrates authenticated, replay-safe control |
| `IO-003` referee remote beyond 20 m | ❌ | ❌ | ❌ | ❌ | FA-15 is the only commercial peer with a documented greater-than-20-metre claim; public pins do not establish range |
| `IO-004` phone/tablet remote | ✅ | ❌ | ❌ | ❌ | OP has companion implementations; authority separation needs verification |
| `IO-005` read-only state broadcast | ✅ | ❌ | ❌ | ❌ | Protocol-rich OP ecosystem is the leading prior art |
| `IO-006` paired wireless control | 🟡 | ❌ | ❌ | ❌ | Security and local operator indication are open gaps |
| `IO-007` multiple simultaneous clients/repeaters | 🟡 | ❌ | ❌ | ❌ | Limits and arbitration are not documented as a product contract |
| `IO-008` wired repeater output | ✅ | 🟡 | 🟡 | ❌ | Physical/electrical and message-level interoperability tests are missing |
| `IO-009` wireless repeater | ✅ | ❌ | ❌ | ❌ | Needs loss/reconnect/fail-safe testing |
| `IO-010` RS422-FPA | ✅ | ❌ | ❌ | ❌ | OP is the only broad public implementation; FA-15's proprietary serial repeater ports do not count as FPA evidence |
| `IO-011` Cyrano | ✅ | ❌ | ❌ | ❌ | Same; exact protocol versions and rejection behavior must be pinned |
| `IO-012` Ethernet/LAN competition manager | 🟡 | ❌ | ❌ | ❌ | FA-07 and VSM establish the commercial workflow; end-to-end tournament operation is not demonstrated in the pin analysis |
| `IO-013` fencer identity on finals display | ✅ | ❌ | ❌ | ❌ | OP has the protocol ecosystem needed for identity projection; receiver/display interoperability remains unproven |
| `IO-014` video replay integration | 🟡 | ❌ | ❌ | ❌ | VSM and Skewered strengthen this requirement; event-to-video synchronization still needs a precise contract |
| `IO-015` scoring independent of wireless | 🟡 | ➖ | ➖ | 🔵 | Must be proven by architecture and fault injection, not assumed |
| `IO-016` wireless subsystem recovery | ❌ | ➖ | ➖ | 🔵 | Explicit restart/recovery behavior is missing |
| `SV-001` field firmware update | 🟡 | ❌ | 🟡 | ❌ | Commercial-grade signing, rollback, and release identity are not evidenced; VSM software download is not a recovery design |
| `SV-002` recovery update path | ❌ | ❌ | 🟡 | ❌ | Skewered remains the strongest recovery reference; this is a major fleet-supportability gap |
| `SV-003` release/change history | 🟡 | ❌ | 🟡 | 🔵 | VSM and Skewered publish release information; public commits are not a customer-facing firmware support policy |
| `SV-004` serial/version display | 🟡 | ❌ | 🟡 | ❌ | Needs immutable build identity and rules-profile identity |
| `SV-005` mains operation | ✅ | ✅ | ✅ | 🔵 | Practical power inputs exist, but product electrical-safety evidence remains separate |
| `SV-006` external battery operation | 🟡 | 🟡 | ✅ | 🔵 | Hardware paths exist, but supported battery types and brownout behavior are unevenly documented |
| `SV-007` documented battery endurance | ❌ | ❌ | ❌ | 🔵 | No competitive implementation publishes a repeatable runtime claim with test conditions |
| `SV-008` low-battery indication | 🟡 | ❌ | ❌ | 🔵 | OP has partial power-state behavior; no shortlist product defines thresholds and remaining-runtime behavior |
| `SV-009` table-top installation | ✅ | ✅ | ✅ | 🔵 | Common physical baseline |
| `SV-010` wall installation | 🟡 | 🟡 | ✅ | 🔵 | JB is the strongest physical-product reference; load, fastener, and cable-clearance evidence is absent |
| `SV-012` transport case | ❌ | ❌ | ✅ | ❌ | JB is the only shortlisted implementation with clear transport-oriented product evidence |
| `SV-013` drop-resistance claim | ❌ | ❌ | ❌ | ❌ | No shortlisted pin provides a test-backed enclosure drop claim comparable to FA-15 |
| `SV-014` isolated weapon circuit | 🟡 | 🟡 | 🟡 | 🔵 | Schematics do not by themselves prove FIE isolation and leakage limits |
| `SV-015` safety, disposal, and service constraints | ❌ | ❌ | ❌ | ❌ | No shortlisted pin provides a complete customer-facing safety and service contract |

## 5. Engineering-evidence comparison

These rows are not commercial features, but they determine whether a feature claim is trustworthy enough to use as a
project requirement or prior-art implementation reference.

| Evidence capability | OP | WN | JB | SE | Required project response |
| --- | --- | --- | --- | --- | --- |
| Inspectable scoring source | ✅ | ✅ | ✅ | ❌ | Keep deterministic scoring authority fully source-controlled |
| Inspectable schematics/PCB | ✅ companion repo | ✅ | ✅ | 🔵 | Pin board revision with firmware and evidence manifest |
| Rule/article traceability | 🟡 | 🟡 | 🟡 | 🔵 | Link every normative decision to FIE article and executable vector |
| Automated weapon behavior tests | ❌ | ❌ | ❌ | 🟡 host scaffolding | Build an oracle-backed foil/epee/sabre scenario suite |
| Resistance-boundary sweep | ❌ | ❌ | ❌ | 🔵 | Convert tester methods into scorer acceptance fixtures |
| Timing-boundary sweep and jitter | ❌ | 🟡 manual | ❌ | ✅ experiments | Automate just-below/at/just-above every threshold |
| Sabre whipover fixture | ❌ | ❌ | ❌ | 🔵 | Build a physical and simulated interruption-pattern suite |
| Ground/guard/common-mode fixture | ❌ | ❌ | ❌ | 🔵 | Cover every grounded-material and cross-coupling case |
| Protocol parser tests | ✅ | ➖ | 🟡 | ➖ | Add malformed, stale, duplicate, and bounded-load cases |
| Power/reset/brownout tests | ❌ | ❌ | ❌ | 🔵 | Prove no false light, score, or stale command across reset |
| Signed update and rollback evidence | ❌ | ❌ | ❌ | ❌ | Treat as a production release gate |
| Reproducible release manifest | ❌ | ❌ | ❌ | ❌ | Bind firmware, hardware, rules, tests, and calibration artifacts |
| Clear reusable license | GPL-3.0 | GPL-3.0 | GPL-3.0 | MIT | Keep license obligations and clean-room boundaries explicit |

## Highest-value gaps to fill

### P0 - scoring integrity and safety

1. Build one executable rules oracle for all three weapons, including exact inclusivity at qualification and lockout
   boundaries, grounded piste/guard behavior, off-target classification, and reset/rearm transitions.
2. Add a sabre whipover fixture and interruption-pattern suite. Public implementations are either missing it or label
   it untested.
3. Couple every scoring release to measured resistance, timing, common-mode, noise, and brownout evidence. No shortlisted
   scorer supplies this complete chain.
4. Keep remote, network, display, and repeater code unable to create or reclassify weapon events.

### P1 - competition workflow and interoperability

1. Implement passivity and P-card state as explicit transitions, including clock stop/block/clear behavior and protocol
   projection.
2. Complete referee workflow: clock, periods, breaks, extra time, priority, cards, medical intervention, left/right swap,
   VSM-style team progression, guarded new bout, and an event-backed undo model.
3. Validate RS422-FPA and Cyrano against current apparatus, Fencing Time, and display receivers. Parsing a packet is not
   interoperability evidence.
4. Provide deterministic multi-client authority: read-only observers, one clearly indicated controller, bounded pairing,
   replay protection, and scoring continuity during radio failure.

### P2 - observability, recovery, and product quality

1. Preserve a bounded pre-hit event journal and support both a Skewered-like live timeline and VSM-like deterministic
   event replay, with parry, fault, short, late, whipover, lockout, and second-touch delta annotations.
2. Integrate tester-grade line, resistance, and micro-break diagnostics without allowing diagnostic modes to contaminate
   competition scoring.
3. Add visible rules-profile/build identity, conspicuous non-FIE-mode indication, signed A/B firmware update, rollback,
   and a local recovery path.
4. Specify configurable event sounds, display rotation, mounting, battery state, low-voltage behavior, and repeater
   loss/recovery as tested product contracts rather than incidental UI behavior.

## Recommended prior-art use

- Start from `OP` for end-to-end product breadth and protocol decomposition, not as a conformance oracle.
- Use `WN` to understand the influential minimal circuit/firmware lineage and the risks inherited by its derivatives.
- Use `JB` for physical-product, remote, score, clock, and field timing-editor architecture; do not reuse its sabre stub.
- Use `SE` as the architecture and evidence-method benchmark for deterministic scanning, physical experiments, and
  host-side verification, while preserving the distinction that it is not production firmware.

Equipment testers remain useful fixture prior art in the broader
[GitHub catalog](fencing-scoring-github-catalog.md), but are intentionally excluded from these competitive scoring-box
coverage tables.

Use the supplemental `CO` catalog entry for sabre excitation and interruption ideas. Its findings should become
negative tests and algorithm inputs, not full-product coverage scores.

The project should combine those strengths behind its own FIE-derived specification and evidence suite. Repository
popularity, completeness, or a published timing constant is prior art, not proof of compliant machine behavior.
