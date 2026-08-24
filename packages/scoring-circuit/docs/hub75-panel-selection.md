# HUB75 panel selection

**Status:** selected for EVT evaluation; not production approved and not a PCB
fabrication release.

The panel candidate for the current 64x32 visual design is Adafruit's
`64x32 RGB LED Matrix - 5mm pitch`, product ID `2277`. Adafruit's product page
currently lists the panel in stock and identifies 2048 RGB LEDs, two IDC
connectors, 13 digital control pins, 5 V logic, 1/16 scan, approximately 4 A
at 5 V with all LEDs on, and dimensions of 318 mm by 158 mm by 15 mm. Adafruit
publishes a 5 V logic requirement. The product page's current CAD-drawing link
is not retrievable, so a current manufacturer drawing remains an explicit
mechanical gate.

This is a practical EVT choice because its published approximately 20 W
full-white load is below the current display budget, and its 13-control-pin
HUB75 interface maps to the carrier's `J_HUB75` signals. The product is still
remainder stock from factory batches, so it is an EVT panel and not a stable
production source. The PCB must not assume its connector shell or mounting
holes without inspecting the purchased unit.

## Electrical fit

| Requirement | Selected panel evidence | Carrier decision |
| --- | --- | --- |
| Pixel matrix | 64x32, 2048 RGB pixels | Matches the simulator and display layout |
| Scan mode | 1/16 scan | Firmware must use the panel's 16-row multiplex timing |
| Data interface | Two HUB75 headers, input and output | Use input only; do not populate a chain |
| Header | HUB75 input with 13 digital pins: six color data and `A`, `B`, `C`, `D`, `CLK`, `LAT`, `OE` | Matches the modeled 13 driven signals; cable ground returns remain a separate harness requirement |
| Panel supply | Regulated 5 V, approximately 4 A with all LEDs on | Feed from the regulated `V5` rail through a dedicated power harness |
| Published consumption | Approximately 20 W at the stated full-white condition | Record as 20 W continuous and 20 W screen-load envelope until measured |
| Physical envelope | 318 mm x 158 mm x 15 mm, 5 mm pitch | Reserve the exact panel outline, support, bezel, and cable bend radius in the enclosure |
| Logic levels | Adafruit publishes 5 V logic | Verify `VIH`, `VIL`, OE polarity, timing, and back-power behavior on the purchased revision before release |

The product documentation says the display must be supplied from a regulated
5 V input. The display's input is not a USB-PD or 20 V input. The
carrier's two `SN74AHCT245PWR` buffers remain the 3.3 V-to-5 V interface, and
the reset-gated `OE_N` path keeps the panel blank while the ESP32 is in reset,
boot ROM, absent, or unpowered. The panel-side pull-up must be checked against
the exact panel's input protection and power sequencing.

The manufacturer page describes adjustable brightness but does not publish a
numeric brightness range, refresh-rate limit, input thresholds, or a repeatable
full-white current trace. Firmware must therefore choose a declared brightness
and refresh configuration and treat it as part of the product contract. Do not
use a reseller's typical current as the release value.

## Power-budget result

The provisional USB-PD SPR envelope allocates 33.16 W continuously and 34.79 W
for a 100 ms screen to the display rail. The panel's published approximately 4 A
full-white load is about 20 W at 5 V, leaving approximately:

- 13.16 W and 2.63 A of continuous system envelope before cable and connector
  losses.
- 14.79 W and 2.96 A of the 100 ms screen envelope.

These are budget differences, not thermal margin or permission to draw 4 A at
the far end of an undersized harness. The power harness must be sized for the
measured panel current, keep panel-end voltage inside the manufacturer's 5 V
operating requirement, and return VCC/GND separately from HUB75 signal ground
where the harness design requires it. The 100 ms number is not an inrush
approval; startup current and duration require a separate capture with the
candidate V5 converter/power stage, eFuse, output capacitance, cable, and panel
connected. The current V5/eFuse short-peak power-stage envelope remains
**DENY** pending its separate electrical and thermal closure. Therefore the
33.16 W and 34.79 W figures are provisional allocations, not demonstrated
deliverable rail capacity and not permission to release the PCB. The selected
20 W panel's end-to-end arithmetic screen is recorded in
[selected-panel-power-closure.md](selected-panel-power-closure.md); that page
retains the generic maximum-allocation **DENY** while showing the selected
panel's fit against the 40.60 W post-shunt ceiling.

## Fabrication and EVT gates

1. Purchase multiple samples of Adafruit product ID 2277 from the manufacturer
   or an authorized channel. Record the exact revision, LED-driver devices,
   power connector, IDC header, and any fitted configuration links.
2. Obtain a current Adafruit CAD drawing and overlay the 318 mm by 158 mm envelope,
   panel thickness, mounting holes, connector clearance, viewing window, and
   serviceable cable path against the enclosure. The public drawing repository
   is a source for review, not an imported production footprint.
3. Verify the input header pin order and continuity on the exact sample.
   Confirm that the panel does not require an `E` address line; the current 64x32
   carrier exposes `A` through `D` only. A panel revision requiring another
   address line is incompatible until the carrier and GPIO allocation are
   re-reviewed.
4. With the panel at its declared brightness and refresh settings, capture
   black, normal content, maximum allowed full-white, startup, and repeated
   event-animation current. Measure panel-end voltage, cable drop, connector
   temperature, buffer output waveforms, ghosting, and OE blanking.
5. Test ESP32 reset, brownout, watchdog, USB service attach, and power removal
   while the panel is powered and while it is unpowered. The panel must remain
   blank and must not back-power an ESP32 GPIO.
6. Close the blocked-vent 50 C system thermal test with the exact panel, power
   harness, speaker, Ethernet traffic, radio activity, and scoring load. Keep
   `productionApproved: false` until every gate is evidenced.

## Sources

- [Adafruit 64x32 RGB LED Matrix, product ID 2277](https://www.adafruit.com/product/2277)
- [Adafruit RGB matrix electrical guidance](https://learn.adafruit.com/32x16-32x32-rgb-led-matrix)
- [Adafruit Raspberry Pi matrix guide](https://learn.adafruit.com/raspberry-pi-led-matrix-display)
- [Waveshare RGB-Matrix-P4-64x32 alternate candidate](https://www.waveshare.com/product/modules/rgb-matrix-p4-64x32.htm) (not selected: its published HUB75 definition includes an `E` address line and requires a separate pinout review)
- [Carrier safe blanking and panel-level verification gates](reset-and-display-safing.md)
- [USB-C power budget and display allocation](usb-c-power-budget.md)

## Hash-bound source record

The exact Adafruit product page for `2277`, and the selected Adafruit signal
and power cable pages (`4170` and `4767`), were acquired on 2026-08-24 and
retained with SHA-256 digests in
[`evidence/bp-143`](evidence/bp-143). The same evidence set contains the
manufacturer Samtec TST product/print sources and JST SM series specification
for the exact BP-143 header and power-mate identities. The complete URL and
digest table is maintained in
[the BP-143 connector record](bench-prototype-hub75-connector.md#acquired-source-snapshots)
and is executable in
[`src/display-panel-readiness.ts`](../src/display-panel-readiness.ts).

These are manufacturer/vendor source bytes only. They do not claim that a
panel, cable, connector, or mating assembly has been purchased, received,
measured, fitted, or tested. The panel's current, cable drop, connector
temperature, continuity, physical fit, CAD, fabrication, and all release
decisions remain downstream gates. `productionApproved` stays `false` and the
USB-C PD and display power **DENY** gates are unchanged.
