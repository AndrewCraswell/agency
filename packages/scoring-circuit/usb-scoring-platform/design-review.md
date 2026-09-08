# Prototype design review

Started 8 September 2026. Review the current native KiCad board and the `output/isolation-extension-review/` assembly
export, not the earlier ESP32 prototype. This is a findings table, not a fabrication approval or a new implementation
backlog. Submission and payment remain paused. No circuit changes are authorized merely by a suggestion appearing here.

## Priority and evidence

- **P0:** demonstrated safety or fundamental-function defect; stop release and resolve immediately.
- **P1:** resolve before fabrication, including a significant uncertainty requiring design or assembler evidence.
- **P2:** worthwhile improvement or handoff correction; evaluate before ordering without automatically redesigning.
- **P3:** optional future improvement; not a prototype release blocker.

Priority is urgency, not confidence. Distinguish confirmed defects, open questions, proposals and required bench tests.
Bench tests requiring this prototype do not block ordering it, but do block claims of measured performance or safety. No
confirmed P0 finding has been established in this initial pass; that is not an all-clear.

## Findings and opportunities

**C56 sourcing correction:** selected TDK `C1608X5R1C475K080AC` (JLCPCB `C2167106`) in place of `C1608X5R1A475K080AC`.
TDK reports the replacement in production; DigiKey lists both the old part and the previously proposed Murata
`GRM188R61A475KE15D` as obsolete. The replacement retains 4.7uF, +/-10%, X5R and the same 1.60 +/-0.10 by 0.80 +/-0.10
by 0.80 +/-0.10mm body, with a higher 16V rating. Both TDK characteristic sheets were visually compared: the
replacement's typical low-voltage DC-bias retention is comparable or better; the higher voltage rating alone was not
used as proof. The curves are reference data, not guaranteed minima. C56 remains the W5500 TOCAP reference capacitor; no
capacitance value, footprint, placement or routing changes. This closes the local replacement selection, not supplier
stock/quantity confirmation or measured TOCAP behavior. Fresh `output/tocap-capacitor-review/` export has zero ERC, DRC,
unconnected and parity issues, 230 matching BOM/placement references, and the exact replacement on C56. Only the MPN
field changes in each native schematic/PCB file. No JLCPCB draft or cart was changed. `pnpm verify` completed checks and
electrical simulations, then failed the existing scoring TypeScript 100% coverage gate (95.98% lines, 99.79% functions,
95.34% statements, 93.62% branches); no threshold was lowered.
[TDK current part](https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C1608X5R1C475K080AC),
[replacement curves](https://product.tdk.com/system/files/dam/doc/product/capacitor/ceramic/mlcc/charasheet/c1608x5r1c475k080ac.pdf),
[original curves](https://product.tdk.com/info/en/documents/chara_sheet/C1608X5R1A475K080AC.pdf),
[JLCPCB identity](https://jlcpcb.com/partdetail/TDK-C1608X5R1C475K080AC/C2167106).

**C64/C65 substitution:** root review selected Yageo `CC0603JRNPO9BN180` for both W5500 crystal-load capacitors. The
exact manufacturer sheet was visually checked: 18pF, C0G, +/-5%, 50V; body 1.6 +/-0.1 by 0.8 +/-0.1mm, height 0.8
+/-0.1mm, MSL1. It fits the unchanged 0603 lands and preserves the load-capacitance choice; this is not an oscillator
startup measurement. Schematic and PCB ordering fields now agree. JLCPCB lists the exact identity as `C107040`;
stock/prices must be refreshed at ordering. This supersedes the earlier C64/C65 candidate-only procurement note; C56 is
now covered above and header substitutions remain open. No JLCPCB draft or cart was changed. Verification:
`output/crystal-capacitor-review/` has zero ERC, DRC, unconnected and parity issues, 230 matching BOM/placement
references and both Yageo ordering rows. The PCB diff changes only four ordering fields; geometry, nets and routing are
unchanged. Fresh U21 HEX SHA256 is `80349F8D523EF5FF46FE6D8545EC02A0561F4723863381F4E8CC91668D38B132`.
[Yageo exact-part sheet](https://www.yageogroup.com/download/specsheet/CC0603JRNPO9BN180),
[JLCPCB catalog identity](https://jlcpcb.com/partdetail/YAGEO-CC0603JRNPO9BN180/C107040).

| Priority | Item / kind                                                                            | Evidence and latest state                                                                                                                                                                                                                                                   | Impact / estimated cost                                                                                                                           | Next action and required verification                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | U18/U19/U21 whole-input suspend budget — margin not established                        | [Power guide](usb-acquisition-power.md#input-side-review) retains a conservative 4mA VLO allowance. U21 shallow sleep is implemented, but total input power and the calculation requiring 96.3% efficiency remain unvalidated.                                              | Potential unsupported laptop/source combinations. No measured saving from firmware yet.                                                           | Complete enabled-load and regulator analysis; measure whole-input current and tick/alert/watchdog behavior. Do not assume firmware sleep closes the budget.                                                     |
| P1       | U21 initial programming and U5 configuration — image handoff implemented; service open | Fresh controller-sleep-review export: 230 refs, zero ERC/DRC/parity/unconnected issues; ARM image 2476 text bytes / 60 BSS. Controller suites 2/2 and C/C++ coverage gate passed. J14 geometry checked.                                                                     | A fully soldered board still needs programming. Fixture/service charge unknown.                                                                   | Obtain assembler confirmation for pogo programming, stable VLO, HEX readback and U5 defaults. No service purchased or board flashed.                                                                            |
| P1       | U18 LTM2884 assembly profile — assembler confirmation                                  | Existing supplier handoff records MSL4 and 245 C maximum peak; supplier engineering acceptance remains absent. Exact export uses LTM2884IY#PBF.                                                                                                                             | Risk of assembly damage or rejected assembly. No justified replacement or cost saving yet.                                                        | Recheck exact package handling documentation and obtain assembler process acceptance. LLM review cannot certify their oven profile or moisture handling.                                                        |
| P1       | Isolation and unpowered paths — all-layer geometry checked; requirement unresolved     | Removed unused secondary-ground pour extension on In1.Cu/B.Cu that left 0.5mm to USB_GND. Current approximate same-layer minima: F.Cu 2.65mm, In1.Cu 2.60mm, In2.Cu 2.60mm, B.Cu 2.50mm. U18 keepout remains clear on all four layers.                                      | Removes avoidable narrow spacing with no components or tracks moved. These distances are not an isolation rating.                                 | Establish working-voltage, clearance/creepage and external-interface safety basis; physical and cross-layer insulation remain separate checks.                                                                  |
| P1       | Supplier substitutions across the entire BOM — open review                             | Prior matching session found X5R proposed for specified X7R; current canonical export retains selected MPNs. Supplier matches are not approved design substitutions.                                                                                                        | Capacitance, bias, temperature or footprint mismatch. Savings not yet established.                                                                | Review exact alternate datasheets and each circuit role, including effective capacitance and package dimensions. Approve explicit substitutions only, then reconcile BOM, schematic and supplier selection.     |
| P2       | Power guide scan timing — corrected                                                    | Guide now describes 40us slots / 120us frames, checked against the decoder and acquisition tests. Physical timing remains a bench check.                                                                                                                                    | Misleading firmware handoff; no component cost.                                                                                                   | Correction implemented in this review slice; no timing or resistor changes.                                                                                                                                     |
| P2       | Prototype order color conflicts with README — resolved                                 | Consolidated handoff specifies standard green mask and white silkscreen, independent of black 3D rendering.                                                                                                                                                                 | Removes conflicting order instructions; no circuit change.                                                                                        | Verify green in the final supplier order; no order submitted.                                                                                                                                                   |
| P2       | Stocked same-footprint headers and capacitor alternatives — proposal                   | C64/C65 changed to reviewed Yageo CC0603JRNPO9BN180; ERC/DRC/parity/unconnected all zero; fresh 230-part export matches. C56 now selects production TDK C1608X5R1C475K080AC; native ERC/DRC/parity/unconnected checks pass. J2/J6 remain open. JLCPCB draft is unchanged.   | May reduce minimum-order waste and delay without adding components. Savings unpriced until equivalent parts and assembly quantities are verified. | Reconcile C107040 in the supplier draft before ordering. Confirm C56 supplier quantity; continue J2/J6 reviews.                                                                                                 |
| P2       | U21 idle CPU power — shallow sleep implemented                                         | Qualified, alert-free target now sleeps until nominal 1ms SysTick. Unknown supplies, transactions and error paths remain awake. Native policy/transport tests pass; ARM vector and WFI instructions inspected. The P1 total suspend budget remains open.                    | No BOM increase; reduces idle CPU activity without new USB-state detection. No measured current saving claimed.                                   | Measure tick/wake and PA6 alert response, watchdog recovery and whole-input current. Preserve the conservative 4mA allowance until measured.                                                                    |
| P3       | Broader power-module consolidation — unassessed opportunity                            | Current decision intentionally retains LTM2884 and REC30K to avoid a discrete isolation redesign. No equivalent simpler replacement has been established.                                                                                                                   | Potential BOM savings versus isolation, layout, sourcing and revalidation cost; estimate pending evidence.                                        | Critic may propose exact alternatives with a complete replacement BOM and preserved functionality. Do not reopen the settled topology solely because individual module prices look high.                        |
| P1       | Physical footprints and assembly orientation — partial geometry pass                   | Fresh check: all 223 fitted components have top courtyards and none overlap. J14 alone has none. U18 has 44 circular 0.63mm lands. Full manufacturer footprint overlays and cable-envelope checks remain incomplete.                                                        | Gross 2D placement concern reduced; no proof of exact mechanical fit. Cost unknown.                                                               | Complete exact connector/package drawing comparisons, pin 1 and cable entry checks. Missing models do not imply missing BOM parts.                                                                              |
| P1       | U19 primary regulator — migration implemented, margins still open                      | LTC3130-1 fixed 5V automatic Burst/PWM replaces the Burst-only circuit. Seven support parts removed. Native ERC/DRC/parity pass; both nominal manufacturer-model load steps pass.                                                                                           | Removes the operating-mode mismatch and external compensation; no complete price saving claimed.                                                  | Finish whole-input suspend and physical startup/thermal verification; reconcile assembly quote for the exact new parts.                                                                                         |
| P1       | J3/J4/J5 external harness assembly — handoff gap                                       | These are internal Samtec headers, not the fencer banana sockets or piste socket.                                                                                                                                                                                           | A soldered PCB alone is not a finished cable-ready scoring box. Harness/socket quote is separate and unknown.                                     | Include mating sockets, harness pinout and assembly responsibility in the order if the delivered unit must need no soldering. Existing owner-validated weapon cable is not being reopened.                      |
| P2       | USB_GND copper island — resolved in saved native board                                 | Refilled and saved the canonical PCB. Reloaded board preserves all 231 footprint placements/pad nets and 3823 track/via identities and endpoints. Saved-board DRC without automatic refill now reports zero violations, unconnected items and parity errors; ERC also zero. | Stale floating copper corrected; no component or routing change and zero BOM cost.                                                                | Re-export manufacturing files after remaining circuit fixes; older ZIPs are not updated by this saved-board correction.                                                                                         |
| P2       | Raw VBUS capacitance accounting — updated                                              | C1/C36/C39/C40/C50 now total 1+1+4.7+1+0.1 = 7.8uF nominal; 8.58uF at +10%, before IC/parasitic capacitance.                                                                                                                                                                | Correct input budget after the VIN bypass change.                                                                                                 | Include effective capacitance, IC input capacitance and startup behavior before a USB compliance claim.                                                                                                         |
| P2       | Y1/Y2 and crystal loads — selection calculation passed; tuning open                    | Y1 nominal-load gmcrit is 1.263mA/V versus 1.5mA/V limit. Its 27pF capacitors assume 4.5pF effective stray. Y2's 18pF capacitors match WIZnet reference. Calculation below; not a measured frequency result.                                                                | Startup/frequency margin; likely small passive cost if tuning needed, unpriced.                                                                   | Nominal selection calculation complete; verify effective load and drive level. Measure frequency/startup on prototype; do not change values from this simple series calculation alone.                          |
| P2       | Current versus historical README component descriptions — resolved                     | Replaced obsolete build snapshots with the current 223-part assembly handoff; retained sensing requirements and low-volume scope. Export now includes handoff, review and power documents.                                                                                  | Removes obsolete component counts, control wiring and capacitor candidates from procurement guidance.                                             | Native export verified with matching parts and fresh U21 image; supplier draft still needs replacement.                                                                                                         |
| P2       | Favero output loading — bench verification required                                    | U16/U17, R38–R43 and D10/D11 provide mirrored optodarlington outputs. Netlist proves neither receiver threshold nor release time with actual cable/load.                                                                                                                    | Repeater interoperability. No change or saving established.                                                                                       | Test both ports with actual FA-05-compatible repeaters; measure current, polarity, rise/release times and simultaneous operation. Prototype-dependent test, not a demand for hardware before ordering hardware. |
| P3       | R74–R86 resistor-array consolidation — optional proposal                               | Thirteen separate 10k input default resistors perform useful functions. Matched arrays could reduce placements but need new footprints/routing.                                                                                                                             | Potential small placement saving; quote unavailable, engineering cost may dominate at 3–10 boards/month.                                          | Keep discretes for this prototype unless assembler supplies a compelling total-cost comparison. Do not delete reset defaults for part-count reduction.                                                          |
| P2       | Missing bodies in fresh 3D render — confirmed model limitations                        | U18 and U20 have no assigned model. J13 references an unavailable installed-library body. J14 is deliberately bare pads.                                                                                                                                                    | Limits visual seating/orientation review, not proof of missing electrical components. No BOM increase.                                            | Use exact manufacturer envelopes/drawings for checks; restore authentic models when available. Do not invent shapes as proof.                                                                                   |

## Review coverage and critic protocol

### RECOM module mechanical review

Visually compared RECOM Rev. 1-2025 page 12 with the saved native U6 fabrication plot. At centre (86,65)mm, rotation
zero, the six pads match the recommended component-side pattern: left pins 3/2/1 top-to-bottom and right pins 4/5/6. Row
separation is 20.32mm. Native connections are 1 PD_ISO_INPUT, 2 USB_GND, 3 CTRL unused, 4 GND, 5 TRIM unused, 6
PANEL_5V. The drawing's separate underside view must not be copied without mirroring.

All six native drills are 1.4mm with 2.4mm lands. RECOM specifies 1.4mm holes with +0.15/-0mm tolerance for 1.0+/-0.1mm
pins: obtain finished-hole process confirmation, not merely a nominal drill match. The 25.4mm square fabrication outline
matches the nominal body; the 26.4mm courtyard exceeds the drawing's 26mm minimum envelope. Allow 11.0mm maximum body
height (10.2 +0.8/-0.2), plus actual seating clearance. No copper, footprint or model was changed.

[Manufacturer drawing](<https://recom-power.com/pdf/Econoline/REC30K(-Z).pdf>),
[native footprint view](output/recom-native-fab.png). This closes U6's drawing comparison, not assembly fit, thermal
performance or whole-board isolation acceptance.

### Current assembly handoff

The consolidated README replaces superseded build snapshots and records factory U21 programming, through-hole assembly,
U18 process handling and external harness responsibilities without claiming supplier acceptance. A fresh export at
`output/manufacturing-20260908-080109/` passed native ERC/DRC/parity with zero unconnected items and 223 matching
BOM/placement references. It includes the handoff documents and freshly built U21 HEX. Existing supplier uploads remain
stale and unsubmitted. The export changes no PCB or schematic geometry. Full repository verification was attempted:
eight electrical models passed, but unrelated legislation lint/type-check work stopped the check stage; this run did not
reach test coverage.

### Controller idle-power implementation

U21 now requests shallow Sleep only after a qualified supply check with ALERT_N high. SysTick interrupts every nominal
1ms; the handler only returns, leaving the existing COUNTFLAG-based 10ms health policy intact. Pending transactions,
unqualified supplies and communication failures do not sleep. The main loop alone feeds the watchdog. PA6 remains a
polled input, so a new alert may wait one tick plus wake/processing time; there is no claim of immediate interrupt
response. LTM2884 automatic USB suspend and the hardware power gates are unchanged.

Native policy and register/transport suites passed (2/2), including health cadence, alert bypass, fault/detach and
NACK/busy/timeout recovery. Cross-build is 2476 text bytes, 60 BSS: vector 15 is `0x080000fd`, pointing to the Thumb
`SysTick_Handler` at `0x080000fc`; disassembly shows conditional DSB/WFI/ISB and the unchanged fault loop. This verifies
generated instructions, not execution or current consumption on hardware. Do not subtract a guessed sleep saving from
the conservative 4mA VLO allowance or close the overall suspend-power finding. The C/C++ coverage gate passed: power
policy and target both have 100% lines/functions, with 95.05% and 92.59% branches respectively; the scoring
decision/filter/decode core retains 100% for all metrics. Fresh `output/controller-sleep-review/` contains 230 assembly
references and zero ERC/DRC/parity/unconnected findings. Its U21 HEX SHA256 is
`80349F8D523EF5FF46FE6D8545EC02A0561F4723863381F4E8CC91668D38B132`. This export has not been uploaded or approved for
manufacturing.

### Application eFuse footprint and stencil check

U20 TPS259470LRPWR was checked against TI SLVSFC9C, pin table pages 5–6 and RPW0010A package drawings at PDF pages
72–74. The 2x2mm body (1mm maximum height), ten electrical pad identities, L-shaped corner lands and 0.30x2.40mm
input/output copper strips agree with the drawing. AUXOFF, FLT and ITIMER remain intentionally unconnected; these are
not missing assembly connections. The missing 3D body remains a visualization limitation.

The former continuous reduced paste strips approximated the suggested area but not TI's split stencil pattern. Both the
local footprint and saved U20 now use four paste-only, rounded 0.28x1.06mm windows at x=+/-0.25mm, y=+/-0.63mm, radius
0.05mm, giving a 0.20mm center gap on each power pad. Copper, nets, placement and BOM are unchanged. Native KiCad
F.Paste PDF was rendered and visually checked; DRC reports zero violations, unconnected items and schematic mismatches.
This is a stencil improvement, not evidence of an observed soldering failure. TI's example assumes a 0.10mm stencil;
final stencil thickness/process acceptance remains with the assembler.
[TI TPS25947 datasheet and stencil drawing](https://www.ti.com/lit/ds/symlink/tps25947.pdf).

### Ethernet jack mechanical check

J13 was compared with the Cetus J1B1211CCD drawing, pages 2–3, visually rendered from the
[WIZnet-hosted manufacturer PDF](https://docs.wiznet.io/img/products/wiz550web/wiz550webds_kr/j1b1211ccd.pdf). The
native footprint agrees with the top-view mounting pattern: eight 0.90mm signal drills on staggered 2.54mm rows/1.27mm
columns; two 3.25mm mounting holes 11.43mm apart, 6.35mm forward of pin 1; two 1.60mm shield drills 15.75mm apart; and
four 1.02mm LED drills with the specified 7.57/12.65mm spans and 3.38/5.08mm offsets from the mounting-hole line. This
is an exact-part drawing comparison, not a generic RJ45 equivalence claim.

At the saved position (148.5,134)mm, zero rotation, the 16x21.30mm body faces the bottom edge: its mouth is at y151.10mm
versus the nominal y150mm board edge, an intentional 1.10mm overhang. Mounting holes stay on the board. No footprint
movement is indicated. Connector-to-enclosure opening and cable-boot clearance still need the enclosure dimensions;
board courtyard checks cannot establish those. Electrical pad roles 1/3 TX, 4/6 RX, 2/5 center taps, 7 NC and 8
shield-reference agree with the drawing; this does not validate PHY tuning or cable performance.

The referenced `RJ45_Cetus_J1B1211CCD.step` is absent from both the installed library and the current official KiCad
Connector_RJ model directory. This is not just a local installation omission. No authentic replacement model was
obtained, and no generic body was substituted. The mechanical footprint check above is complete; 3D model restoration
and enclosure fit remain separate open items. No board geometry or BOM changed in this review.

The electrical-role inventory below covers **all 223 currently populated references**, including each repeated resistor
and capacitor, plus separate consideration of bare programming pads J14. The refreshed native schematic/PCB parity check
passes and all 223 BOM/placement references match. This checks connectivity consistency, not correctness of manufacturer
pin numbering or physical footprint dimensions.

Fresh KiCad 10.0.6 ERC found **zero violations**. DRC on saved fill found **one isolated-copper warning**. Repeating
with `--refill-zones --schematic-parity` found **zero violations, zero unconnected items and zero parity issues**.
Refill was in memory only; the saved board was not changed. Reports are in ignored `output/component-review-erc.json`,
`output/component-review-drc.json` and `output/component-review-refilled-drc.json`; the fresh source netlist is
`output/component-review.net.xml`.

This completes the reference-by-reference **role and connectivity pass**, not the complete physical/electrical release
review. Exact footprint drawing overlays, populated-board mechanical inspection, quantitative isolation clearances,
effective MLCC capacitance, converter stability, supplier substitutions and the open questions below are not all closed.
No new component is approved for fabrication by the word **retain**: it means its function is useful and no removal is
justified by this pass. No blanket recommendation to remove unused MCU pins, bypass capacitors, reset pulls or recovery
headers is supported. Historical simulation passes remain distinct from fresh results.

For an LLM critic, supply native circuit evidence and manufacturer requirements, not just this narrative. Require exact
references/nets, source locations, failure mechanism, confidence, priority, benefit, cost delta (or explicitly unknown),
tradeoffs, effort and revalidation for each finding. Challenge findings for false positives before accepting them. Root
adjudicates against source evidence; no model vote is an engineering approval. No separate critic run has occurred in
this review. Keep confirmed defects, improvements and post-assembly measurements distinct; no prose validators.

## Suspected defects rejected or narrowed

- **W5500 missing CS/reset pull-ups:** not established. WIZnet specifies internal pull-ups on SCSn and RSTn. Firmware
  must still provide the specified reset pulse and startup delay. INTn is an output, not automatically an unconnected
  open-drain problem.
  [W5500 datasheet, pin descriptions and reset timing](https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf).
- **U21 PA11 remap error:** rejected for current default mapping. TSSOP20 pad 16 defaults to PA11; PA9 is the remapped
  alternative. The target writes PA11.
  [STM32C011 datasheet, table 12](https://www.st.com/resource/en/datasheet/stm32c011f6.pdf).
- **U18 VLO/bootstrap concern:** the part provides regulated VLO for ON/SPNDPWR and up to 10mA external load; ON
  disables the isolated converter. This does not by itself prove a controller bootstrap deadlock. Check blank-controller
  startup and total VLO consumption instead.
  [LTM2884 pin descriptions](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf).
- **U20 open ITIMER/unused outputs:** an open ITIMER selects fastest response; unused FLT/AUXOFF outputs are not missing
  power connections. Fault telemetry is an optional tradeoff, not proof of defective protection.
  [TPS25947 pin descriptions](https://www.ti.com/lit/ds/symlink/tps25947.pdf).
- **Extra pad count on U2/U5/U19/U20:** repeated-number thermal pads are intentional. Compare electrical pad identities,
  not the raw count of copper/paste primitives.
- **Unused U8/U15 channels:** their inputs and enables have defined states; unused outputs are intentionally NC.

## Every populated reference

Source: current native schematic netlist, board pad nets and the 223-row manufacturing BOM. Exact MPNs are retained here
to prevent a nominal-value substitution from being mistaken for the reviewed part. Each row records electrical purpose
and present disposition. Shared open checks in the findings table apply to all affected rows. This is an inventory of
review results and limitations, **not passing laboratory tests or verified mechanical models**.

J14 is deliberately absent from the populated BOM: it is the primary-domain SWD pad set for U21 (VLO, USB_GND, SWDIO,
SWCLK, NRST). Retain probe access; it must not be mistaken for another domain's grounded programming connector.

| Reference | Exact MPN             | Circuit role evaluated                                                           | Disposition / remaining verification                                                                                                                                  |
| --------- | --------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BZ1       | PS1240P02BT           | Piezo sound output across CORE_3V3 and Q2 drain; R87 discharges the piezo.       | Retain; verify audible output and drive waveform on assembled board.                                                                                                  |
| C1        | C1608X7R1H105K080AB   | Raw USB VBUS bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C2        | C1608X7R1H105K080AB   | AP2112 input bypass on CORE_5V                                                   | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C3        | C1608X7R1H105K080AB   | AP2112 output bypass on CORE_3V3                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C4        | C1608X7R1H104K080AA   | AP63203 bootstrap capacitor, BST to SW                                           | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C5        | C1608X5R1C106M080AB   | AP63203 PANEL_5V input reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C6        | GRM32ER71E226KE15L    | APP_3V3 output reservoir, parallel with C7                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C7        | GRM32ER71E226KE15L    | APP_3V3 output reservoir, parallel with C6                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C8        | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C9        | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C10       | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C11       | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C12       | C1608X7R1H103K080AA   | STM32 analog supply high-frequency bypass                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C13       | C1608X7R1H104K080AA   | STM32 analog supply bypass                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C14       | C1608X7S1A475K080AC   | STM32 analog supply reservoir                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C15       | C1608X7R1H105K080AB   | STM32 CORE_3V3 reservoir                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C16       | C1608X7R1H104K080AA   | STM32 reset filtering                                                            | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C17       | CGA3E2C0G1H270J080AA  | 8MHz HSE input load                                                              | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                             |
| C18       | CGA3E2C0G1H270J080AA  | 8MHz HSE output load                                                             | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                             |
| C19       | C1608X7R1H104K080AA   | U8 conductor-buffer bypass                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C20       | C1608X7R1H104K080AA   | U9 conductor-buffer bypass                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C21       | C1608X7R1H105K080AB   | ESP32 EN startup delay                                                           | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C22       | C1608X5R1C106M080AB   | ESP32 APP_3V3 reservoir                                                          | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C23       | C1608X7R1H104K080AA   | ESP32 APP_3V3 bypass                                                             | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C24       | C1608X7R1H104K080AA   | U10 CORE-side bypass                                                             | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C25       | C1608X7R1H104K080AA   | U10 APP-side bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C26       | C1608X7R1H104K080AA   | U11 CORE-side bypass                                                             | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C27       | C1608X7R1H104K080AA   | U11 APP-side bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C28       | C1608X5R1C106M080AB   | Ethernet APP_3V3 reservoir                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C29       | C1608X7R1H104K080AA   | Ethernet digital supply bypass                                                   | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C30       | C1608X7R1H104K080AA   | IR receiver filtered supply bypass                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C31       | C1608X7R1H104K080AA   | U14 PANEL_5V bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C32       | C1608X7R1H104K080AA   | U15 PANEL_5V bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C33       | C1608X7R1H105K080AB   | STM32 reference/analog reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C34       | C1608X7R1H104K080AA   | STM32 reference/analog bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C35       | C1608X7R1H104K080AA   | Sounder CORE_3V3 bypass                                                          | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C36       | C2012X7R1H105K125AB   | STUSB4500 raw VBUS bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C37       | C1608X7R1H105K080AB   | STUSB4500 VREG1V2 bypass                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C38       | C1608X7R1H105K080AB   | STUSB4500 VREG2V7 bypass                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C39       | C4532X7R1H475K200KB   | LTC3130 raw VBUS input reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C40       | C2012X7R1H105K125AB   | LTC3130 raw VBUS 1uF VIN bypass                                                  | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C41       | C2012X5R1C475K125AC   | LTC3130 VCC bypass                                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C42       | C1608X7R1H223K080AA   | LTC3130 22nF BST1-to-SW1 bootstrap                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C43       | C4532X5R1A476M280KA   | LTC3130 USB_PRIMARY_5V reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C45       | C1608X7R1H103K080AA   | eFuse output slew timing                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C46       | C2012X7R2A104K125AA   | REC30K switched-input bypass                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C47       | C3225X7R1H106K250AC   | REC30K switched-input reservoir                                                  | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C48       | C1608X7R1H104K080AA   | REC30K PANEL_5V bypass                                                           | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C49       | C3216X7R1C106K160AC   | REC30K PANEL_5V reservoir                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C50       | C2012X7R2A104K125AA   | Additional raw VBUS bypass; omitted from guide's capacitance sum                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C51       | C1608X7R1H223K080AA   | Ethernet TX center-tap filter                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C52       | C1608X7R1H682K080AA   | Ethernet RX+ series coupling                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C53       | C1608X7R1H682K080AA   | Ethernet RX- series coupling                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C54       | C1608X7R1H103K080AA   | Ethernet RX termination midpoint bypass                                          | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C55       | C1608X7R1H103K080AA   | W5500 1V2O bypass                                                                | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C56       | C1608X5R1C475K080AC   | W5500 TOCAP reservoir                                                            | Selected in-production 16V TDK replacement; dimensions and bias curves compared. Supplier quantity and bench behavior remain open.                                    |
| C57       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C58       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C59       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C60       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C61       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C62       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C63       | C2012X5R1A106K125AC   | Ethernet filtered analog reservoir                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C64       | CC0603JRNPO9BN180     | 25MHz Ethernet crystal input load                                                | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                             |
| C65       | CC0603JRNPO9BN180     | 25MHz Ethernet crystal output load                                               | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                             |
| C66       | C1608X7R1H223K080AA   | LTC3130 22nF BST2-to-SW2 bootstrap                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C69       | C1608X7R1H104K080AA   | Power-controller VLO bypass                                                      | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C70       | C1608X5R1A105K080AC   | Power-controller VLO reservoir                                                   | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| C71       | C1608X7R1H104K080AA   | Power-controller NRST filter                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                             |
| D1        | SS14-E3/61T           | Isolated USB 5V anode to CORE_5V cathode.                                        | Retain; prevents reverse sourcing. Forward drop and reverse leakage belong in power budget.                                                                           |
| D2        | SS14-E3/61T           | PANEL_5V anode to CORE_5V cathode.                                               | Retain; permits display-mode core power. Check leakage into unpowered panel domain.                                                                                   |
| D3        | BAT54S,215            | left A sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.         | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D4        | BAT54S,215            | left B sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.         | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D5        | BAT54S,215            | left C sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.         | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D6        | BAT54S,215            | right A sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.        | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D7        | BAT54S,215            | right B sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.        | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D8        | BAT54S,215            | right C sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.        | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D9        | BAT54S,215            | piste sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.          | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                           |
| D10       | 1N4004-E3/54          | Favero port 1 reverse-polarity shunt across optotransistor.                      | Retain; does not establish tolerance to arbitrary powered-port faults.                                                                                                |
| D11       | 1N4004-E3/54          | Favero port 2 reverse-polarity shunt across optotransistor.                      | Retain; same circuit evaluated separately on second port.                                                                                                             |
| FB1       | BLM18AG121SN1D        | APP_3V3 to Ethernet analog supply filter.                                        | Retain; check DC resistance/current derating and analog-rail droop.                                                                                                   |
| J1        | USB4105-GF-A          | Single USB-C power/data receptacle; CC and both USB2 orientations connected.     | Retain; USB-A/default-current operation not promised. Mechanical pin-map and assembly review still required.                                                          |
| J2        | HTSW-105-07-L-S       | STM32 3.3V SWD/recovery header.                                                  | Retain; do not connect a grounded debugger across the isolation barrier unknowingly.                                                                                  |
| J3        | HTSW-103-07-L-S       | Left fencer A/B/C internal harness header.                                       | Retain; not a 3-pin banana socket. External socket/harness assembly is separate.                                                                                      |
| J4        | HTSW-103-07-L-S       | Right fencer A/B/C internal harness header.                                      | Retain; preserve left/right separation and verify harness pin identity.                                                                                               |
| J5        | HTSW-101-07-L-S       | Metal piste reference internal harness header.                                   | Retain; functional sensing conductor, not protective earth.                                                                                                           |
| J6        | HTSW-106-07-L-S       | ESP32 3.3V UART/EN/BOOT service header.                                          | Retain; UART service is needed because USB data terminates at STM32.                                                                                                  |
| J7        | TST-108-02-G-D        | 16-pin HUB75 RGB/address/clock/latch/OE signal header.                           | Retain; confirm keyed cable orientation and exact 64x32 panel scan convention.                                                                                        |
| J8        | 645004114822          | Panel 5V connector, two supply and two ground contacts.                          | Retain; verify mating cable/current rating; no panel in laptop SKU.                                                                                                   |
| J9        | 5520250-2             | Favero port 1 modular connector, duplicated inner/outer conductors.              | Retain; actual Favero cable polarity and sample interoperability remain bench checks.                                                                                 |
| J10       | 5520250-2             | Favero port 2 modular connector, duplicated inner/outer conductors.              | Retain; inspect this port independently, not just J9.                                                                                                                 |
| J12       | HTSW-103-07-L-S       | Primary-side STUSB4500 I2C service header.                                       | Retain for prototype; label USB_GND domain, never bridge to board-side ground.                                                                                        |
| J13       | J1B1211CCD            | Ethernet magjack with integrated LEDs and magnetics.                             | Retain; manufacturer hole-pattern and outward-facing placement check passed. Exact 3D model unavailable; enclosure/cable clearance remains open.                      |
| L1        | XAL5030-472MEC        | AP63203 4.7uH output inductor.                                                   | Retain; verify peak-current and thermal margin with ESP32/network load steps.                                                                                         |
| L2        | XAL5050-103MEC        | LTC3130 10uH buck-boost inductor.                                                | Retain current MPN; do not use historical 22uH description. Saturation and loop margin remain required.                                                               |
| Q1        | DMN2056U-7            | Pulls HUB75 buffer OE low only on display enable.                                | Retain; preserves blanking on reset.                                                                                                                                  |
| Q2        | DMN2056U-7            | Piezo low-side switch.                                                           | Retain; resistor R87 supplies piezo discharge path.                                                                                                                   |
| Q3        | DMN2056U-7            | Common low-side drive for both Favero opto LEDs.                                 | Retain; ports intentionally mirror one signal, not independently addressable.                                                                                         |
| Q4        | DMN2056U-7            | Clamps application eFuse enable when 20V status is not accepted.                 | Retain; status gate is pulled to regulated 5V, not raw 20V.                                                                                                           |
| Q5        | DMN2056U-7            | Clamps application eFuse enable when attach state disallows it.                  | Retain; same gate-voltage distinction as Q4.                                                                                                                          |
| Q6        | DMN2056U-7            | Controller application-power inhibit clamp.                                      | Retain; pull-up makes application off with blank/reset U21.                                                                                                           |
| R3        | RC0603FR-07100KL      | USB_PRESENT divider upper 100k                                                   | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R4        | RC0603FR-07150KL      | USB_PRESENT divider lower 150k; nominal ratio 0.6                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R5        | RC0603FR-0710KL       | STM32 reset pull-up                                                              | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R6        | RC0603FR-0710KL       | STM32 BOOT0 pull-down                                                            | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R7        | ERJPA3F2200V          | left A 220-ohm drive current limiter.                                            | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R8        | RC0603FR-07390RL      | left A 390-ohm sense series resistor.                                            | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R9        | RC0603FR-0710KL       | left A active-low buffer OE pull-up.                                             | Retain; disables drive during MCU reset.                                                                                                                              |
| R10       | ERJPA3F2200V          | left B 220-ohm drive current limiter.                                            | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R11       | RC0603FR-07390RL      | left B 390-ohm sense series resistor.                                            | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R12       | RC0603FR-0710KL       | left B active-low buffer OE pull-up.                                             | Retain; disables drive during MCU reset.                                                                                                                              |
| R13       | ERJPA3F2200V          | left C 220-ohm drive current limiter.                                            | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R14       | RC0603FR-07390RL      | left C 390-ohm sense series resistor.                                            | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R15       | RC0603FR-0710KL       | left C active-low buffer OE pull-up.                                             | Retain; disables drive during MCU reset.                                                                                                                              |
| R16       | ERJPA3F2200V          | right A 220-ohm drive current limiter.                                           | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R17       | RC0603FR-07390RL      | right A 390-ohm sense series resistor.                                           | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R18       | RC0603FR-0710KL       | right A active-low buffer OE pull-up.                                            | Retain; disables drive during MCU reset.                                                                                                                              |
| R19       | ERJPA3F2200V          | right B 220-ohm drive current limiter.                                           | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R20       | RC0603FR-07390RL      | right B 390-ohm sense series resistor.                                           | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R21       | RC0603FR-0710KL       | right B active-low buffer OE pull-up.                                            | Retain; disables drive during MCU reset.                                                                                                                              |
| R22       | ERJPA3F2200V          | right C 220-ohm drive current limiter.                                           | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R23       | RC0603FR-07390RL      | right C 390-ohm sense series resistor.                                           | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R24       | RC0603FR-0710KL       | right C active-low buffer OE pull-up.                                            | Retain; disables drive during MCU reset.                                                                                                                              |
| R25       | ERJPA3F2200V          | piste 220-ohm drive current limiter.                                             | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                   |
| R26       | RC0603FR-07390RL      | piste 390-ohm sense series resistor.                                             | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                               |
| R27       | RC0603FR-0710KL       | piste active-low buffer OE pull-up.                                              | Retain; disables drive during MCU reset.                                                                                                                              |
| R28       | RC0603FR-0710KL       | ESP32 EN pull-up with C21                                                        | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R29       | RC0603FR-0710KL       | ESP32 BOOT pull-up                                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R30       | RC0603FR-0747KL       | STM32 UART receive idle pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R31       | RC0603FR-0747KL       | ESP32 UART receive idle pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R32       | RC0603FR-07100RL      | IR supply 100-ohm filter with C30                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R33       | RC0603FR-07100KL      | Display-enable gate pull-down                                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R34       | RC0603FR-0710KL       | 5V HUB75 buffer-disable pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R35       | RC0603FR-0710KL       | Panel OE pull-up: blank when outputs disabled                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R36       | RC0603FR-071KL        | Buzzer MOSFET gate series resistor                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R37       | RC0603FR-07100KL      | Buzzer gate reset pull-down                                                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R38       | ERJPA3F2200V          | Favero port 1 opto LED current limiter                                           | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R39       | ERJPA3F82R0V          | Favero port 1 output 82-ohm series protection                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R40       | RC0603FR-07680KL      | Favero port 1 base-emitter discharge                                             | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R41       | ERJPA3F2200V          | Favero port 2 opto LED current limiter                                           | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R42       | ERJPA3F82R0V          | Favero port 2 output 82-ohm series protection                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R43       | RC0603FR-07680KL      | Favero port 2 base-emitter discharge                                             | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R44       | RC0603FR-07100KL      | Favero TX MOSFET reset pull-down                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R45       | RC0603FR-0710KL       | left A drive-input pull-down.                                                    | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R46       | RC0603FR-0710KL       | left B drive-input pull-down.                                                    | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R47       | RC0603FR-0710KL       | left C drive-input pull-down.                                                    | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R48       | RC0603FR-0710KL       | right A drive-input pull-down.                                                   | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R49       | RC0603FR-0710KL       | right B drive-input pull-down.                                                   | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R50       | RC0603FR-0710KL       | right C drive-input pull-down.                                                   | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R51       | RC0603FR-0710KL       | piste drive-input pull-down.                                                     | Retain; deterministic low when enabled before GPIO initialization.                                                                                                    |
| R65       | RC0603FR-071KL        | left A sense 1k shunt to ground.                                                 | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R66       | RC0603FR-071KL        | left B sense 1k shunt to ground.                                                 | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R67       | RC0603FR-071KL        | left C sense 1k shunt to ground.                                                 | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R68       | RC0603FR-071KL        | right A sense 1k shunt to ground.                                                | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R69       | RC0603FR-071KL        | right B sense 1k shunt to ground.                                                | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R70       | RC0603FR-071KL        | right C sense 1k shunt to ground.                                                | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R71       | RC0603FR-071KL        | piste sense 1k shunt to ground.                                                  | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                        |
| R72       | RC0603FR-0710KL       | STM32 UART transmit idle pull-up                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R73       | RC0603FR-0710KL       | ESP32 UART transmit idle pull-up                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R74       | RC0603FR-0710KL       | HUB75 R1 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R75       | RC0603FR-0710KL       | HUB75 G1 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R76       | RC0603FR-0710KL       | HUB75 B1 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R77       | RC0603FR-0710KL       | HUB75 R2 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R78       | RC0603FR-0710KL       | HUB75 G2 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R79       | RC0603FR-0710KL       | HUB75 B2 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R80       | RC0603FR-0710KL       | HUB75 A input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R81       | RC0603FR-0710KL       | HUB75 B input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R82       | RC0603FR-0710KL       | HUB75 C input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R83       | RC0603FR-0710KL       | HUB75 D input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R84       | RC0603FR-0710KL       | HUB75 CLK input pull-down on APP side of 5V buffer.                              | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R85       | RC0603FR-0710KL       | HUB75 LAT input pull-down on APP side of 5V buffer.                              | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R86       | RC0603FR-0710KL       | HUB75 OE input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                           |
| R87       | RC0603FR-071KL        | Piezo discharge resistor parallel to BZ1                                         | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R88       | RC2512FK-071KL        | STUSB4500 raw VBUS sense/discharge path, 1W                                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R89       | RC2512FK-071KL        | STUSB4500 switched input discharge path, 1W                                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R92       | RC0603FR-07100KL      | 5V pull-up of active-low PD 20V status                                           | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R93       | RC0603FR-07100KL      | 5V pull-up of active-low PD attach status                                        | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R94       | RT0603BRD07140KL      | eFuse enable divider upper 140k                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R95       | RT0603BRD0710KL       | eFuse enable divider lower 10k; nominal 18V threshold at 1.2V                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R96       | RT0603BRD07172KL      | eFuse overvoltage divider upper 172k                                             | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R97       | RT0603BRD0710KL       | eFuse overvoltage divider lower 10k; nominal 21.84V at 1.2V                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R98       | RC0603FR-071K37L      | eFuse current-limit programming                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R99       | RC0603FR-0749R9L      | Ethernet TX+ 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R100      | RC0603FR-0749R9L      | Ethernet TX- 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R101      | RC0603FR-0749R9L      | Ethernet RX+ 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R102      | RC0603FR-0749R9L      | Ethernet RX- 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R103      | RC0603FR-0710RL       | Ethernet TX center-tap series feed                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R104      | RC0603FR-0712K4L      | W5500 EXRES precision bias resistor                                              | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R105      | RC0603FR-07330RL      | Ethernet LINK LED current limiter                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R106      | RC0603FR-07330RL      | Ethernet ACT LED current limiter                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R107      | RC0603FR-071ML        | Ethernet crystal feedback resistor                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R111      | RC0603FR-07100KL      | Application inhibit default pull-up                                              | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R112      | RC0603FR-07100KL      | Acquisition ON default pull-down                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R113      | RC0603FR-07100KL      | Automatic USB suspend shutdown default pull-up                                   | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R114      | RC0603FR-074K7L       | Primary-domain PD I2C SDA pull-up                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R115      | RC0603FR-074K7L       | Primary-domain PD I2C SCL pull-up                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| R116      | RC0603FR-0747KL       | Primary-domain PD ALERT pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                              |
| SW1       | TL3342F160QG          | STM32 reset to ground.                                                           | Retain; recovery aid, not unused I/O.                                                                                                                                 |
| SW2       | TL3342F160QG          | ESP32 EN reset to ground.                                                        | Retain; recovery aid.                                                                                                                                                 |
| SW3       | TL3342F160QG          | ESP32 BOOT to ground.                                                            | Retain; manual programming recovery.                                                                                                                                  |
| U1        | STM32G474RET6         | STM32G474 scoring/acquisition; USB isolated side, seven comparator sense inputs. | Retain; supplies, USB, SWD, sense and drive nets inspected. Timing, thresholds and physical current budget remain separate verification.                              |
| U2        | ESP32-S3-WROOM-1-N8R8 | ESP32-S3-N8R8 display/Ethernet/IR processor on switched APP_3V3.                 | Retain; PSRAM-reserved GPIO35/36/37 and other unused pads intentionally NC. Antenna clearance requires geometric review.                                              |
| U3        | TPD2E2U06DCKR         | USB D+/D- ESD device referenced to USB_GND.                                      | Retain; not a VBUS/CC surge protector or isolation component.                                                                                                         |
| U4        | AP2112K-3.3TRG1       | AP2112 3.3V acquisition LDO, EN tied to CORE_5V.                                 | Retain; nominal 75mA at 5V implies about 0.128W before diode-drop adjustment, not a thermal measurement.                                                              |
| U5        | STUSB4500QTR          | STUSB4500 autonomous PD sink with U21 qualification.                             | Retain; matching CC dead-battery pins connected. Verify exact NVM/configuration at first programming.                                                                 |
| U6        | REC30K-2405SZ         | Isolated application/panel supply.                                               | Pin/land/body drawing check passed; assembler must confirm finished-hole tolerance. Thermal/startup capability remains a bench check. CTRL/TRIM intentionally unused. |
| U7        | AP63203WU-7           | AP63203 application 3.3V buck regulator.                                         | Retain; feedback to APP_3V3 and bootstrap topology checked. DC-bias and thermal verification remain.                                                                  |
| U8        | 74LVC125APW,118       | Three left-channel LVC125 conductor drivers.                                     | Retain; fourth channel input tied low, OE high, output NC intentionally.                                                                                              |
| U9        | 74LVC125APW,118       | Right A/B/C and piste LVC125 conductor drivers.                                  | Retain; all four channels used. OE pulls prevent reset drive.                                                                                                         |
| U10       | SN74AXC1T45DCKR       | CORE-to-APP UART level translator.                                               | Retain; dual power-domain isolation behavior, not galvanic isolation. A-to-B DIR correct.                                                                             |
| U11       | SN74AXC1T45DCKR       | APP-to-CORE UART level translator.                                               | Retain; B-to-A DIR correct; power-off leakage remains budgeted.                                                                                                       |
| U12       | W5500                 | W5500 Ethernet controller.                                                       | Retain; SCSn/RSTn internal pull-ups rule out missing-pull-up claim. Ensure firmware reset >=500us and startup wait.                                                   |
| U13       | TSOP38438             | 38kHz TSOP38438 IR demodulator.                                                  | Retain; OUT/GND/VS pin roles checked. Carrier is not encryption; optical range/flood testing remains.                                                                 |
| U14       | SN74AHCT541PWR        | Eight HUB75 3.3-to-5V AHCT buffer channels.                                      | Retain; OE1 grounded, OE2 under Q1 control.                                                                                                                           |
| U15       | SN74AHCT541PWR        | Remaining five HUB75 AHCT buffer channels.                                       | Retain; three unused inputs grounded, outputs NC. Second IC is needed for 13 signals.                                                                                 |
| U16       | 4N32M                 | Favero port 1 optodarlington.                                                    | Retain; base resistor and reverse diode intentional. Cable load, CTR and release time need sample testing.                                                            |
| U17       | 4N32M                 | Favero port 2 optodarlington.                                                    | Retain; separate isolated output shares transmit command but not output ground.                                                                                       |
| U18       | LTM2884IY#PBF         | LTM2884 isolated USB and acquisition power.                                      | Retain; VLO 10mA allowance and 5V-side output budget require whole-system check; assembly profile unresolved.                                                         |
| U19       | LTC3130IMSE-1#PBF     | LTC3130 regulated primary 5V from USB VBUS.                                      | Fixed-5V automatic mode implemented; ERC/DRC/parity pass. Whole-input suspend and physical validation remain open.                                                    |
| U20       | TPS259470LRPWR        | TPS259470 application branch eFuse.                                              | Pin/land check passed; split power-pad paste windows implemented and visually verified. Copper unchanged. Assembler stencil process remains open.                     |
| U21       | STM32C011F6P6         | STM32C011 primary-side source qualifier and power gate controller.               | Retain; PA11 is default pin16 mapping; no remap bug established. First programming and VLO current budget open.                                                       |
| Y1        | ABM3B-8.000MHZ-B2-T   | STM32 8MHz HSE crystal.                                                          | Retain; 27pF pair gives 13.5pF series load before strays. Verify startup/frequency.                                                                                   |
| Y2        | ABM8-25.000MHZ-B2-T   | Ethernet 25MHz CL18pF crystal.                                                   | Retain provisionally; 18pF pair gives 9pF before strays. Reference circuit alone does not establish actual crystal load.                                              |

## Geometry validation, 8 September

The initial native `pcbnew` inspection regenerated zone fill in memory without saving. The primary net set came from the
USB-side ICs/connectors, U18 A/B pads and U6 input pins, extended through their resistor/inductor networks. Secondary
`GND` was checked not to be in that set. Copper comparisons include pad, track/via and filled-zone geometry;
intentionally unconnected pins are not treated as meaningful domain nets.

| Check                  | Result                                                                                          | Meaning / limitation                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Populated courtyards   | 223 present; zero pairwise overlaps                                                             | Fresh 2D check, not cable or body-height clearance. J14 bare pads intentionally excluded.                           |
| U18 land geometry      | 44 circular lands, each 0.63mm; inner land edges x77.235 and x86.765mm                          | Nominal land-edge gap 9.53mm. Orientation is 90 degrees at (82,140)mm.                                              |
| U18 gap on F.Cu        | No copper inside the rectangle x77.235–86.765, y133.335–146.665mm (1um inward numerical margin) | Supports the local top-side no-copper check.                                                                        |
| U18 gap on B.Cu        | USB_GND and GND fill enter the nominal rectangle at its edges                                   | At y140mm the gap is 9.50mm: 0.015mm intrusion per side relative to nominal land edges. Not a copper bridge.        |
| U18 inner layers       | USB_GND/GND fills also enter that nominal rectangle; centerline gap 9.50mm                      | Does not establish interlayer insulation or an all-board minimum.                                                   |
| F.Cu domain separation | Approximately 2.65mm minimum, elsewhere on board                                                | 0.5mm USB_PRIMARY_5V track at y132.5mm versus 0.6mm LEFT_C_SENSE via at (72.2,129.3)mm: 3.2 - 0.25 - 0.30 = 2.65mm. |

The closest top-side items are track UUID `7d128222-c288-4aeb-ac15-abc470c5cb26` and via UUID
`b96fb02c-6d7a-43e7-9def-d62a59aceaf0`. Shape comparison bounded their gap to 2.649709–2.650404mm; the coordinate
calculation independently gives 2.65mm. This is **not** a measured creepage path or a conclusion about FIE compliance.
The exhaustive other-layer pair search was stopped for runtime; only the local U18 checks above are reported for those
layers. Do not present an unfinished search as a full-board result.

**Local pour correction implemented:** widened the existing four-layer U18 keepout from x77.30–86.70mm to
x77.235–86.765mm, matching the inner land edges, while preserving its y130–150mm extent. Refilled and saved the native
board. Polygon intersections against the interior rectangle x77.236–86.764mm, y133.336–146.664mm now report **zero
filled-copper area on F.Cu, In1.Cu, In2.Cu and B.Cu**. The 1um inset avoids boundary-rounding ambiguity. The table above
records the earlier finding, not the corrected fill. All 231 footprints and 3,823 track/via items retained identity,
position and connections. KiCad DRC without a temporary refill reports zero violations, unconnected items and schematic
parity issues. The exported [bottom copper plot](output/isolation-gap-bottom.pdf) was visually inspected.

ADI instructs leaving copper out of the area between inner pad columns on top and bottom. Its module creepage figure is
not a blanket PCB requirement. This fixes the local pour intrusion; the 2.65mm gap elsewhere still needs an explicit
system requirement before acceptance or rerouting. No component, circuit topology or isolation-rating claim changed.
[LTM2884 datasheet, PCB layout and isolation characteristics](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf).

No route or component has been changed. Only the existing keepout and resulting copper fill were corrected. These
results do not close whole-board electrical safety, package-fit or assembler review. The refreshed
`output/isolation-keepout-review/` contains Gerbers, drills, 230 matching BOM/placement references and a fresh U21 build
(2476 text bytes, 60 BSS; HEX SHA256 `80349F8D523EF5FF46FE6D8545EC02A0561F4723863381F4E8CC91668D38B132`). Exported
ERC/DRC/parity/unconnected counts are zero. Earlier archives and the JLCPCB draft predate this correction; nothing was
uploaded or approved. This slice's `pnpm verify` passed its check stages and all seven electrical models, then failed
the existing scoring TypeScript 100% coverage thresholds (95.98% lines, 99.79% functions, 95.34% statements, 93.62%
branches). No thresholds were changed; repository-wide verification is not clean.

### All-layer isolation geometry follow-up

The current saved board was screened using native pad, track, via and filled-zone copper polygons, not courtyard boxes.
USB/PD-side supply/control nets and their intentionally unconnected package pins were grouped separately from all other
copper nets; USB_DM/DP, USB_ISOLATED_5V and USB_PRESENT are secondary-side nets. Polygon expansion/intersection uses 1um
approximations; quote results to 0.01mm, with approximately 0.005mm numerical allowance.

| Layer  | Before pour trim | After pour trim |
| ------ | ---------------: | --------------: |
| F.Cu   |           2.65mm |          2.65mm |
| In1.Cu |           0.50mm |          2.60mm |
| In2.Cu |           2.60mm |          2.60mm |
| B.Cu   |           0.50mm |          2.50mm |

The 0.50mm pinch point was between the USB_GND boundary at x78.5mm and a GND extension at x79mm, y82–84mm. Trimming that
extension to x82mm on In1.Cu and B.Cu removes it. All component placements, pad nets and track/via geometry are
unchanged; native DRC reports zero violations, unconnected items and schematic-parity issues. The resulting
bottom-copper plot was visually inspected. The U18 inset rectangle x77.236–86.764mm, y130.001–149.999mm still has zero
filled-copper area on each copper layer.

These are same-layer geometric separations, not measured surface creepage, inter-layer insulation, dielectric withstand
or an FIE/safety-standard acceptance criterion. The board-level working-voltage and clearance/creepage basis remains
open. No new safety rating or permission to connect fencers is implied.

Fresh `output/isolation-extension-review/` contains 223 matching BOM/placement entries, Gerbers/drills and a rebuilt U21
programming image. ERC, DRC, unconnected and parity counts are zero. No order was submitted. This slice's `pnpm verify`
passed checks but again failed the unchanged scoring TypeScript 100% coverage gate: all 950 domain tests passed;
coverage was 95.98% lines, 99.79% functions, 95.34% statements and 93.62% branches. No threshold was changed.

## Requirements and power-budget follow-up, 8 September

**Implemented regulator replacement: LTC3130IMSE-1#PBF.** Fixed 5V and automatic Burst/PWM remove the old permanently
selected light-load mode without adding a suspend detector. Internal compensation removes
R90/R91/R108/R109/R110/C67/C68. C40 is now TDK C2012X7R1H105K125AB (1uF); C42/C66 are C1608X7R1H223K080AA (22nF).
C39/C41/C43 and 10uH L2 are retained. The schematic and PCB use the reviewed MSE16 footprint, not the old DHD footprint.
Physical VS2=9 and VS1=10 were checked against ADI's package drawing, not inferred from simulation terminal order.

The local routing was rebuilt and zone-filled. R89 moved 0.9mm upward and C50 0.5mm downward for courtyard clearance;
their electrical roles did not change. Native ERC, DRC, unconnected and schematic-parity checks are zero. The assembly
export in `output/fixed-regulator-review/` contains 223 matching BOM/placement entries, Gerbers/drills and a fresh U21
programming image. No JLCPCB draft, purchase or approval has changed. Scope comparison: 214 unaffected footprints and
3,613 retained track/via geometries and nets are unchanged; 210 local track/via items were replaced by 77, with exactly
seven support footprints removed. Final `pnpm verify` passed its check stage, then stopped at the existing scoring
TypeScript 100% coverage gate: 950 tests passed across 46 files, but coverage remained 95.98% lines, 99.79% functions,
95.34% statements and 93.62% branches. No threshold was changed. The native board checks passed; repository-wide
verification is not clean.

The footprint follows ADI 05-08-1667 Rev F, page 37: 0.889 x 0.300mm lands, 0.500mm pitch, 3.331mm inner gap, 5.109mm
outer span and 1.651 x 2.845mm exposed pad. Four paste windows remain a project stencil choice requiring assembler
review. No exact 3D model or assembled-pin overlay is claimed.
[ADI LTC3130/-1 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/3130f.pdf).

Its 25V operating ceiling covers nominal 20V PD, not unbounded hot-plug overshoot. Do not interpret the 600mA buck
rating as a boost guarantee. The 660mA minimum average-current limit at assumed 70% efficiency and 4.1V input gives
`0.660 × 4.1 / 5 × 0.70 = 0.37884A`, 26% above the 0.3005A allocation. This remains an assumption-dependent screen.
Whole-input suspend, temperature/tolerance corners and physical startup remain open; the completed nominal model cases
below are not hardware approval. The previously observed exact IC listing was $12.79 at one / $10.054 at ten, before
assembly, shipping and tax; refresh the complete board quote rather than claiming a net saving.
[LTC3130IMSE-1#PBF listing](https://www.digikey.com/en/products/detail/analog-devices-inc/LTC3130IMSE-1-PBF/6174047).

**Capacitor bias review:** the exact TDK characterization curves were visually inspected. C39 `C4532X7R1H475K200KB`
loses approximately 45% at 20V (about 2.6uF typical), but much less near laptop input voltage. C43 `C4532X5R1A476M280KA`
loses approximately 24% at 5V (about 36uF typical); its half-rated-voltage temperature curve is approximately -25% to
-35% across the plotted range. These are reference curves, not guaranteed bounds, and do not include a guaranteed
combined tolerance/temperature/bias minimum. Nominal reference-circuit capacitance must not be silently treated as
effective capacitance. Conversely, the C39 bias loss alone does not establish a failure: assess input ripple at
high-voltage buck and low-voltage boost conditions before adding capacitance or a switch. At U19's 4V VCC, C41
`C2012X5R1C475K125AC` retains roughly 88% (about 4.1uF typical) on its bias curve. Its nominal value meets the stated
4.7uF bypass value, not a guaranteed effective minimum. Physical transient/stability and bypass verification remain
required after migration.
[TDK C39 characterization](https://product.tdk.com/system/files/dam/doc/product/capacitor/ceramic/mlcc/charasheet/c4532x7r1h475k200kb.pdf),
[TDK C43 characterization](https://product.tdk.com/en/system/files/dam/doc/product/capacitor/ceramic/mlcc/charasheet/c4532x5r1a476m280ka.pdf),
[TDK C41 characterization](https://product.tdk.com/en/system/files/dam/doc/product/capacitor/ceramic/mlcc/charasheet/c2012x5r1c475k125ac.pdf).

Verification of this footprint slice: native KiCad load/pad geometry passed. `pnpm verify` passed its check stage, then
failed the existing scoring TypeScript 100% coverage gate (95.98% lines, 99.79% functions, 95.34% statements, 93.62%
branches). No coverage thresholds were changed. This is not verification of a migrated regulator circuit.

**Input-network screen:** `simulation/primary-regulator-input.cir` now runs with the electrical suite. Under its stated
source/cable/effective-capacitance assumptions, the laptop load step reaches 4.379V minimum and 4.488V settled; fast 5V
attachment peaks at 9.113V; a 500us 5V-to-20V transition peaks at 20.079V. All four limits and all eight models pass.
These scenarios do not establish cable bounds, a regulator control-loop response or source-current-limit behavior. Do
not use the 20V ramp result to approve an instantaneous 20V hot-plug event.

The LTC3130-1 5V row of ADI table 3 recommends 10uH maximum and 20uF minimum output capacitance. The existing 47uF
output capacitor's combined temperature/bias curve, with -20% tolerance applied, screens around 24uF; this is not a
guaranteed minimum. Internal soft-start is nominally 12ms and limits inductor current rather than guaranteeing an output
rise time with the real LTM2884 load. Complete that startup/load check before migration.

**Manufacturer-model run completed:** `simulation/primary-regulator-startup.cir` completed both 50ms cases in 1584.958
seconds. Final LTspice measurements below supersede the earlier nearest-raw-sample readings.

| Input | Output at 19ms | Minimum, 20–39ms load | Settled at 39ms | Maximum, 40–49ms release |
| ----- | -------------- | --------------------- | --------------- | ------------------------ |
| 4.1V  | 5.00174V       | 4.83892V              | 5.00032V        | 5.16945V                 |
| 20V   | 5.00596V       | 4.88823V              | 4.99785V        | 5.10610V                 |

Both cases pass the nominal 5V +/-5% voltage screen with reduced capacitances and a 10mA-to-300.5mA resistive-equivalent
load. Do not rerun this unchanged experiment. This supports the candidate selection; it is not a tolerance sweep, actual
LTM2884 startup proof, measured stability margin or hardware measurement. Real isolator startup and suspend consumption
remain separate checks. Final log: `output/primary-regulator-startup.log`, SHA256
`C9CFDCB869914F15C02F574F3D90C16C3C574085F6988E0E95AE6B72B0ED6E03`. ADI's `/download/latest/LTspice64.msi` returned
signed version 24.0.12, despite its website advertising a newer version. Retained model SHA256:
`F31E49E56C19702525D48631AEDAB04942A7705907C0F1DA374D4F160E8E0C7D`. ADI acknowledged an LTC3130 shutdown-current model
error in December 2025; do not use this older model to close the suspend-power budget.
[ADI model limitation report](https://ez.analog.com/power/f/q-a/601450/ltspice-model-ltc3130-quiescent-current-in-shutdown-run-0).

**LTC3114-1 is not the preferred path:** its 10uF input reservoir would make the present direct VBUS bank 12.2uF
nominal. Additional bulk capacitance requires a controlled power path rather than silently exceeding the USB-C 10uF
direct-capacitance guidance. This does not establish a defect in the current 6.9uF bank.
[TI USB-C power-path guidance](https://www.ti.com/document-viewer/lit/html/SSZTA47/GUID-A5D68CC9-512A-4829-8D81-C0708D7A7836).

The retained August 2026 FIE material rules were checked at m.51 and m.58–m.60 (printed pages 44–49). These apparatus
clauses do not supply a numerical PCB clearance to apply to the measured 2.65mm gap. m.51.9 and m.60.1 require optical
separation for specified external clock/sound/light interfaces. m.51.7/11 and m.58 address supply and backup provisions;
m.58 specifies 12V-based supplies, and the backup requirement is five minutes. Our USB-C prototype is therefore not
automatically a homologation-ready apparatus. Preserve the approved prototype architecture; resolve competition supply
compatibility and the applicable electrical-safety basis before claiming homologation. Do not invent an FIE millimetre
threshold or treat a module's rating as the complete board's rating.
[FIE material rules, August 2026](https://static.fie.org/uploads/40/204157-book%20material%20August%202026%20ang.pdf).

The existing **4mA VLO allowance does not close the PD suspend budget**. ADI specifies up to 0.5mA VBUS suspend current
with shutdown enabled and describes VCC draw as VCC/45k; external VLO current is additional. Using 5V, 4mA external load
and 5V/45k gives approximately **23.06mW at U19's output**. This mixes a conservative allocation, a maximum and a
descriptive resistance: it is a screening calculation, not a guaranteed worst-case bound.
[LTM2884, electrical characteristics and suspend operation](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf).

Even using only STUSB4500's **0.210mA maximum disconnected-idle value at 5V**, the nominal 25mW allowance leaves 23.95mW
for U19 input: the screen would require **96.3% conversion efficiency**, before other raw-VBUS loads. That ST value is
not an attached-PD guarantee. Thus this calculation cannot establish compliance or prove measured failure. The next
remedy to evaluate is lower U21 CPU/peripheral duty while retaining bounded alert and watchdog response; do not replace
the power hardware on this calculation alone.
[STUSB4500, table 22 and its stated conditions](https://www.st.com/resource/en/datasheet/stusb4500.pdf).

The implemented shallow sleep alone is not enough evidence to reduce the 4mA allocation. ST DS13866 Rev 5 table 30 gives
1.10mA characterized maximum for 6MHz HSI-derived Sleep at 85 C, peripherals disabled, versus the 1.40mA Run baseline.
Using these maxima for continuous sleep reduces the baseline allocation by only 0.30mA (about 1.5mW at the 5V feeder),
before wake activity; subtracting maxima is not a measured or guaranteed saving. The larger budgeting opportunity is
avoiding continuously low I2C pull-ups, already addressed by the 10ms health-poll schedule. Its normal no-alert pass
reads 1, 6, 1 and 4 bytes in four I2C transactions: 216 address/register/data/ACK clocks before START/STOP overhead or
stretching. At nominal 400kHz that is 0.54ms, not a guaranteed bus-duty bound. Confirm bus timing and actual attached-PD
U5 consumption before reducing the total. Do not add deeper-sleep complexity or claim the existing Sleep instruction
proves the 25mW limit. [STM32C011 current tables](https://www.st.com/resource/en/datasheet/stm32c011f6.pdf).

U19's advertised no-load quiescent current is not a loaded converter efficiency guarantee. The fixed-output replacement
and nominal model checks above do not establish physical DC-bias, thermal or whole-input suspend margins. The power
guide retains the implemented 40us slots / 120us frames and now accounts for 7.8uF nominal raw-VBUS capacitance.

## Verification limits and next review order

### Crystal selection calculation

Y1 is ABM3B-8.000MHZ-B2-T. Using its 200-ohm maximum ESR, 7pF maximum shunt capacitance and 18pF specified load, ST's
`gmcrit = 4 × ESR × (2πf)^2 × (C0 + CL)^2` gives **1.263mA/V**, below STM32G474's **1.5mA/V maximum critical crystal
transconductance**. This passes the nominal-load selection criterion. Do not divide 1.5 by five again: ST distinguishes
this already-derated criterion from an amplifier-gain specification.
[Abracon ABM3B ratings](https://abracon.com/Resonators/abm3b.pdf),
[STM32G474 table 41](https://www.st.com/resource/en/datasheet/stm32g474cb.pdf),
[ST AN2867 section 3.4](https://www.st.com/resource/en/application_note/an2867-oscillator-design-guide-for-stm8afals-stm32-mcus-and-mpus-stmicroelectronics.pdf).

C17/C18 at 27pF nominal contribute 13.5pF in series, requiring **4.5pF effective stray capacitance** to reach that 18pF
load. At the same ESR/C0 assumptions the critical-gain limit corresponds to approximately **20.24pF total load**, or
6.74pF stray with nominal capacitors (6.07pF at both capacitors' +5% tolerance). This is a tuning constraint, not a
measurement of the board. Retain Y1; verify actual load, drive level and startup before claiming oscillator
qualification.

Y2 is ABM8-25.000MHZ-B2-T, with standard 18pF load. C64/C65's 18pF values match WIZnet's reference circuit; their 9pF
series equivalent is not by itself evidence of an error. The remaining effective pin/board capacitance and assembled
frequency require verification; changing them to 36pF merely by doubling CL would ignore those contributions.
[Abracon ABM8 specification and option codes](https://abracon.com/Resonators/abm8.pdf),
[WIZnet W5500 reference schematic](https://docs.wiznet.io/img/products/w5500/w5500_evb/w5500_evb_v1.0_140527.pdf).

This follow-up reran `pnpm verify`: check stages and all seven electrical simulation models passed; scoring coverage
again failed its existing 100% thresholds. This is not a clean repository-wide verification result. No thresholds were
relaxed. Focused document formatting and diff checks passed.

The later geometry-review `pnpm verify` rerun stopped earlier, on unrelated lint errors in
`apps/legislation/tmp/committee-source-audit.ts`; coverage did not run in that rerun. That file was not edited. Document
formatting and scoped diff checks passed. The saved PCB/project remain unchanged.

`pnpm verify` was run on 8 September. It reached coverage but failed the scoring application's existing global 100%
thresholds: lines 95.98%, statements 95.34%, branches 93.62%, functions 99.79%. This documentation review did not alter
firmware or thresholds. The electrical simulations executed during verification; observed continuity/scan cases passed,
including weak seven-short sensing at 0.6715V against 0.6510V. Those models do not simulate every component or certify
hardware. Targeted document formatting and `git diff --check` passed.

The project sets generic 0.2mm net-class clearance and enables creepage errors, but has no project `.kicad_dru` encoding
an isolation-barrier requirement. A clean DRC therefore does not prove the required primary-to-secondary separation. The
next physical review must trace both sides of U18/U6, all copper layers, mounting hardware and service/debugger
connections against an explicit design requirement, not silently equate 0.2mm fabrication clearance with safety.

Remaining desk-review order: (1) exact footprint/mechanical and isolation geometry; (2) power/capacitance/compensation
budgets; (3) supplier alternates and no-soldering assembly handoff. After assembly: controlled power-up, reset/suspend,
USB enumeration, sense thresholds, clock accuracy, IR range, Ethernet and both Favero outputs. Do not require these
prototype-dependent measurements to exist before building the prototype, and do not claim them as already passed.

Fresh top-side visual checkpoint: [KiCad render](output/component-review-top.png). This overview was inspected for gross
placement; it does not resolve individual pin/land-pattern alignment. U18 and J13 body visibility is an explicit
limitation, not an accepted omission.
