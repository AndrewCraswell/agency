# Prototype design review

Started 8 September 2026. Review the current native KiCad board and the `output/translator-clearance-review/` assembly
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

The table is the current disposition. Dated evidence below may describe earlier exports; the current assembly count is
223, not 230 or 231. A remaining measurement is not an unimplemented circuit change. Supplier confirmations require an
assembler response; physical safety and interoperability results require the assembled prototype.

**J2/J6 sourcing decision:** retain the exact Samtec headers; no substitute footprint or reroute is needed merely to
avoid the earlier supplier minimum quantities. On 8 September, DigiKey lists quantity-one pricing of $0.28 for
HTSW-105-07-L-S and $0.33 for HTSW-106-07-L-S. The five-position part is available-to-order/factory or marketplace
stock, not confirmed immediate DigiKey shelf stock; the six-position listing shows 290 in stock. At the listed ten-piece
breaks the pair is $0.521 per board, excluding freight/tax/assembly. These are catalog observations, not reserved stock
or a JLCPCB quote. Close the local alternate-selection question by retaining these parts; assembler sourcing/consignment
acceptance remains open. Do not purchase components independently without an accepted assembly route.
[J2 exact catalog entry](https://www.digikey.com/en/products/detail/samtec-inc/HTSW-105-07-L-S/6691705),
[J6 exact catalog entry](https://www.digikey.com/en/products/detail/samtec-inc/HTSW-106-07-L-S/6691750).

**Standalone power-path follow-up:** inspected the saved In2.Cu copper plot and native PANEL_5V polygon. U6 pin 6 and J8
pins 1/2 use the filled plane, with nominal 6mm main trunks, rather than relying on the narrow surface branches. No
disconnected panel supply or demonstrated reason to reroute it was found. The power guide now explicitly separates the
converter's shared 6A rating from the panel allowance. An exact panel maximum-current specification is missing;
full-white load, startup, shared-load headroom and thermal performance therefore remain unverified. This is a P1
selection/budget question, not a demonstrated defect or permission to buy a different panel. See
[standalone power boundary](usb-acquisition-power.md#standalone-display-power-boundary).

This follow-up's direct `pnpm --filter @repo/scoring-circuit simulate` passed. `pnpm verify` failed on unrelated
Shopify-content lint and cancelled concurrent checks; it is not a full pass. No schematic, footprint, route or BOM
changed.

**Current four-item disposition:** mechanical review has corrected J7/J8 hole sizing and U13/BZ1 body clearances;
remaining exact-package overlays and installed cable fit are still open. Power sizing and nominal simulations are
recorded, but attached-PD suspend consumption cannot be closed from the available guaranteed data. All-layer isolation
geometry is checked and the prototype operating constraints are explicit; system insulation approval is not established.
The refreshed `output/translator-clearance-review/` package passes ERC, DRC, parity and connectivity with 223 matching
assembly rows and the unchanged rebuilt U21 image. This is not closure of all four items or permission to manufacture.
The switch/ESD follow-up `pnpm verify` reached tests: all 46 scoring domain test files passed, but the existing 100%
coverage gate failed (95.98% lines, 99.79% functions, 95.34% statements, 93.62% branches). No threshold or unrelated
project file was changed. The native manufacturing package is unchanged by these documentation-only package checks. The
later regulator-package and inductor-review `pnpm verify` runs stopped at unrelated `packages/shopify-content` lint
errors in `catalog-snapshot.ts` and its test. Neither reached tests; the preceding scoring coverage failure is not a
fresh result from those runs. No board geometry changed, and focused document formatting/diff checks passed.

**Current supplier upload files:** the native exporter now generates `jlcpcb-bom.csv` and `jlcpcb-placement.csv`
alongside the original KiCad exports. All 223 rows were compared field by field: exact MPN/manufacturer/footprint and
reference agree, and coordinates, rotation and layer are unchanged. J14 and the seven removed regulator-support parts
are absent. Native ERC, DRC, schematic parity and unconnected counts are zero; the fresh U21 HEX retains SHA256
`80349F8D523EF5FF46FE6D8545EC02A0561F4723863381F4E8CC91668D38B132`. This resolves local upload formatting only. Native
footprint origins are not independently approved assembly centroids; supplier matching and placement preview remain
open. The old supplier draft was not updated or submitted. Repository verification is not clean: the scoring coverage
gate remains below its configured 100% thresholds; no threshold was reduced.
[JLCPCB BOM format](https://jlcpcb.com/help/article/bill-of-materials-for-pcb-assembly),
[placement format](https://jlcpcb.com/help/article/pick-place-file-for-pcb-assembly).

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

| Priority | Item / kind                                                                            | Evidence and latest state                                                                                                                                                                                                                                | Impact / estimated cost                                                                                                                           | Next action and required verification                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | U18/U19/U21 whole-input suspend budget — margin not established                        | [Power guide](usb-acquisition-power.md#input-side-review) retains a conservative 4mA VLO allowance. U21 shallow sleep is implemented, but total input power and the calculation requiring 96.3% efficiency remain unvalidated.                           | Potential unsupported laptop/source combinations. No measured saving from firmware yet.                                                           | Complete enabled-load and regulator analysis; measure whole-input current and tick/alert/watchdog behavior. Do not assume firmware sleep closes the budget.                                                     |
| P1       | U21 initial programming and U5 configuration — image handoff implemented; service open | Current 223-part export includes rebuilt HEX; U21 controller tests and C/C++ coverage passed previously. Pogo geometry checked; no physical programming performed.                                                                                       | A fully soldered board still needs programming. Fixture/service charge unknown.                                                                   | Obtain assembler confirmation for pogo programming, stable VLO, HEX readback and U5 defaults. No service purchased or board flashed.                                                                            |
| P1       | U18 LTM2884 assembly profile — assembler confirmation                                  | Existing supplier handoff records MSL4 and 245 C maximum peak; supplier engineering acceptance remains absent. Exact export uses LTM2884IY#PBF.                                                                                                          | Risk of assembly damage or rejected assembly. No justified replacement or cost saving yet.                                                        | Recheck exact package handling documentation and obtain assembler process acceptance. LLM review cannot certify their oven profile or moisture handling.                                                        |
| P1       | Isolation and unpowered paths — local geometry complete; system rating open            | All-layer projected copper gap is 2.50mm with no primary/secondary overlap; only U6/U18 span domains. Prototype source and grounding constraints are recorded below.                                                                                     | No new components or routing. This is not a certified board insulation rating.                                                                    | Local copper review complete. Before fencer use, obtain system safety review and verify external grounds, enclosure and assembled insulation; these are not missing PCB routing.                                |
| P1       | Supplier substitutions across the entire BOM — open review                             | Prior matching session found X5R proposed for specified X7R; current canonical export retains selected MPNs. Supplier matches are not approved design substitutions.                                                                                     | Capacitance, bias, temperature or footprint mismatch. Savings not yet established.                                                                | Review exact alternate datasheets and each circuit role, including effective capacitance and package dimensions. Approve explicit substitutions only, then reconcile BOM, schematic and supplier selection.     |
| P2       | Power guide scan timing — corrected                                                    | Guide now describes 40us slots / 120us frames, checked against the decoder and acquisition tests. Physical timing remains a bench check.                                                                                                                 | Misleading firmware handoff; no component cost.                                                                                                   | Correction implemented in this review slice; no timing or resistor changes.                                                                                                                                     |
| P2       | Prototype order color conflicts with README — resolved                                 | Consolidated handoff specifies standard green mask and white silkscreen, independent of black 3D rendering.                                                                                                                                              | Removes conflicting order instructions; no circuit change.                                                                                        | Verify green in the final supplier order; no order submitted.                                                                                                                                                   |
| P2       | Header/capacitor selection — local selection complete; procurement open                | Retain exact J2/J6; distributor quantity-one catalog options found. C56/C64/C65 replacements are already implemented. No header redesign or substitute required.                                                                                         | May reduce minimum-order waste and delay without adding components. Savings unpriced until equivalent parts and assembly quantities are verified. | Confirm assembler sourcing/consignment, stock and exact capacitor matches against current 223-part export. No procurement approved.                                                                             |
| P2       | U21 idle CPU power — shallow sleep implemented                                         | Qualified, alert-free target now sleeps until nominal 1ms SysTick. Unknown supplies, transactions and error paths remain awake. Native policy/transport tests pass; ARM vector and WFI instructions inspected. The P1 total suspend budget remains open. | No BOM increase; reduces idle CPU activity without new USB-state detection. No measured current saving claimed.                                   | Implementation complete; tick/wake, alert response, watchdog and input-power measurements require hardware. Suspend-budget uncertainty is tracked in the P1 row.                                                |
| P3       | Broader power-module consolidation — unassessed opportunity                            | Current decision intentionally retains LTM2884 and REC30K to avoid a discrete isolation redesign. No equivalent simpler replacement has been established.                                                                                                | Potential BOM savings versus isolation, layout, sourcing and revalidation cost; estimate pending evidence.                                        | Critic may propose exact alternatives with a complete replacement BOM and preserved functionality. Do not reopen the settled topology solely because individual module prices look high.                        |
| P1       | Physical footprints and assembly orientation — corrected connector/body defects        | J7/J8, U13/BZ1 and U10/U11 clearance fixes pass native DRC. Completed package/pin checks are below; remaining overlays and installed cable envelopes are still open.                                                                                     | Removes identified fit/clearance defects without changing circuit functions.                                                                      | Finish remaining package overlays and assembler placement/cable acceptance; do not treat missing CAD as a missing BOM part.                                                                                     |
| P1       | U19 primary regulator — migration implemented, margins still open                      | LTC3130-1 fixed 5V automatic Burst/PWM replaces the Burst-only circuit. Seven support parts removed. Native ERC/DRC/parity pass; both nominal manufacturer-model load steps pass.                                                                        | Removes the operating-mode mismatch and external compensation; no complete price saving claimed.                                                  | Finish whole-input suspend and physical startup/thermal verification; reconcile assembly quote for the exact new parts.                                                                                         |
| P1       | J3/J4/J5 external harness assembly — handoff gap                                       | These are internal Samtec headers, not the fencer banana sockets or piste socket.                                                                                                                                                                        | A soldered PCB alone is not a finished cable-ready scoring box. Harness/socket quote is separate and unknown.                                     | Include mating sockets, harness pinout and assembly responsibility in the order if the delivered unit must need no soldering. Existing owner-validated weapon cable is not being reopened.                      |
| P2       | USB_GND copper island — resolved in saved native board                                 | Saved copper correction and subsequent current export report zero configured DRC, parity and unconnected issues. No remaining local island fix.                                                                                                          | Stale floating copper corrected; no component or routing change and zero BOM cost.                                                                | Resolved and included in translator-clearance-review export; replace the obsolete supplier upload during final reconciliation.                                                                                  |
| P2       | Raw VBUS capacitance accounting — updated                                              | C1/C36/C39/C40/C50 now total 1+1+4.7+1+0.1 = 7.8uF nominal; 8.58uF at +10%, before IC/parasitic capacitance.                                                                                                                                             | Correct input budget after the VIN bypass change.                                                                                                 | Include effective capacitance, IC input capacitance and startup behavior before a USB compliance claim.                                                                                                         |
| P2       | Y1/Y2 and crystal loads — selection calculation passed; tuning open                    | Y1 nominal-load gmcrit is 1.263mA/V versus 1.5mA/V limit. Its 27pF capacitors assume 4.5pF effective stray. Y2's 18pF capacitors match WIZnet reference. Calculation below; not a measured frequency result.                                             | Startup/frequency margin; likely small passive cost if tuning needed, unpriced.                                                                   | Nominal selection calculation complete; verify effective load and drive level. Measure frequency/startup on prototype; do not change values from this simple series calculation alone.                          |
| P2       | Current versus historical README component descriptions — resolved                     | Replaced obsolete build snapshots with the current 223-part assembly handoff; retained sensing requirements and low-volume scope. Export now includes handoff, review and power documents.                                                               | Removes obsolete component counts, control wiring and capacitor candidates from procurement guidance.                                             | Native export verified with matching parts and fresh U21 image; supplier draft still needs replacement.                                                                                                         |
| P2       | Favero output loading — bench verification required                                    | U16/U17, R38–R43 and D10/D11 provide mirrored optodarlington outputs. Netlist proves neither receiver threshold nor release time with actual cable/load.                                                                                                 | Repeater interoperability. No change or saving established.                                                                                       | Test both ports with actual FA-05-compatible repeaters; measure current, polarity, rise/release times and simultaneous operation. Prototype-dependent test, not a demand for hardware before ordering hardware. |
| P3       | R74–R86 resistor-array consolidation — candidate evaluated                             | YC164-FR-0710KL preserves 10k/1%; three arrays plus R86 would reduce 13 placements to four. Native net grouping checked; no substitution implemented.                                                                                                    | Potential small placement saving; quote unavailable, engineering cost may dominate at 3–10 boards/month.                                          | Obtain exact manufacturer pin/land drawing and assembly pricing, then assess local reroute. Preserve independent signal pull-downs and OE default.                                                              |
| P2       | Missing bodies in fresh 3D render — confirmed model limitations                        | U18 and U20 have no assigned model. J13 references an unavailable installed-library body. J14 is deliberately bare pads.                                                                                                                                 | Limits visual seating/orientation review, not proof of missing electrical components. No BOM increase.                                            | Use exact manufacturer envelopes/drawings for checks; restore authentic models when available. Do not invent shapes as proof.                                                                                   |

## Review coverage and critic protocol

### ESP32 memory, boot and antenna check

U2's exact N8R8 module retains GPIO35/36/37 (pads 28–30) unused, as required for its octal PSRAM. GPIO47/48 carry the
processor UART; the 1.8V restriction for the R16V variant is not a reason to reject the selected R8 module. GPIO45/46
remain unconnected to external loads; GPIO0 has R29's 10k pull-up and SW3 grounding it for download. R28/C21 provide EN
pull-up/delay and SW2 resets it. UART0 RX/TX reach J6 pins 4/3; J6 also exposes EN/BOOT. This is pin/strap wiring
review, not demonstrated flashing or application firmware operation.
[Espressif module datasheet v1.8, pin and boot tables](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf).

Native U2 antenna area is x137–155, y55.25–61.25mm. The existing keepout spans x122–170, y40.25–61.25mm, with pads,
tracks, vias, fills and footprints prohibited on all four copper layers. Intersecting actual pad/track/via polygons and
saved filled zones with its 1um-inset interior found no copper on any layer. This checks the saved region, not RF
performance. The antenna remains over substrate, 5.25mm inside the top board edge; Espressif prefers an antenna
overhanging the base board, otherwise a cutout, and clearance in the enclosure. Retain this prototype placement pending
RF range/throughput testing; do not describe the copper-free region as equivalent to a substrate cutout or
certification.
[Espressif module-placement guidance](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html#general-principles-of-pcb-layout-for-modules-positioning-a-module-on-a-base-board).
No pin, route, part or board outline changed.

Focused native pin/net and copper-intersection checks passed. The full `pnpm verify` rerun passed checks and eight
electrical models, then stopped at the existing scoring-domain 100% coverage thresholds. Formatting and scoped diff
checks passed; no threshold or unrelated source was changed.

### Core regulator capacitor review

U4's saved pads match the AP2112 SOT25 pin table: 1 VIN and 3 EN on CORE_5V, 2 GND, 4 unused, 5 CORE_3V3. C2 and C3
select TDK C1608X7R1H105K080AB, 1uF X7R, as recommended by Diodes' reference circuit. The exact TDK curve was visually
inspected: approximately 1uF at 3.3V and 0.95uF at 5V, before tolerance/temperature/aging. The pronounced 20–50V bias
loss does not describe this 3.3–5V application. These are typical curves, not guaranteed minima.

C3's supply pad is about 2.29mm from U4 VOUT in a straight line; C2's is about 2.26mm from VIN. These are pad distances,
not routed inductance measurements. C15/C33 add two more nominal 1uF capacitors on CORE_3V3, alongside MCU/buffer bypass
and C14; do not treat remote capacitance as a replacement for local bypass. There is no demonstrated capacitance defect
from nominal selection alone. Retain the parts and verify local ripple/load steps and startup on the assembled board.

[AP2112 reference circuit and pin table](https://www.diodes.com/datasheet/download/AP2112.pdf),
[exact capacitor curves, page 2](https://www.farnell.com/datasheets/4491452.pdf). No board, BOM or supplier substitution
changed. This is a component-selection check, not measured loop stability.

Verification for this review: native pad/net inspection and document formatting/diff checks passed; no design files
changed. `pnpm verify` passed checks and eight electrical models, then failed the unchanged scoring-domain coverage
thresholds (95.98% lines, 99.79% functions, 95.34% statements, 93.62% branches). Unrelated web workflow tests also
reported failures. The repository-wide run is not clean; neither thresholds nor unrelated code were changed.

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

| Priority | Item                     | Latest state                                                                                                               | Remaining action                                                                                                               |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| P2       | JLCPCB upload formatting | Resolved locally: 223 BOM and placement rows match the fresh native export, with zero ERC/DRC/parity/unconnected findings. | Replace stale supplier files and review catalog matches, centroids and orientations before approval; no submission authorized. |

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

**Resistor-array feasibility:** YC164-FR-0710KL is a concrete candidate: four isolated 10k, 1% elements in an 8-pin 3.2
by 1.6mm package, preserving the existing resistance/tolerance rather than silently substituting the 5% JR version.
Three arrays could replace R74-R85 while retaining R86 (OE), reducing this group from 13 placements to four. Native nets
confirm every resistor is a separate signal-to-GND pull-down; an isolated array must keep those signals separate. At
3.6V and 9.9k, each element dissipates about 1.31mW versus the catalog 62.5mW rating, before thermal derating.

DigiKey's observed cut-tape prices are $0.11 each at one and $0.0492 at 50: three arrays cost $0.33 for one board, or
$0.1476 per board for 30 boards buying 90 arrays, plus the retained resistor, freight and assembly. These are costs, not
demonstrated savings. R74-R85 are distributed across the two buffer groups; this requires schematic replacement, new
footprints and local rerouting, not a BOM-only substitution. Exact manufacturer pin/land drawing, supplier matching,
post-route checks and net-equivalence review remain necessary before implementation. No array has been installed.
[Exact 1% candidate catalog](https://www.digikey.com/en/products/detail/yageo/YC164-FR-0710KL/5952601).

**J2/J3/J4/J5/J6/J12 header check:** visually checked Samtec F-224 Rev 01OCT24. Selected HTSW straight -07, -L,
single-row parts have 2.54mm pitch, nominal 0.635mm square pins, 2.54mm tails and 5.84mm mating posts. Native holes are
1.02mm throughout, exceeding the nominal pin diagonal of 0.898mm; no drill change indicated. The catalog's explicit 1.02
+/-0.03mm recommendation is under the optional -LL locking-lead section, not an unconditional tolerance guarantee for
our plain parts. Finished-hole/insertion tolerances remain the assembler's responsibility.

Native numbering agrees with the handoff: J3/J4 pins 1/2/3 are A/B/C; J5 is PISTE. J2 is CORE_3V3/SWDIO/SWCLK/GND/
RESET; J6 is APP_3V3/GND/TX/RX/EN/BOOT; J12 is USB_GND/SDA/SCL. These unshrouded headers are not polarized: retain pin-1
identification and explicit harness wiring rather than claiming they prevent reversed insertion. No part removed.
[Samtec series and lead-style drawing](https://suddendocs.samtec.com/catalog_english/htsw_th.pdf).

**U5 electrical pin check:** compared all 24 numbered pins and grounded exposed pad against DS12499 Rev 8 table 1.
CC1DB/CC2DB join their corresponding CC inputs; RESET, address inputs and unused VSYS are grounded. C37/C38 provide the
specified 1uF bypasses on VREG_1V2/VREG_2V7. Pin 16 VBUS_EN_SNK carries the board's PD_ATTACH_N net; it is not pin 11
ATTACH, which is intentionally unused. ALERT and POWER_OK2 reach their named nets; VDD is USB_VBUS and pin 18 senses it
through R88. No pin mismatch found. Physical NVM contents and attached-source behavior remain unverified.
[ST pin-function table](https://www.st.com/resource/en/datasheet/stusb4500.pdf).

U5's package comparison is complete: visually inspected the ST-authored Rev 5 mirror, pages 31/32, and compared table 23
against current Rev 8. The QFN dimensions agree. Native 0.6 by 0.25mm lands on 0.5mm pitch, 4.4mm overall land span and
2.7mm grounded exposed pad match the recommended pattern. The four unnumbered 1.09mm-square paste windows are not extra
electrical terminals. No footprint change is needed; stencil/process acceptance and solder-joint inspection remain
assembly responsibilities. The drawing's bottom view was distinguished from the board's top view.
[ST-authored visual mirror](https://static.chipdip.ru/lib/202/DOC012202661.pdf).

**D1/D2 and D10/D11 package/polarity check:** visually compared Vishay drawings 88746 (23-Apr-2020) and 88503
(29-Apr-2020), pages 1/4, with native pads. D1/D2's 2.5 by 1.8mm SMA lands exceed the 1.52 by 1.68mm minima; their 1.5mm
inner gap is below the 1.88mm maximum. Cathode pad 1 goes to CORE_5V on both, and anodes go to the two isolated
supplies. No footprint or polarity correction is indicated. Reverse leakage is not zero; retain the existing
unpowered-domain measurement requirement.

D10/D11 have 1.1mm holes for the 1N4004's maximum 0.86mm lead, with 2.2mm lands on 10.16mm centers. Do not apply the
smaller 0.66mm lead specification of 1N4004E to the selected 1N4004-E3/54: E3 denotes finish, not that reduced-lead
variant. Factory lead forming/trim is required. Cathode pad 1 is at each optocoupler collector, anode 2 at its emitter,
correct for the reverse shunt. This does not establish arbitrary powered-port fault survival or cable compatibility.
[SS14 drawing](https://www.vishay.com/docs/88746/ss12.pdf),
[1N4004 drawing](https://www.vishay.com/docs/88503/1n4001.pdf).

**U16/U17 optocoupler package check:** visually reviewed onsemi H11B1M/D Rev 2 (April 2022), ordering table page 8 and
CASE 646BX drawing page 9. The orderable-system footnote explicitly includes 4N32M: plain DIP-6, not the SMT S suffix or
0.4-inch T suffix. Both native footprints have 2.54mm pitch, 7.62mm rows, 0.9mm holes and 1.8mm lands. The maximum 0.51
by 0.30mm pin section has a 0.592mm diagonal, smaller than the nominal drill; finished-hole tolerance remains an
assembler check. The supplied leads are splayed and require normal DIP insertion forming, not a wider PCB row spacing.
Native pin 1/2 LED, 3 NC, 4 emitter, 5 collector and 6 base agree for both 90-degree placements. No footprint change is
warranted. Actual Favero receiver load, saturation and release time remain bench tests, not established by this package
check. The plain M ordering code must not inherit the optional V-code insulation certification claim.
[onsemi exact family and package drawing](https://www.onsemi.com/download/data-sheet/pdf/h11b1m-d.pdf).

**U12 W5500 package/pin review:** visually checked manufacturer datasheet 1.1.0 pages 7/64/65 and compared all 48 native
pad nets, including the footprint's 90-degree rotation. Its 0.5mm pitch, 1.475 by 0.3mm lands and 8.325mm opposing-row
spacing cover the nominal lead regions; drawing lead width is at most 0.27mm. The body envelope fits the saved
courtyard. The changed bottom molding mark described in the datasheet is not an exposed electrical pad or a requirement
for an extra PCB hole. No package replacement or reroute is justified by this check.

Analog/digital supplies, TX/RX pairs, SPI, crystal and reset pins agree. Reserved pin 23 is grounded as required; 38-42
are NC. PMODE2/1/0 are high for all-capable auto-negotiation. DNC/NC and unused LED outputs are intentionally
unconnected. This closes the pin/package comparison, not physical Ethernet signal integrity or reset/startup testing.
[WIZnet exact device drawing and pin descriptions](https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf).

Scoped formatting/diff checks passed. The follow-up `pnpm verify` stopped at unrelated Shopify-content lint; no
full-suite pass is claimed. Native geometry and the current manufacturing package are unchanged.

**U1/U21 package comparison:** visually inspected ST-authored mirrored DS12288 Rev 4 pages 212/213 and DS13866 Rev 3
pages 86/87. Compared the dimensions and drawing identifiers against current official DS12288 Rev 6 pages 210/211 and
DS13866 Rev 5 pages 87/88; the reviewed package dimensions agree. The mirror is not represented as the latest revision.
U1 has 64 lands on 0.5mm pitch, 1.55 by 0.3mm lands and 11.35mm opposing-row centers. U21 has 20 lands on 0.65mm pitch,
1.475 by 0.4mm lands and 5.725mm row centers. Pin-number progression agrees after rotating the drawing to the native
footprint orientation (U1 placement 0 degrees, U21 90 degrees). Neither pattern is mirrored.

The land widths exceed the respective 0.27/0.30mm maximum lead widths and cover the nominal lead landing regions. They
are library patterns, not exact copies of ST's 1.2 by 0.3mm and 1.35 by 0.4mm example lands. No lead/pad mismatch
requiring a processor footprint change was found. This is package geometry review, not new functional pin validation,
solder-process approval or measured MCU operation. U21's body courtyard has little allowance beyond the maximum
molding-flash envelope; assembler placement clearance remains part of the final assembly review.
[Current G474 drawing](https://www.st.com/resource/en/datasheet/stm32g474re.pdf),
[G474 visual mirror](https://www.32mcu.com/pdf/PDF_4/STM32G474RE.pdf),
[current C011 drawing](https://www.st.com/resource/en/datasheet/stm32c011f6.pdf),
[C011 visual mirror](https://www.32mcu.com/pdf/PDF_4/STM32C011F6.pdf).

**U10/U11 translator follow-up:** native VCCA/GND/A/B/DIR/VCCB pin order matches TI SCES882E. U10 DIR selects STM_TX to
ESP_RX; U11 selects ESP_TX to STM_RX. Their 0.65mm-pitch lands cover nominal leads, but the original body courtyard had
minimal margin. A local SN74AXC1T45DCKR footprint now has a 3.2 by 3.0mm courtyard covering the 2.15 by 1.4mm maximum
body, the drawing's protrusion allowance and additional clearance. Both schematic assignments use that local footprint.
Pads, models, positions and routes are unchanged; the larger outline is an assembly-clearance correction, not a
demonstrated short circuit.

TI specifies high-impedance outputs below 100mV on either supply; partial-power-down leakage is at most 5uA per data
port through 85 C, 7.5uA through 125 C under the stated test conditions. Do not assume zero leakage or apply that limit
to intermediate ramp voltages. Retain both devices for switched-domain UART protection, not galvanic isolation. Verify
residual APP_3V3 voltage and startup UART behavior on hardware.
[TI pin, leakage and DCK0006A drawings, pages 3/6 and PDF pages 30/31](https://www.ti.com/lit/ds/symlink/sn74axc1t45.pdf).

Fresh `output/translator-clearance-review/` export passes ERC/DRC/parity/connectivity and has 223 matching assembly
rows. U21's rebuilt image hash is unchanged. This closes the clearance correction, not factory or bench acceptance.
Scoped formatting/diff checks passed; full `pnpm verify` still fails unrelated Shopify-content lint. No checks were
relaxed.

**U8/U9 and U14/U15 buffer package/pin review:** all four native TSSOP footprints have 0.65mm pitch, 5.725mm row spacing
and 1.475 by 0.4mm lands. Visually checked Nexperia 74LVC125A revision 12 (2 May 2025), pages 3/10, and TI SN74AHCT541
revision Q, pages 3 and physical PDF pages 23/24. Both drawings allow 0.30mm maximum lead width and 6.6mm maximum lead
span, covered by the native lands. The 5.1 by 4.5mm and 6.6 by 4.5mm maximum bodies fit their saved courtyards. TI's
example lands are 1.5 by 0.45mm on 5.8mm rows; the library alternative is not an exact copy but no nominal lead-landing
defect was found. Final solder-process acceptance remains with the assembler.

U8/U9 OE pins 1/4/10/13, inputs 2/5/9/12, outputs 3/6/8/11, GND 7 and VCC 14 match every native connection. U8's unused
fourth channel is disabled with input grounded and output NC. U14/U15 inputs 2-9 map to outputs 18-11; OE1 is grounded,
OE2 is Q1-controlled, GND is 10 and VCC is 20. U15's three unused inputs are grounded and outputs NC. Retain all four:
the two display buffers provide thirteen required channels. This closes the package/pin check, not loaded cable timing,
startup blanking or fault behavior.
[Nexperia driver drawing](https://assets.nexperia.com/documents/data-sheet/74LVC125A.pdf),
[TI display buffer drawing](https://www.ti.com/lit/ds/symlink/sn74ahct541.pdf).

This document-only follow-up passed formatting and scoped diff checks. `pnpm verify` again stopped on unrelated
Shopify-content lint; concurrent checks were cancelled. No board geometry, BOM or supplier selection changed.

**Q1-Q6 and D3-D9 package/pin review:** visually compared Diodes DMN2056U DS38480 revision 2-2 pages 1/7 and Nexperia
BAT54S (1 July 2022) pages 1/5/6. All thirteen native footprints use 1.475 by 0.6mm lands, 1.9mm paired-pin pitch and
1.875mm opposing-row spacing. The maximum lead widths (0.51mm MOSFET, 0.48mm diode) fit the land width; nominal lead
landing regions are covered. These are library lands, not identical manufacturer recommended patterns. The maximum 3.0
by 1.4mm bodies fit the saved courtyard body envelopes. No demonstrated fit defect was found; retain the parts and land
patterns, with final solder process/placement tolerance acceptance by the assembler.

Every instance was checked by pad number: Q1-Q6 are gate 1, source 2, drain 3, including Q6's rotated footprint. Q1-Q3
sources use scoring GND; Q4-Q6 use USB_GND. D3-D9 have anode 1 at GND, cathode 2 at CORE_3V3, and the series midpoint 3
at the respective sense conductor. Neither a swapped series-diode orientation nor a MOSFET source/drain swap was found.
This closes this package/pin comparison, not clamp-injection, gate-transient or unpowered bench tests. Focused
formatting/diff checks passed. The follow-up `pnpm verify` again failed unrelated Shopify-content lint; no new
full-suite pass or hardware verification is claimed. Board and manufacturing geometry are unchanged.
[DMN2056U drawing and terminal layout](https://www.diodes.com/datasheet/download/DMN2056U.pdf),
[BAT54S drawing and terminal layout](https://assets.nexperia.com/documents/data-sheet/BAT54S.pdf).

**L1/L2 fit and current screen:** Coilcraft document 908, revised 26 February 2026, was visually reviewed. Both
footprints match its 1.18 by 4.70mm lands on 3.31mm centers. The 5.28 +/-0.2 by 5.48 +/-0.2mm bodies fit their 5.98 by
6.18mm courtyards; maximum heights are 3.1mm for L1 and 5.1mm for L2. L1 is 4.7uH, 40mOhm maximum DCR, 6.7A saturation
current; L2 is 10uH, 45mOhm maximum DCR, 4.9A saturation current. Those saturation figures describe a typical 30%
inductance drop at 25 C, not a guaranteed all-temperature threshold. The reference 20 C temperature-rise currents are
4.3A/3.6A respectively and depend on mounting/cooling. Retain both exact parts.
[Coilcraft XAL50xx, pages 1 and 4](https://www.coilcraft.com/getmedia/49bc46c8-4b2c-45b9-9b6c-2eaa235ea698/xal50xx.pdf).

L1's 6.7A figure exceeds AP63203's 3.1A maximum high-side peak-limit threshold; L2's 4.9A exceeds LTC3130-1's 1.7A
maximum peak-limit threshold. This is a useful selection screen, not protection against every transient or a thermal
test. At 2A RMS L1's cold DC copper loss is 0.16W; using even 1.7A RMS for L2 gives 0.130W, before core loss and DCR
temperature rise. Confirm peak/RMS current and winding temperature in the assembled regulator load-step tests.
[AP63203 electrical characteristics](https://www.diodes.com/assets/Datasheets/AP63200-AP63201-AP63203-AP63205.pdf),
[LTC3130-1 electrical characteristics](https://www.analog.com/media/en/technical-documentation/data-sheets/3130f.pdf).
The power guide's stale 100nF bootstrap description was corrected to the already-fitted 22nF C42/C66; no circuit
changed.

**U4/U7 package comparison:** visually checked Diodes' SOT25 and TSOT26 drawings. Both native footprints have 0.95mm
lead pitch, 2.275mm row-center separation and 1.325 by 0.6mm lands. These are library land patterns, not exact copies of
the manufacturer's suggested pads: U4 suggests 0.8 by 0.55mm lands on 2.4mm rows; U7 suggests 1.0 by 0.7mm lands on
2.2mm rows. Native lands cover the nominal lead landing regions; U4's maximum 0.50mm and U7's maximum 0.45mm lead widths
are smaller than the 0.6mm lands. Their maximum body outlines fit the existing courtyards. No demonstrated fit defect or
reason for a speculative reroute was found; final stencil, placement tolerance and solder-joint acceptance remain
assembler checks. The U4 pin map is VIN/GND/EN/NC/VOUT, with EN tied to CORE_5V. U7 is FB/EN/VIN/GND/SW/BST, with FB at
APP_3V3 and EN/VIN at PANEL_5V. No footprint, routing or parts changed.
[AP2112, pages 1–2 and 14](https://www.diodes.com/assets/Datasheets/AP2112.pdf),
[AP63203, pages 1–2 and 17](https://www.diodes.com/assets/Datasheets/AP63200-AP63201-AP63203-AP63205.pdf).

**Switch/USB-protection package pass:** SW1/SW2/SW3 each use four 1.7 by 1.0mm lands at local x=+/-3.15, y=+/-1.90mm,
matching E-Switch P010632 revision J's 8.0/4.6mm outer/inner horizontal and 4.8/2.8mm vertical edges. The duplicated
KiCad pad numbers group each horizontal pair, consistent with the manufacturer's SPST drawing; pressing connects
STM_RESET_N, ESP_EN or ESP_BOOT0 respectively to GND, not an already-shorted contact pair. The drawing was visually
reviewed; no placement, copper or BOM changes were required.
[Exact TL3342F160QG drawing](https://configured-product-images.s3.amazonaws.com/2D/specs/TL3342F160QG.pdf).

U3's three 0.95 by 0.4mm lands match TI DCK0003A: local centers (-1.1,-0.65), (-1.1,0.65), (1.1,0)mm. Visually checked
both TI's top-view pin diagram and board-layout drawing: 1/2 protect USB_HOST_DP/DM and 3 is USB_GND. This is the
selected three-pin DCK package, not the five-pin DRL alternative. No footprint change is needed.
[TI TPD2E2U06 revision C, page 3 and DCK0003A board layout](https://www.ti.com/lit/ds/symlink/tpd2e2u06.pdf).

Source: current native schematic netlist, board pad nets and the 223-row manufacturing BOM. Exact MPNs are retained here
to prevent a nominal-value substitution from being mistaken for the reviewed part. Each row records electrical purpose
and present disposition. Shared open checks in the findings table apply to all affected rows. This is an inventory of
review results and limitations, **not passing laboratory tests or verified mechanical models**.

J14 is deliberately absent from the populated BOM: it is the primary-domain SWD pad set for U21 (VLO, USB_GND, SWDIO,
SWCLK, NRST). Retain probe access; it must not be mistaken for another domain's grounded programming connector.

| Reference | Exact MPN             | Circuit role evaluated                                                           | Disposition / remaining verification                                                                                                                                   |
| --------- | --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BZ1       | PS1240P02BT           | Piezo sound output across CORE_3V3 and Q2 drain; R87 discharges the piezo.       | Retain; verify audible output and drive waveform on assembled board.                                                                                                   |
| C1        | C1608X7R1H105K080AB   | Raw USB VBUS bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C2        | C1608X7R1H105K080AB   | AP2112 input bypass on CORE_5V                                                   | Retain; core-regulator capacitor selection and low-voltage bias curve checked below. Typical curves do not establish measured stability; supplier identity must match. |
| C3        | C1608X7R1H105K080AB   | AP2112 output bypass on CORE_3V3                                                 | Retain; core-regulator capacitor selection and low-voltage bias curve checked below. Typical curves do not establish measured stability; supplier identity must match. |
| C4        | C1608X7R1H104K080AA   | AP63203 bootstrap capacitor, BST to SW                                           | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C5        | C1608X5R1C106M080AB   | AP63203 PANEL_5V input reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C6        | GRM32ER71E226KE15L    | APP_3V3 output reservoir, parallel with C7                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C7        | GRM32ER71E226KE15L    | APP_3V3 output reservoir, parallel with C6                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C8        | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C9        | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C10       | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C11       | C1608X7R1H104K080AA   | STM32 CORE_3V3 VDD bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C12       | C1608X7R1H103K080AA   | STM32 analog supply high-frequency bypass                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C13       | C1608X7R1H104K080AA   | STM32 analog supply bypass                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C14       | C1608X7S1A475K080AC   | STM32 analog supply reservoir                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C15       | C1608X7R1H105K080AB   | STM32 CORE_3V3 reservoir                                                         | Retain; core-regulator capacitor selection and low-voltage bias curve checked below. Typical curves do not establish measured stability; supplier identity must match. |
| C16       | C1608X7R1H104K080AA   | STM32 reset filtering                                                            | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C17       | CGA3E2C0G1H270J080AA  | 8MHz HSE input load                                                              | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                              |
| C18       | CGA3E2C0G1H270J080AA  | 8MHz HSE output load                                                             | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                              |
| C19       | C1608X7R1H104K080AA   | U8 conductor-buffer bypass                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C20       | C1608X7R1H104K080AA   | U9 conductor-buffer bypass                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C21       | C1608X7R1H105K080AB   | ESP32 EN startup delay                                                           | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C22       | C1608X5R1C106M080AB   | ESP32 APP_3V3 reservoir                                                          | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C23       | C1608X7R1H104K080AA   | ESP32 APP_3V3 bypass                                                             | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C24       | C1608X7R1H104K080AA   | U10 CORE-side bypass                                                             | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C25       | C1608X7R1H104K080AA   | U10 APP-side bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C26       | C1608X7R1H104K080AA   | U11 CORE-side bypass                                                             | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C27       | C1608X7R1H104K080AA   | U11 APP-side bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C28       | C1608X5R1C106M080AB   | Ethernet APP_3V3 reservoir                                                       | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C29       | C1608X7R1H104K080AA   | Ethernet digital supply bypass                                                   | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C30       | C1608X7R1H104K080AA   | IR receiver filtered supply bypass                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C31       | C1608X7R1H104K080AA   | U14 PANEL_5V bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C32       | C1608X7R1H104K080AA   | U15 PANEL_5V bypass                                                              | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C33       | C1608X7R1H105K080AB   | STM32 reference/analog reservoir                                                 | Retain; core-regulator capacitor selection and low-voltage bias curve checked below. Typical curves do not establish measured stability; supplier identity must match. |
| C34       | C1608X7R1H104K080AA   | STM32 reference/analog bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C35       | C1608X7R1H104K080AA   | Sounder CORE_3V3 bypass                                                          | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C36       | C2012X7R1H105K125AB   | STUSB4500 raw VBUS bypass                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C37       | C1608X7R1H105K080AB   | STUSB4500 VREG1V2 bypass                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C38       | C1608X7R1H105K080AB   | STUSB4500 VREG2V7 bypass                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C39       | C4532X7R1H475K200KB   | LTC3130 raw VBUS input reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C40       | C2012X7R1H105K125AB   | LTC3130 raw VBUS 1uF VIN bypass                                                  | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C41       | C2012X5R1C475K125AC   | LTC3130 VCC bypass                                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C42       | C1608X7R1H223K080AA   | LTC3130 22nF BST1-to-SW1 bootstrap                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C43       | C4532X5R1A476M280KA   | LTC3130 USB_PRIMARY_5V reservoir                                                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C45       | C1608X7R1H103K080AA   | eFuse output slew timing                                                         | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C46       | C2012X7R2A104K125AA   | REC30K switched-input bypass                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C47       | C3225X7R1H106K250AC   | REC30K switched-input reservoir                                                  | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C48       | C1608X7R1H104K080AA   | REC30K PANEL_5V bypass                                                           | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C49       | C3216X7R1C106K160AC   | REC30K PANEL_5V reservoir                                                        | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C50       | C2012X7R2A104K125AA   | Additional raw VBUS bypass; omitted from guide's capacitance sum                 | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C51       | C1608X7R1H223K080AA   | Ethernet TX center-tap filter                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C52       | C1608X7R1H682K080AA   | Ethernet RX+ series coupling                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C53       | C1608X7R1H682K080AA   | Ethernet RX- series coupling                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C54       | C1608X7R1H103K080AA   | Ethernet RX termination midpoint bypass                                          | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C55       | C1608X7R1H103K080AA   | W5500 1V2O bypass                                                                | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C56       | C1608X5R1C475K080AC   | W5500 TOCAP reservoir                                                            | Selected in-production 16V TDK replacement; dimensions and bias curves compared. Supplier quantity and bench behavior remain open.                                     |
| C57       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C58       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C59       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C60       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C61       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C62       | C1608X7R1H104K080AA   | W5500 analog VDD local bypass                                                    | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C63       | C2012X5R1A106K125AC   | Ethernet filtered analog reservoir                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C64       | CC0603JRNPO9BN180     | 25MHz Ethernet crystal input load                                                | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                              |
| C65       | CC0603JRNPO9BN180     | 25MHz Ethernet crystal output load                                               | Retain C0G; oscillator load/stray-capacitance budget and startup measurement remain open.                                                                              |
| C66       | C1608X7R1H223K080AA   | LTC3130 22nF BST2-to-SW2 bootstrap                                               | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C69       | C1608X7R1H104K080AA   | Power-controller VLO bypass                                                      | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C70       | C1608X5R1A105K080AC   | Power-controller VLO reservoir                                                   | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| C71       | C1608X7R1H104K080AA   | Power-controller NRST filter                                                     | Retain; correct supply/signal role. Check effective capacitance and exact supplier substitution, not nominal value alone.                                              |
| D1        | SS14-E3/61T           | Isolated USB 5V anode to CORE_5V cathode.                                        | Retain; SMA land dimensions and cathode-to-CORE_5V polarity checked. Forward drop and unpowered-domain leakage remain power/bench checks.                              |
| D2        | SS14-E3/61T           | PANEL_5V anode to CORE_5V cathode.                                               | Retain; SMA land dimensions and cathode-to-CORE_5V polarity checked. Forward drop and unpowered-domain leakage remain power/bench checks.                              |
| D3        | BAT54S,215            | left A sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.         | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D4        | BAT54S,215            | left B sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.         | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D5        | BAT54S,215            | left C sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.         | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D6        | BAT54S,215            | right A sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.        | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D7        | BAT54S,215            | right B sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.        | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D8        | BAT54S,215            | right C sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.        | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D9        | BAT54S,215            | piste sense rail clamp: BAT54S midpoint to sense, ends to GND/CORE_3V3.          | Retain; topology checked. Clamp injection and unpowered external-voltage tolerance require bounded testing.                                                            |
| D10       | 1N4004-E3/54          | Favero port 1 reverse-polarity shunt across optotransistor.                      | Retain; 0.86mm maximum lead fits nominal 1.1mm hole; reverse-shunt polarity checked. Factory forming/trim and port fault tests remain.                                 |
| D11       | 1N4004-E3/54          | Favero port 2 reverse-polarity shunt across optotransistor.                      | Retain; 0.86mm maximum lead fits nominal 1.1mm hole; reverse-shunt polarity checked. Factory forming/trim and port fault tests remain.                                 |
| FB1       | BLM18AG121SN1D        | APP_3V3 to Ethernet analog supply filter.                                        | Retain; check DC resistance/current derating and analog-rail droop.                                                                                                    |
| J1        | USB4105-GF-A          | GCT B4 pin map, slots and locators checked; opening faces outward.               | Retain. Ground lands 1.10mm versus nominal 1.15mm; details below. Assembler acceptance and enclosure/cable fit remain open.                                            |
| J2        | HTSW-105-07-L-S       | STM32 3.3V SWD/recovery header.                                                  | Retain; do not connect a grounded debugger across the isolation barrier unknowingly.                                                                                   |
| J3        | HTSW-103-07-L-S       | Left fencer A/B/C internal harness header.                                       | Retain; not a 3-pin banana socket. External socket/harness assembly is separate.                                                                                       |
| J4        | HTSW-103-07-L-S       | Right fencer A/B/C internal harness header.                                      | Retain; preserve left/right separation and verify harness pin identity.                                                                                                |
| J5        | HTSW-101-07-L-S       | Metal piste reference internal harness header.                                   | Retain; functional sensing conductor, not protective earth.                                                                                                            |
| J6        | HTSW-106-07-L-S       | ESP32 3.3V UART/EN/BOOT service header.                                          | Retain; UART service is needed because USB data terminates at STM32.                                                                                                   |
| J7        | TST-108-02-G-D        | 16-pin HUB75: pitch/pin order checked; holes and courtyard corrected.            | 1.02mm drills and 28.94mm courtyard length; native ERC/DRC/parity/connectivity pass. Keyed cable/panel compatibility remains open.                                     |
| J8        | 645004114822          | Panel 5V connector: pins 1/2 supply, 3/4 ground. Hole defect corrected.          | 1.8mm drills now match drawing; native ERC/DRC/parity/unconnected checks pass. Cable and wave-solder acceptance remain open.                                           |
| J9        | 5520250-2             | Favero port 1 modular connector, duplicated inner/outer conductors.              | Retain; actual Favero cable polarity and sample interoperability remain bench checks.                                                                                  |
| J10       | 5520250-2             | Favero port 2 modular connector, duplicated inner/outer conductors.              | Retain; inspect this port independently, not just J9.                                                                                                                  |
| J12       | HTSW-103-07-L-S       | Primary-side STUSB4500 I2C service header.                                       | Retain for prototype; label USB_GND domain, never bridge to board-side ground.                                                                                         |
| J13       | J1B1211CCD            | Ethernet magjack with integrated LEDs and magnetics.                             | Retain; manufacturer hole-pattern and outward-facing placement check passed. Exact 3D model unavailable; enclosure/cable clearance remains open.                       |
| L1        | XAL5030-472MEC        | AP63203 4.7uH output inductor.                                                   | Manufacturer land/body comparison passed; current-limit screen below. Retain; assembled current and temperature remain unmeasured.                                     |
| L2        | XAL5050-103MEC        | LTC3130 10uH buck-boost inductor.                                                | Manufacturer land/body comparison passed; current-limit screen below. Retain; assembled current and temperature remain unmeasured.                                     |
| Q1        | DMN2056U-7            | Pulls HUB75 buffer OE low only on display enable.                                | Retain; preserves blanking on reset.                                                                                                                                   |
| Q2        | DMN2056U-7            | Piezo low-side switch.                                                           | Retain; resistor R87 supplies piezo discharge path.                                                                                                                    |
| Q3        | DMN2056U-7            | Common low-side drive for both Favero opto LEDs.                                 | Retain; ports intentionally mirror one signal, not independently addressable.                                                                                          |
| Q4        | DMN2056U-7            | Clamps application eFuse enable when 20V status is not accepted.                 | Retain; status gate is pulled to regulated 5V, not raw 20V.                                                                                                            |
| Q5        | DMN2056U-7            | Clamps application eFuse enable when attach state disallows it.                  | Retain; same gate-voltage distinction as Q4.                                                                                                                           |
| Q6        | DMN2056U-7            | Controller application-power inhibit clamp.                                      | Retain; pull-up makes application off with blank/reset U21.                                                                                                            |
| R3        | RC0603FR-07100KL      | USB_PRESENT divider upper 100k                                                   | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R4        | RC0603FR-07150KL      | USB_PRESENT divider lower 150k; nominal ratio 0.6                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R5        | RC0603FR-0710KL       | STM32 reset pull-up                                                              | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R6        | RC0603FR-0710KL       | STM32 BOOT0 pull-down                                                            | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R7        | ERJPA3F2200V          | left A 220-ohm drive current limiter.                                            | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R8        | RC0603FR-07390RL      | left A 390-ohm sense series resistor.                                            | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R9        | RC0603FR-0710KL       | left A active-low buffer OE pull-up.                                             | Retain; disables drive during MCU reset.                                                                                                                               |
| R10       | ERJPA3F2200V          | left B 220-ohm drive current limiter.                                            | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R11       | RC0603FR-07390RL      | left B 390-ohm sense series resistor.                                            | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R12       | RC0603FR-0710KL       | left B active-low buffer OE pull-up.                                             | Retain; disables drive during MCU reset.                                                                                                                               |
| R13       | ERJPA3F2200V          | left C 220-ohm drive current limiter.                                            | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R14       | RC0603FR-07390RL      | left C 390-ohm sense series resistor.                                            | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R15       | RC0603FR-0710KL       | left C active-low buffer OE pull-up.                                             | Retain; disables drive during MCU reset.                                                                                                                               |
| R16       | ERJPA3F2200V          | right A 220-ohm drive current limiter.                                           | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R17       | RC0603FR-07390RL      | right A 390-ohm sense series resistor.                                           | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R18       | RC0603FR-0710KL       | right A active-low buffer OE pull-up.                                            | Retain; disables drive during MCU reset.                                                                                                                               |
| R19       | ERJPA3F2200V          | right B 220-ohm drive current limiter.                                           | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R20       | RC0603FR-07390RL      | right B 390-ohm sense series resistor.                                           | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R21       | RC0603FR-0710KL       | right B active-low buffer OE pull-up.                                            | Retain; disables drive during MCU reset.                                                                                                                               |
| R22       | ERJPA3F2200V          | right C 220-ohm drive current limiter.                                           | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R23       | RC0603FR-07390RL      | right C 390-ohm sense series resistor.                                           | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R24       | RC0603FR-0710KL       | right C active-low buffer OE pull-up.                                            | Retain; disables drive during MCU reset.                                                                                                                               |
| R25       | ERJPA3F2200V          | piste 220-ohm drive current limiter.                                             | Retain specified 0.25W part; 3.3V short gives about 15mA/50mW before driver losses.                                                                                    |
| R26       | RC0603FR-07390RL      | piste 390-ohm sense series resistor.                                             | Retain; participates in divider with 1k shunt, not interchangeable with drive resistor.                                                                                |
| R27       | RC0603FR-0710KL       | piste active-low buffer OE pull-up.                                              | Retain; disables drive during MCU reset.                                                                                                                               |
| R28       | RC0603FR-0710KL       | ESP32 EN pull-up with C21                                                        | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R29       | RC0603FR-0710KL       | ESP32 BOOT pull-up                                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R30       | RC0603FR-0747KL       | STM32 UART receive idle pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R31       | RC0603FR-0747KL       | ESP32 UART receive idle pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R32       | RC0603FR-07100RL      | IR supply 100-ohm filter with C30                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R33       | RC0603FR-07100KL      | Display-enable gate pull-down                                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R34       | RC0603FR-0710KL       | 5V HUB75 buffer-disable pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R35       | RC0603FR-0710KL       | Panel OE pull-up: blank when outputs disabled                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R36       | RC0603FR-071KL        | Buzzer MOSFET gate series resistor                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R37       | RC0603FR-07100KL      | Buzzer gate reset pull-down                                                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R38       | ERJPA3F2200V          | Favero port 1 opto LED current limiter                                           | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R39       | ERJPA3F82R0V          | Favero port 1 output 82-ohm series protection                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R40       | RC0603FR-07680KL      | Favero port 1 base-emitter discharge                                             | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R41       | ERJPA3F2200V          | Favero port 2 opto LED current limiter                                           | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R42       | ERJPA3F82R0V          | Favero port 2 output 82-ohm series protection                                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R43       | RC0603FR-07680KL      | Favero port 2 base-emitter discharge                                             | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R44       | RC0603FR-07100KL      | Favero TX MOSFET reset pull-down                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R45       | RC0603FR-0710KL       | left A drive-input pull-down.                                                    | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R46       | RC0603FR-0710KL       | left B drive-input pull-down.                                                    | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R47       | RC0603FR-0710KL       | left C drive-input pull-down.                                                    | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R48       | RC0603FR-0710KL       | right A drive-input pull-down.                                                   | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R49       | RC0603FR-0710KL       | right B drive-input pull-down.                                                   | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R50       | RC0603FR-0710KL       | right C drive-input pull-down.                                                   | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R51       | RC0603FR-0710KL       | piste drive-input pull-down.                                                     | Retain; deterministic low when enabled before GPIO initialization.                                                                                                     |
| R65       | RC0603FR-071KL        | left A sense 1k shunt to ground.                                                 | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R66       | RC0603FR-071KL        | left B sense 1k shunt to ground.                                                 | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R67       | RC0603FR-071KL        | left C sense 1k shunt to ground.                                                 | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R68       | RC0603FR-071KL        | right A sense 1k shunt to ground.                                                | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R69       | RC0603FR-071KL        | right B sense 1k shunt to ground.                                                | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R70       | RC0603FR-071KL        | right C sense 1k shunt to ground.                                                | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R71       | RC0603FR-071KL        | piste sense 1k shunt to ground.                                                  | Retain; intentional sensing load. Verify weakest multi-conductor short threshold and settling.                                                                         |
| R72       | RC0603FR-0710KL       | STM32 UART transmit idle pull-up                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R73       | RC0603FR-0710KL       | ESP32 UART transmit idle pull-up                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R74       | RC0603FR-0710KL       | HUB75 R1 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R75       | RC0603FR-0710KL       | HUB75 G1 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R76       | RC0603FR-0710KL       | HUB75 B1 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R77       | RC0603FR-0710KL       | HUB75 R2 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R78       | RC0603FR-0710KL       | HUB75 G2 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R79       | RC0603FR-0710KL       | HUB75 B2 input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R80       | RC0603FR-0710KL       | HUB75 A input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R81       | RC0603FR-0710KL       | HUB75 B input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R82       | RC0603FR-0710KL       | HUB75 C input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R83       | RC0603FR-0710KL       | HUB75 D input pull-down on APP side of 5V buffer.                                | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R84       | RC0603FR-0710KL       | HUB75 CLK input pull-down on APP side of 5V buffer.                              | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R85       | RC0603FR-0710KL       | HUB75 LAT input pull-down on APP side of 5V buffer.                              | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R86       | RC0603FR-0710KL       | HUB75 OE input pull-down on APP side of 5V buffer.                               | Retain; prevents floating buffer input while ESP32/application rail is off.                                                                                            |
| R87       | RC0603FR-071KL        | Piezo discharge resistor parallel to BZ1                                         | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R88       | RC2512FK-071KL        | STUSB4500 raw VBUS sense/discharge path, 1W                                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R89       | RC2512FK-071KL        | STUSB4500 switched input discharge path, 1W                                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R92       | RC0603FR-07100KL      | 5V pull-up of active-low PD 20V status                                           | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R93       | RC0603FR-07100KL      | 5V pull-up of active-low PD attach status                                        | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R94       | RT0603BRD07140KL      | eFuse enable divider upper 140k                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R95       | RT0603BRD0710KL       | eFuse enable divider lower 10k; nominal 18V threshold at 1.2V                    | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R96       | RT0603BRD07172KL      | eFuse overvoltage divider upper 172k                                             | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R97       | RT0603BRD0710KL       | eFuse overvoltage divider lower 10k; nominal 21.84V at 1.2V                      | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R98       | RC0603FR-071K37L      | eFuse current-limit programming                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R99       | RC0603FR-0749R9L      | Ethernet TX+ 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R100      | RC0603FR-0749R9L      | Ethernet TX- 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R101      | RC0603FR-0749R9L      | Ethernet RX+ 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R102      | RC0603FR-0749R9L      | Ethernet RX- 49.9-ohm termination                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R103      | RC0603FR-0710RL       | Ethernet TX center-tap series feed                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R104      | RC0603FR-0712K4L      | W5500 EXRES precision bias resistor                                              | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R105      | RC0603FR-07330RL      | Ethernet LINK LED current limiter                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R106      | RC0603FR-07330RL      | Ethernet ACT LED current limiter                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R107      | RC0603FR-071ML        | Ethernet crystal feedback resistor                                               | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R111      | RC0603FR-07100KL      | Application inhibit default pull-up                                              | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R112      | RC0603FR-07100KL      | Acquisition ON default pull-down                                                 | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R113      | RC0603FR-07100KL      | Automatic USB suspend shutdown default pull-up                                   | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R114      | RC0603FR-074K7L       | Primary-domain PD I2C SDA pull-up                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R115      | RC0603FR-074K7L       | Primary-domain PD I2C SCL pull-up                                                | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| R116      | RC0603FR-0747KL       | Primary-domain PD ALERT pull-up                                                  | Retain; circuit role checked. Power/timing or startup behavior must be evaluated with its associated IC.                                                               |
| SW1       | TL3342F160QG          | STM32 reset to ground.                                                           | Exact E-Switch drawing J land pattern and normally-open contact grouping checked. Retain; physical actuation/recovery still untested.                                  |
| SW2       | TL3342F160QG          | ESP32 EN reset to ground.                                                        | Exact E-Switch drawing J land pattern and normally-open contact grouping checked. Retain; physical actuation/recovery still untested.                                  |
| SW3       | TL3342F160QG          | ESP32 BOOT to ground.                                                            | Exact E-Switch drawing J land pattern and normally-open contact grouping checked. Retain; physical actuation/recovery still untested.                                  |
| U1        | STM32G474RET6         | STM32G474 scoring/acquisition; USB isolated side, seven comparator sense inputs. | Retain; exact LQFP64 pitch, numbering and nominal lead fit checked. Timing, thresholds and physical power remain bench work.                                           |
| U2        | ESP32-S3-WROOM-1-N8R8 | ESP32-S3-N8R8 display/Ethernet/IR processor on switched APP_3V3.                 | Retain; memory-reserved pins, boot/UART wiring and four-layer antenna keepout checked. Substrate/enclosure RF effects require physical testing.                        |
| U3        | TPD2E2U06DCKR         | USB D+/D- ESD device referenced to USB_GND.                                      | DCK0003A land pattern and pin map checked: 1=DP, 2=DM, 3=USB_GND. Retain; physical ESD performance remains untested.                                                   |
| U4        | AP2112K-3.3TRG1       | AP2112 3.3V acquisition LDO, EN tied to CORE_5V.                                 | Pin/body/land comparison below found no fit defect. Retain; assembly tolerance, startup and thermal measurements remain open.                                          |
| U5        | STUSB4500QTR          | STUSB4500 autonomous PD sink with U21 qualification.                             | Retain; electrical pin map and recommended QFN land pattern checked. Physical NVM/configuration and assembly process remain open.                                      |
| U6        | REC30K-2405SZ         | Isolated application/panel supply.                                               | Pin/land/body drawing check passed; assembler must confirm finished-hole tolerance. Thermal/startup capability remains a bench check. CTRL/TRIM intentionally unused.  |
| U7        | AP63203WU-7           | AP63203 application 3.3V buck regulator.                                         | Pin/body/land comparison below found no fit defect. Retain; assembly tolerance, startup and thermal measurements remain open.                                          |
| U8        | 74LVC125APW,118       | Three left-channel LVC125 conductor drivers.                                     | Retain; fourth channel input tied low, OE high, output NC intentionally.                                                                                               |
| U9        | 74LVC125APW,118       | Right A/B/C and piste LVC125 conductor drivers.                                  | Retain; all four channels used. OE pulls prevent reset drive.                                                                                                          |
| U10       | SN74AXC1T45DCKR       | CORE-to-APP UART level translator.                                               | Retain; dual power-domain isolation behavior, not galvanic isolation. A-to-B DIR correct.                                                                              |
| U11       | SN74AXC1T45DCKR       | APP-to-CORE UART level translator.                                               | Retain; B-to-A DIR correct; power-off leakage remains budgeted.                                                                                                        |
| U12       | W5500                 | W5500 Ethernet controller.                                                       | All 48 pad nets and nominal package fit checked. Retain; firmware reset >=500us, startup and physical Ethernet tests remain.                                           |
| U13       | TSOP38438             | Pin/lead check passed; reversed body courtyard corrected, model/pads unchanged.  | Native ERC/DRC/parity/connectivity pass. Assembly height, lead trim and enclosure window remain open.                                                                  |
| U14       | SN74AHCT541PWR        | Eight HUB75 3.3-to-5V AHCT buffer channels.                                      | Retain; OE1 grounded, OE2 under Q1 control.                                                                                                                            |
| U15       | SN74AHCT541PWR        | Remaining five HUB75 AHCT buffer channels.                                       | Retain; three unused inputs grounded, outputs NC. Second IC is needed for 13 signals.                                                                                  |
| U16       | 4N32M                 | Favero port 1 optodarlington.                                                    | Retain; exact DIP pin map, 2.54mm pitch/7.62mm rows and lead/drill fit checked. Actual repeater load and release time need bench tests.                                |
| U17       | 4N32M                 | Favero port 2 optodarlington.                                                    | Retain; exact DIP pin map, 2.54mm pitch/7.62mm rows and lead/drill fit checked. Actual repeater load and release time need bench tests.                                |
| U18       | LTM2884IY#PBF         | LTM2884 isolated USB and acquisition power.                                      | Retain; VLO 10mA allowance and 5V-side output budget require whole-system check; assembly profile unresolved.                                                          |
| U19       | LTC3130IMSE-1#PBF     | LTC3130 regulated primary 5V from USB VBUS.                                      | Fixed-5V automatic mode implemented; ERC/DRC/parity pass. Whole-input suspend and physical validation remain open.                                                     |
| U20       | TPS259470LRPWR        | TPS259470 application branch eFuse.                                              | Pin/land check passed; split power-pad paste windows implemented and visually verified. Copper unchanged. Assembler stencil process remains open.                      |
| U21       | STM32C011F6P6         | STM32C011 primary-side source qualifier and power gate controller.               | Retain; TSSOP20 pitch/numbering/lead fit checked; PA11 default pin16. Programming service and VLO current remain open.                                                 |
| Y1        | ABM3B-8.000MHZ-B2-T   | STM32 8MHz HSE crystal.                                                          | Retain; 27pF pair gives 13.5pF series load before strays. Verify startup/frequency.                                                                                    |
| Y2        | ABM8-25.000MHZ-B2-T   | Ethernet 25MHz CL18pF crystal.                                                   | Retain provisionally; 18pF pair gives 9pF before strays. Reference circuit alone does not establish actual crystal load.                                               |

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

The follow-up union of native pad, track, via and saved filled-zone polygons across **all four layers** has no
primary/secondary projected overlap. Its projected edge separation is 2.4994–2.5000mm at 1um polygon resolution. Thus
this layout does not rely on a thin inter-layer dielectric where those domains overlap. The only packages with pads in
both domains are U6 (REC30K) and U18 (LTM2884); no ordinary resistor, diode or connector bridges them. This is a native
geometry/net assignment check, not a measured surface-creepage or dielectric-withstand test.

**Prototype isolation basis:** J1 accepts only an appropriately isolated, current-limited USB-C source, with 5V laptop
or 20V nominal standalone operation. There is no direct mains input. Maintain separate USB_GND and secondary GND, the
existing 2.50mm projected copper gap, and U18's larger manufacturer-required copper-free region. The 2.50mm value is
this prototype's layout constraint, **not an asserted FIE or safety-standard minimum**. Source mains protection must not
depend on this board. Do not infer a 400V board working rating from U18's component rating: U6's separate
basic-insulation rating and the PCB, connectors, enclosure and contamination paths must all be assessed together.
[ADI LTM2884 Rev D, pages 4–5 and 17](https://www.analog.com/media/en/technical-documentation/data-sheets/ltm2884.pdf),
[RECOM REC30K Rev 1-2025, page 7](<https://recom-power.com/pdf/Econoline/REC30K(-Z).pdf>).

J14 and its programmer are primary-side; J2/J6 and their debuggers are secondary-side. A common grounded programmer,
scope, USB-UART adapter or conductive enclosure can bypass isolation outside the PCB. During bring-up disconnect
fencers, piste and repeaters; use a current-limited isolated source and an insulating support, and do not connect
grounded instruments across both domains. U6's metal case and protruding through-hole leads must not contact the carrier
or adjacent conductors. Assembler stackup/process acceptance and an assembled insulation check remain open. Competition
homologation and a product electrical-safety rating require a qualified system review; this desk check does not
authorize use with fencers or set a high-voltage test procedure.

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

U13's [Vishay drawing, revision 2.1, page 7](https://www.vishay.com/docs/82491/tsop382.pdf) was visually compared with
native pad positions: 2.54mm pitch, 1=IR_RX, 2=GND, 3=IR_3V3.

**BZ1 mechanical check:** visually reviewed TDK's September 2017 PS-series drawing, page 4, obtained from a mirror after
the official download returned access errors. The PS1240P02BT body is 12.2 +/-0.5mm diameter and 6.5 +/-0.5mm high.
Expanded the native/library courtyard from 12.7mm to 13.7mm square, allowing 0.5mm around the maximum body; the sound
opening faces upward and must remain unobstructed. Nominal lead pitch is 5mm, matching the PCB. Maximum lead section is
0.65 by 0.45mm (0.79mm diagonal), smaller than the existing 1mm holes. The drawing's +/-0.5mm pitch tolerance still
requires assembler lead forming and finished-hole acceptance, not forced insertion. No hole, land, model transform,
electrical net or route changed. Factory lead trimming is required; 15mm depicted free leads are not the intended
clearance below the assembled PCB. This externally driven piezo retains Q2 and the 1k discharge resistor; firmware must
generate the tone, rather than apply DC and expect a continuous sound.
[TDK manufacturer-authored drawing, mirrored copy](https://www.datasheets.com/tdk/ps1240p02bt/datasheet.pdf).

U13's follow-up native render and exported model bounds identified a reversed courtyard: the model projects
approximately x=202.035–207.965mm, y=97.65–102.45mm, while the old courtyard covered y=100.5–106.3mm. The revised
native/library courtyard is x=201–209mm, y=96.5–103mm. It also contains the drawing's tolerance envelope (up to 4mm
lens-side projection and 1.4mm rear projection from the lead plane), with at least 0.5mm allowance. No pad, model
transform, component or track moved. Lens points toward the board's top, not its right edge; enclosure window design
must use that orientation. Exported untrimmed leads extend about 20.1mm below the seating plane, so factory
height-setting/lead trimming is explicit in the handoff. This is not measured installed clearance. Fresh
`output/ir-courtyard-review/` passes ERC, DRC, parity and connectivity with 223 matching assembly references. The
[native top render](output/ir-body-top.png) shows the unchanged body/pad orientation; courtyard-only correction does not
alter that image. Exact model transforms and all copper remain unchanged.

**J7 footprint correction:** Samtec's TST double-row drawing specifies 1.02mm holes, replacing the previous 1.00mm
drill. The TST-108 body is `8 × 2.54 + 7.62 = 27.94mm` long, longer than the previous 26mm courtyard in that direction.
Expanded that courtyard to 28.94mm, preserving its conservative 10.8mm width. Pin centers, 1.8mm lands, component
position and routing are unchanged. The -02 tail is 4.19mm; underside clearance must allow for the protruding tails. The
current generic IDC model is not an exact Samtec key/body validation. Confirm the keyed mating cable and panel's input
orientation before powering; do not approve an arbitrary 64x32 scan convention from this footprint check.
[Samtec series print AQ, sheet 1](https://suddendocs.samtec.com/prints/tst-1xx-xx-x-x-xx-xx-mkt.pdf),
[recommended double-row footprint](https://suddendocs.samtec.com/prints/tss-tstd.pdf),
[exact configured part](https://www.samtec.com/products/tst-108-02-g-d). Fresh `output/hub75-signal-fit-review/` has
zero ERC/DRC/parity/unconnected findings, including the expanded courtyard, and 223 matching BOM/placement references.
U21 rebuilt unchanged. Earlier fabrication ZIPs are superseded. Repository verification stopped on unrelated legislation
temporary-file lint errors; focused native checks passed, but no clean repository-wide result is claimed.

**J8 confirmed fit defect:** Würth's exact-part drawing specifies 1.8mm holes for 1.14mm-square contacts (about 1.61mm
across corners), so the previous 1.4mm holes could not accept the nominal full-width pins. Corrected all four drills in
both the saved PCB and project footprint; positions, nets, 2.8mm lands and 3.96mm pitch are unchanged. Nominal annular
width is now 0.5mm. The manufacturer specifies wave soldering for the nylon-66 header; do not assume suitability for the
SMT reflow oven. Its 7A rating is not permission to exceed the panel rail budget or a substitute for mating-contact/wire
derating and assembled temperature checks.
[Würth 645004114822 drawing, revision L, sheet 1](https://www.we-online.com/components/products/datasheet/645004114822.pdf).
Fresh `output/hub75-power-hole-review/` has zero ERC/DRC/parity/unconnected findings, 223 matching assembly rows, and a
rebuilt U21 image. Only these four hole diameters changed in the PCB and source footprint; no routing moved. Older
fabrication ZIPs are superseded. `pnpm verify` stopped on unrelated `apps/legislation/tmp/committee-coburn-audit.ts`
console lint errors; no clean repository-wide pass is claimed and that file was not changed.

J1 mechanical source: [GCT USB4105 drawing B4, sheet 1](https://gct.co/files/drawings/usb4105.pdf), visually reviewed
against saved native pad coordinates. Locators are 0.65mm holes spaced 5.78mm; shell slots have 8.64mm horizontal
spacing and 4.18mm row spacing. The mouth is 0.675mm beyond the bottom edge. CC1/CC2 are separate, paired D+/D-
connections agree, and the shell connects to USB_GND. The 1.0mm shell lands use 0.6mm-wide slots, with rear/front
lengths 1.7/1.4mm; signal lands are 0.3mm wide and power lands 0.6mm. Ground lands share the other lands' rear edge but
end 0.05mm earlier. The default GF-A ordering code has 0.95mm shell stakes; do not silently substitute the 060/120
suffixes. This is a geometry/pin-map review, not a solder-joint or finished enclosure qualification. No PCB or schematic
changes were made.

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
an isolation-barrier requirement. Clean DRC alone does not prove isolation. The completed all-layer geometric comparison
above separately establishes the approximately 2.50mm projected gap and no domain overlap. External grounding, assembled
insulation and enclosure acceptance remain separate; the fabrication clearance is not a safety rating.

Remaining desk-review order: (1) exact footprint/mechanical and isolation geometry; (2) power/capacitance/compensation
budgets; (3) supplier alternates and no-soldering assembly handoff. After assembly: controlled power-up, reset/suspend,
USB enumeration, sense thresholds, clock accuracy, IR range, Ethernet and both Favero outputs. Do not require these
prototype-dependent measurements to exist before building the prototype, and do not claim them as already passed.

Fresh top-side visual checkpoint: [KiCad render](output/component-review-top.png). This overview was inspected for gross
placement; it does not resolve individual pin/land-pattern alignment. U18 and J13 body visibility is an explicit
limitation, not an accepted omission.
