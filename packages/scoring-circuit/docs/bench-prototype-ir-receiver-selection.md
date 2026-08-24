# BP-146 exact encrypted-IR receiver selection

## Decision

The one-board prototype selects Vishay `TSOP38438`, a 38 kHz AGC4 Minicast
receiver. It is a three-pin, leaded device with a 5.0 mm x 6.95 mm x 4.8 mm
package. Vishay documents pin 1 as active-low demodulated `OUT`, pin 2 as
ground, and pin 3 as supply. The selected 38 kHz option is the datasheet's
long-burst AGC4 choice. The receiver runs from the application 3.3 V rail and
connects only to the application ESP32-S3 `GPIO35` / `RMT_RX` allocation from
BP-126.

This selection does not implement encryption, authentication, pairing,
anti-replay, or command authority. Those are firmware responsibilities in the
encrypted-IR application contract. The demodulator only produces a noisy,
active-low pulse stream.

## Exact prototype population

| Ref | Function | Manufacturer and MPN | Value/package | Topology |
| --- | --- | --- | --- | --- |
| `U_IR_RX` | 38 kHz IR receiver/demodulator | Vishay `TSOP38438` | Minicast, 3-pin leaded | pin 1 `OUT`, pin 2 `APP_GND`, pin 3 `IR_3V3_FILTERED` |
| `R_IR_VS` | supply isolation | YAGEO `RC0603FR-07100RL` | 100 ohm, 1%, 0603 | `APP_3V3` to filtered receiver supply |
| `C_IR_VS` | local bypass | KEMET `C0603C104K3RACTU` | 100 nF, 10%, 25 V, X7R, 0603 | filtered receiver supply to `APP_GND` at pins |
| `R_IR_OUT` | output fault/backfeed limiter | YAGEO `RC0603FR-07100RL` | 100 ohm, 1%, 0603 | receiver `OUT` to `IR_RX_GPIO35` |
| `R_IR_PULLUP` | reset/off idle bias | YAGEO `RC0603FR-0710KL` | 10 kohm, 1%, 0603 | `IR_RX_GPIO35` to `APP_3V3` |
| `TP_IR_RX` | oscilloscope observation | Keystone Electronics `5001` | miniature black through-hole test point | ESP32-side of `R_IR_OUT` |

Vishay recommends an `R1`/`C1` supply filter when strong ripple or spikes are
present, but the datasheet does not prescribe the selected 100 ohm and 100 nF
values. Those values are prototype engineering choices. They must pass rail
ripple, receiver delay, range, and optical-flood tests before schematic
release.

No external electrical connector reaches the optical input. Therefore no
external ESD TVS is placed on the receiver node; the series output resistor,
local supply isolation, and controlled test point are the prototype protection
boundary. The final factory design may replace the leaded package only after a
new optical and footprint review.

## Reset, power-off, and fault behavior

- `U_IR_RX` is powered only from `APP_3V3`; it is not connected to `EN_RESET`,
  `BOOT_N`, the STM32 domain, or the isolation boundary.
- `GPIO35` is an input-only application signal, not a boot strap. Firmware
  disables RMT capture during reset and startup, waits for rail validity, and
  enables authenticated command processing only after session readiness.
- On rail removal, the output series resistor limits any residual injection.
  Bench evidence must show `GPIO35` never rises above `APP_3V3 + 0.3 V` and
  no reset is asserted during rail-off/rail-on.
- Continuous low, continuous carrier, malformed pulses, noise, and queue
  overflow are diagnostics and dropped input. They cannot change bout state,
  drive scoring hardware, hold reset, or defeat either watchdog.

## Optical placement and acceptance gates

Place the lens normal to the intended front-panel axis. Keep the optical
aperture free of copper, vias, LEDs, light pipes, and switching-node copper,
with at least a 3 mm radial copper/component keepout as a conservative board
rule. Keep the receiver and `TP_IR_RX` in `APP_GND` on the application side of
the scoring isolation boundary and do not place the lens behind the HUB75
panel or tinted material.

## Manufacturer footprint and optical-window evidence

The reviewed Vishay sources close the source-identity review without closing
the board-release gate. The TSOP382/TSOP384 datasheet identifies the exact
TSOP38438 Minicast package, pinning, optical-window side, 2.54 mm nominal lead
pitch, 0.7 mm maximum lead width, and 0.5 mm maximum lead thickness. Vishay's
Minicast window note defines the front-panel window as
`a = 4 mm + 2d tan(Phi / 2)`, with a 4 mm minimum at zero lens-to-panel
distance, and recommends a 4 mm light guide with at least 12 mm length.

The exact-part record is kept separate from the datasheet's series and
application guidance. The latter identifies the `TSOP382.., TSOP384..` series
as leaded and for remote-control use, and lists `TSOP38438` in the 38 kHz AGC4
column recommended for long-burst codes. These statements are selection
context, not a board land pattern, an optical keepout, or prototype acceptance
evidence.

The retained Vishay assembly instructions add generic leaded-receiver handling
constraints: a bend must start at least 1.5 mm from the package bottom and
must not transmit force from the leads into the package. For through-hole
assembly without a holder, the table gives iron soldering at no more than
350 °C, at least 2 mm from the lower case edge, for no more than 3 seconds per
pin; wave soldering is 260 °C, at least 1 mm from the lower case edge, for no
more than 10 seconds. These are assembly-process limits, not finished drill or
pad dimensions.

The exact manufacturer land-pattern finding is negative. The retained
package drawing gives the package views, pin order, lead pitch, lead width,
and lead thickness, but no board-coordinate rotation or exact PCB pin-one
orientation. No retained Vishay byte defines a finished drill, annular ring,
pad, mask, paste, courtyard, or PCB land pattern. The executable record keeps
those values null and the board-orientation match false.

The manufacturer does not specify a finished PCB drill diameter, annular ring,
pad diameter, mask, paste, courtyard, or fixed radial copper/component
keepout in those primary documents. Vishay's product page sends ECAD downloads
to Ultra Librarian; no first-party CAD artifact was acquired for this review.
Those omissions are recorded as explicit nulls in the executable evidence
record. The record separately marks the board-CAD land-pattern and optical
coupon reviews as not submitted and not run. They are not substituted with a
guessed footprint or a claimed CAD digest.

### Candidate footprint review procedure

The executable record now contains a deterministic project-footprint review
input for the exact `TSOP38438`, without treating it as manufacturer CAD. The
project input uses 1.10 mm finished drill with ±0.05 mm drill tolerance, 2.20
mm pad, 0.55 mm annular ring, 2.30 mm mask opening with 0.05 mm expansion,
zero paste opening for the through-hole part, and a 0.55 mm courtyard
clearance. The retained Vishay lead envelope is 0.7 mm maximum width by 0.5
mm maximum thickness, or 0.8602 mm maximum diagonal, at 2.54 mm nominal
pitch; the drawing rule is `not indicated tolerances ±0.2 mm`. The minimum
finished drill is therefore 1.05 mm and leaves 0.1898 mm worst-case
diametral clearance over that diagonal, above the 0.15 mm hand-assembly rule.
The 2.30 mm mask opening leaves a 0.24 mm mask web at 2.54 mm pitch. These are
project review inputs, not Vishay land-pattern dimensions or fabrication
approval.

The project datum is exact: pin 1 and the lead row are at `y=0`, the package
body extends toward positive `y`, the lens center is `(2.5, 0)` mm, and the
optical axis points toward negative `y`. In both overlays the blue body
outline is a deterministic projection of the retained manufacturer drawing
dimensions; it is not manufacturer CAD.

The retained project artwork is generated by the deterministic SVG overlay
generator version `1.0.0`. It includes two hash-bound 1:1 artifacts:
[`tsop38438-project-footprint-overlay.svg`](evidence/bp-146/tsop38438-project-footprint-overlay.svg)
and
[`tsop38438-project-assembly-overlay.svg`](evidence/bp-146/tsop38438-project-assembly-overlay.svg).
The first overlays package outline and through-hole geometry; the second
overlays the lens datum and the project 3 mm radial copper/component rule.
Both remain `reviewStatus: pending`, with manufacturer-CAD authority, artwork
release authority, physical evidence, and fabrication authority still denied.

### Optical coupon review procedure

Before accepting the board opening, record the panel material and thickness,
the measured lens-to-panel distance, required total viewing angle, aperture
width and height, and light-guide dimensions. Calculate the aperture with
`a = 4 mm + 2d tan(Phi / 2)` and retain the calculation inputs and result.
The executable procedure leaves these inputs and result empty until the panel
is dimensioned. It retains Vishay's 4 mm zero-distance minimum and 4 mm
light-guide, at least 12 mm length, guidance without representing them as a
PCB footprint.

Use a conservative project rule of 3 mm radial copper and component keepout
around the lens. This is explicitly a project rule, not a Vishay value. The
coupon record must then contain measured panel and aperture dimensions,
viewing-angle results, calibration-record identities and SHA-256 digests,
raw-measurement and report artifact hashes, and photos with immutable paths
and digests. The canonical record has no photos, calibration records, or
measurement/report hashes and remains `not-run`.

The coupon cannot close independently of the existing physical gates. Record
separate evidence for 20 m range, angle, receiver timing and authenticated
command latency, flood and ambient-light behavior, and reset/power-off and
backfeed behavior. Every gate remains pending and false until its bounded
evidence is reviewed. The executable aperture calculation is a planning
helper only; it does not authorize board layout or fabrication.

| Evidence identity | Source revision | SHA-256 | Reviewer | Review result |
| --- | --- | --- | --- | --- |
| Vishay document 82491, TSOP382/TSOP384 datasheet, pp. 2 and 7 | Rev. 2.1, 2025-05-27 | `5F81C36AA02E9901E51C749D03AEE75A23A29B8195B30BF1CBA95F536C865074` | `implementation-agent` | Package, pin, orientation, and lead geometry reviewed |
| Vishay document 82756, Minicast window size, p. 1 | Rev. 1.0, 2016-08-18 | `C8A78F338915815E93C5AB4CC98ABF588504CC8B2E4CD3288794660810985BC1` | `implementation-agent` | Window formula and light-guide guidance reviewed; no fixed PCB keepout published |
| Vishay document 80068, IR receiver assembly instructions, pp. 1 and 2 | Rev. 1.8, 2026-05-20 | `8DEE97CE1235CB20794A6CB15BD7364277EAAF6FAE908B32F67E8362962FD1A6` | `implementation-agent` | Lead bend and through-hole solder limits reviewed; no PCB land pattern |

The exact source bytes are retained in the repository under
[`docs/evidence/bp-146`](evidence/bp-146). The footprint-evidence regression
test resolves those paths from `import.meta.url`, recomputes every SHA-256
digest, and checks stable source markers from the raw and inflated PDF streams.
This makes the source review reproducible without treating the retained PDFs
as a released CAD or land-pattern artifact.

The source review is fail-closed: `manufacturerPackageDrawingReviewed`,
`pinOrientationReviewed`, `throughHoleGeometryReviewed`, and
`opticalKeepoutReviewed` are true, while `manufacturerCadReviewed`,
`opticalKeepoutAccepted`, and `footprintReleased` remain false. The 3 mm
radial rule is a conservative BP-146 board constraint, not a Vishay-published
keepout value. Board CAD/artwork, the finished drill and land choice, and a
physical front-panel coupon remain required before PCB release.

The executable evidence intentionally makes both reviews fail closed. The land
pattern has no finished drill, pad, courtyard, or board-CAD pin-1 confirmation;
the optical review has no submitted board layout or front-panel coupon. Neither
record can become accepted by changing the project 3 mm rule. The actual board
review must confirm the package drawing's optical-window-facing orientation and
the final panel window calculated from the required viewing angle and measured
lens-to-panel distance.

The Vishay values are typical design references, not prototype acceptance
claims:

- the reviewed electrical table identifies TSOP38438 as the 38 kHz AGC4
  option and gives 2.0 to 5.5 V supply and 0.25/0.35/0.45 mA
  minimum/typical/maximum supply current at `Ev = 0`, `VS = 3.3 V`;
- 2.0 to 5.5 V supply, nominal 3.3 V;
- nominal 30 m transmission test distance with Vishay's laboratory TSAL6200
  test source, which does not establish handheld range;
- ±45° half-transmission directivity;
- 184 to 342 us output delay for the 38 kHz qualifying burst;
- active-low output with 100 mV maximum low under the cited test condition.

The supply, carrier, and laboratory-distance facts above are now bound to the
retained datasheet in the executable
`publishedElectricalOpticalCharacteristics` record. Its source pages are 2–3,
and its qualification state remains datasheet-only. The delay rule is retained
as Vishay's direct specification, `7/f0 < td < 13/f0`; the integer microsecond
values shown here are a readable 38 kHz test-window summary, not a replacement
for the source condition. None of these manufacturer values closes the
prototype's handheld range, optical coupon, flood, reset, power-off, or PCB
land-pattern gates.

The bench must pass all of these bounded gates before fabrication can be
considered:

1. Using the actual representative handheld emitter and production-candidate
   frame format, receive 1000/1000 valid authenticated frames at 20 m and 0°,
   then 100/100 at 20 m and ±15°. Record ambient light, handheld supply, emitter
   current, and frame timing. Any false accepted command fails.
2. At 5 m, receive 100/100 frames at 0°, ±30°, and ±45°; record the first
   failing angle rather than extrapolating the datasheet plot.
3. Scope the emitter trigger and `TP_IR_RX`: the first output edge must fall
   within the 184–342 us receiver delay window. The full authenticated command
   event must complete within 50 ms.
4. Run 30 minutes of carrier/burst flood plus 40 klx ambient light. Accept no
   command, reset, watchdog fault, or unbounded queue growth; recover within
   one second after quiet.
5. Run 100 rail cycles and 100 reset cycles. Prove no backfeed above
   `APP_3V3 + 0.3 V`, strap disturbance, reset, or watchdog fault.

The executable `range20mEvidence` gate remains `false` until the first test is
performed with the representative handheld and its captured evidence is
reviewed.

The executable contract and regression tests are
[`bench-prototype-ir-receiver-selection.ts`](../src/bench-prototype-ir-receiver-selection.ts)
and
[`bench-prototype-ir-receiver-selection.test.ts`](../src/bench-prototype-ir-receiver-selection.test.ts).
The exact receiver, support MPN records, and manufacturer source review are
closed for this selection. Board CAD/artwork, the finished land/drill choice,
optical layout/coupon, and all bench evidence remain open gates; this BP-146
unit does not authorize schematic integration or fabrication.

## Primary manufacturer sources

- [Vishay TSOP382/TSOP384 datasheet, Rev. 2.1, 27 May 2025](https://www.vishay.com/docs/82491/tsop382.pdf)
- [Vishay Minicast window-size guidance, Rev. 1.0, 18 August 2016](https://www.vishay.com/docs/82756/windowsizeminicast.pdf)
- [Vishay IR receiver assembly instructions, Rev. 1.8, 20 May 2026](https://www.vishay.com/docs/80068/assembly.pdf)
- [Vishay TSOP382/TSOP384 product page and ECAD link](https://www.vishay.com/en/product/82491/)
- [Vishay IR receiver product records](https://www.vishay.com/en/ir-receiver-modules/mitsubishi/)
- [YAGEO RC0603FR-07100RL product record](https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL)
- [YAGEO RC0603FR-0710KL product record](https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL)
- [KEMET C0603C104K3RACTU product record](https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU)
- [Keystone terminals and test points catalog](https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf)
- [Espressif ESP32-S3-WROOM-1/1U datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
