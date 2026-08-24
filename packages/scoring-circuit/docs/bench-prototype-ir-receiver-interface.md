# BP-126 encrypted-IR receiver interface reconciliation

## Decision

**Interface selected, receiver hardware DENY.** BP-121 now allocates GPIO35,
module pad 28, as the application-only `IR_RX` input using the ESP32-S3 `RMT_RX`
peripheral. The executable contract is
[`src/bench-prototype-ir-receiver-interface.ts`](../src/bench-prototype-ir-receiver-interface.ts),
with focused regression coverage in
[`src/bench-prototype-ir-receiver-interface.test.ts`](../src/bench-prototype-ir-receiver-interface.test.ts).

This is an interface-allocation decision, not receiver hardware selection.
`BP-146` remains responsible for the exact receiver/decoder MPN, optical path,
carrier, protection, and measured range/latency evidence. The encrypted IR
behavior and security boundary remain defined by
[`apps/scoring/docs/encrypted-ir-remote-control-contract.md`](../../../apps/scoring/docs/encrypted-ir-remote-control-contract.md).

## Reconciled conflicts

| Candidate | Current BP-121 owner and prior owner | Result | Required tradeoff |
| --- | --- | --- | --- |
| GPIO3, module pad 15 | `NC_STRAP_QUIET` | Denied | Reopen BP-121 with a reset-isolated receiver front end that guarantees the strap state through boot sampling, then measure boot/eFuse and power-off behavior. A raw receiver output is prohibited. |
| GPIO35, module pad 28 | Current: `IR_RX`/`RMT_RX`; prior: `I2S_BCLK` for `TAS2505TRGERQ1` U_AUDIO, now DNP under BP-145 | Selected as `IR_RX`/`RMT_RX` | Audio remains DNP. Re-enabling it requires a new BP-121 allocation review. |
| GPIO36, module pad 29 | `NC_AUDIO_DNP_WS` | Denied | Reserved NC; no host routing. |
| GPIO37, module pad 30 | `NC_AUDIO_DNP_DOUT` | Denied | Reserved NC; no host routing. |
| GPIO19/GPIO20, module pads 13/14 | Protected native USB2 `USB_DN`/`USB_DP` | Denied | USB data and its matched protection/series network remain fixed. |
| All other exposed assigned GPIOs | Isolated SPI, W5500/F-RAM SPI, HUB75, UART/boot recovery, I2C, watchdog/heartbeats, or isolation-adjacent service | Denied | Reassigning one would drop a required interface or safety function. |
| GPIO26–GPIO32 | Internal flash/PSRAM and not exposed by N16R2 | Denied | Module substitution or flash/PSRAM changes are outside BP-126. |
| GPIO33/GPIO34 | Not exposed by N16R2 | Denied | Never allocate. |

The selected capture peripheral is the ESP32-S3 RMT RX input for bounded
carrier/pulse timing. A generic I2C GPIO expander is not a timing solution and
receives no BP-126 credit without measured capture evidence.

## Required cumulative BP-146 evidence before BP-126 can pass

BP-146 must close every item below for the selected `GPIO35/IR_RX` interface:

1. Exact receiver/demodulator or decoder MPN and approved electrical interface.
2. Reset/boot electrical idle and power-off isolation.
3. RMT pulse timing plus bounded frame/decode work.
4. Bounded queue depth, rate, and overflow disposition.
5. Stuck-active, stuck-inactive, noise, flooding, and fault-isolation behavior.

There is no accepted alternate GPIO, generic expander, or decoder shortcut. If
the selected interface cannot satisfy these cumulative gates, return BP-126 to
BP-121 for a deliberate allocation review.

Until then, the `IR_RX` interface is selected but no receiver hardware or
decoder receives schematic or fabrication credit.

## Invariants

Regardless of the eventual tradeoff, the receiver path must remain in
`APP_GND`, terminate in an authenticated bounded application queue, and never
directly reach STM32 scoring, qualification, lamps, buzzer, or reset. Receiver
loss, continuous noise, flooding, ESP32 reset, or a stuck input must leave
scoring state unchanged and must not defeat the hardware watchdog or UART
recovery path.
