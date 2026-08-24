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
with at least a 3 mm radial copper/component keepout until the released Vishay
drawing is checked. Keep the receiver and `TP_IR_RX` in `APP_GND` on the
application side of the scoring isolation boundary and do not place the lens
behind the HUB75 panel or tinted material.

The Vishay values are typical design references, not prototype acceptance
claims:

- 2.0 to 5.5 V supply, nominal 3.3 V;
- nominal 30 m transmission test distance with Vishay's laboratory TSAL6200
  test source, which does not establish handheld range;
- ±45° half-transmission directivity;
- 184 to 342 us output delay for the 38 kHz qualifying burst;
- active-low output with 100 mV maximum low under the cited test condition.

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
The exact receiver, support MPN records, footprint/CAD, optical keepout, and
all bench evidence remain open gates; this BP-146 unit does not authorize
schematic integration or fabrication.

## Primary manufacturer sources

- [Vishay TSOP382/TSOP384 datasheet, Rev. 2.1, 27 May 2025](https://www.vishay.com/docs/82491/tsop382.pdf)
- [Vishay IR receiver product records](https://www.vishay.com/en/ir-receiver-modules/mitsubishi/)
- [YAGEO RC0603FR-07100RL product record](https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL)
- [YAGEO RC0603FR-0710KL product record](https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL)
- [KEMET C0603C104K3RACTU product record](https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU)
- [Keystone terminals and test points catalog](https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf)
- [Espressif ESP32-S3-WROOM-1/1U datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
