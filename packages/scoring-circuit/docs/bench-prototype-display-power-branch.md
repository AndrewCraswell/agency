# BP-055 protected HUB75 display-power branch

**Status:** exact paper contract frozen for the one-board bench prototype. The
selected panel, branch current, limiter, fuse, connector, disconnect, and
removable measurement link are explicit. Panel connection, startup, inrush,
cable, current-sharing, temperature, backfeed, layout, and fabrication remain
denied.

The executable contract is
[`src/bench-prototype-display-power-branch.ts`](../src/bench-prototype-display-power-branch.ts),
with focused coverage in
[`src/bench-prototype-display-power-branch.test.ts`](../src/bench-prototype-display-power-branch.test.ts).
It consumes the BP-050 display-branch contract and the BP-143 panel and power
mating contract, but does not change either upstream artifact or the board
source.

## Frozen identities

| Function | Exact selection | Contracted role |
| --- | --- | --- |
| Display limiter `U_DISPLAY_LIMITER` | Texas Instruments `TPS259474ARPWR` | V5 input to `V5_DISPLAY_LIMITED`, circuit-breaker auto-retry, 110 ms retry delay |
| Limiter current programming `R_DISPLAY_ILM` | Yageo `RC0402FR-07698RL` | 698 Ohm, 1 percent resistor from ILM to `APP_GND`; `I_LIMIT = 3334 / R_ILM` |
| Display fuse `F_DISPLAY` | Littelfuse `045106.3MRL` | 6.3 A 451 MRL series fuse; 25 percent continuous derating gives a 4.725 A screen |
| Branch disconnect `J_DISPLAY_DISCONNECT` | Molex Micro-Fit 3.0 `43650-0200`, mate `43645-0200`, contacts `43030-0007` | Two-position, 3.00 mm pitch, right-angle through-hole service boundary, 7 A per-contact candidate rating |
| Removable measurement link `J_LINK_DISPLAY` | Molex `39-28-1023`, mate `39-01-2020`, contacts `39-00-0039` | Two-pin loopback boundary between `V5_DISPLAY_LIMITED` and `V5_DISPLAY_LOAD`; 6 A project screen |
| Panel power pigtail `J_DISPLAY_POWER_PIGTAIL` | Adafruit `4767` with JST `SMR-04V-N` / `SYM-001T-P0.6` and `SMP-04V-NC` / `SHF-001T-0.8BS` | Two four-conductor branches, two parallel V5 contacts and two parallel return contacts per branch |

The disconnect is deliberately a separate service boundary from the panel
power pigtail. Its open state means that no panel-side power is connected. The
measurement link is a diagnostic loopback or meter insertion point, never an
alternate source or a bypass around the limiter and fuse.

## Electrical path

```text
V5
  -> J_DISPLAY_DISCONNECT
  -> V5_DISPLAY_IN
  -> U_DISPLAY_LIMITER (TPS259474ARPWR)
  -> V5_DISPLAY_LIMITED
  -> F_DISPLAY (045106.3MRL)
  -> J_LINK_DISPLAY
  -> J_DISPLAY_POWER_PIGTAIL
  -> Adafruit 4767 branches
  -> Adafruit 2277 panel V5 / APP_GND
```

The two red conductors on each Adafruit 4767 branch are `V5_DISPLAY_LIMITED`.
The two black conductors are `APP_GND`. The three HUB75 signal-header ground
pins remain logic references only and do not carry panel current. A missing,
swapped, or unverified power contact is a stop condition.

The `TPS259474ARPWR` support network remains the BP-050 selection: its local
input bypass, 22 uF input and output capacitors, 698 Ohm ILM resistor, 2.2 nF
ITIMER capacitor, 2.2 nF DVDT capacitor, and voltage-window parts remain
required or explicitly DNP according to that upstream contract. BP-055 owns
the branch boundary and does not silently add another eFuse or telemetry IC.

## Current envelope

The selected panel is Adafruit product `2277`, a 64 by 32 RGB LED Matrix at
5 V. Its published full-white allowance is approximately 4 A, represented as
20 W continuous and 20 W for the 100 ms peak screen. This is a published
panel envelope, not measured startup current, cable ampacity, connector
sharing, or thermal behavior.

The 698 Ohm ILM selection produces these current-limit screens:

| Quantity | Value |
| --- | ---: |
| Nominal limiter current | 4.7765 A |
| Worst-low limiter current | 4.2563 A |
| Worst-high limiter current | 5.3072 A |
| Selected panel current | 4.0000 A |
| Worst-low limiter headroom | 0.2563 A |
| Fuse nominal rating | 6.3000 A |
| Fuse 25 percent derated continuous screen | 4.7250 A |

The selected-panel arithmetic also fits the current provisional upstream
budget in both modes:

| Quantity | Continuous | 100 ms screen |
| --- | ---: | ---: |
| Panel current | 4.000 A | 4.000 A |
| Panel power | 20.000 W | 20.000 W |
| Total V5 load | 26.959 W | 30.465 W |
| USB-C source demand | 32.716 W / 1.636 A | 36.841 W / 1.842 A |
| Worst-low upstream eFuse limit | 2.396 A | 2.396 A |
| Worst-low eFuse headroom | 0.760 A | 0.554 A |
| Guaranteed V5 output ceiling | 40.730 W | 40.730 W |
| V5 output headroom | 13.771 W | 10.265 W |
| Arithmetic fit | PASS | PASS |

The arithmetic pass does not approve a panel connection. Startup and inrush
remain an `unmeasured-gate`; the 100 ms line is not an inrush rating.

## Safe-off state and service procedure

The default BP-055 state is `safe-off` with `releaseState: deny`:

- `J_DISPLAY_DISCONNECT` is open.
- `J_LINK_DISPLAY` is removed or open, with no loopback shunt installed while
  the branch is energized.
- `J_DISPLAY_POWER_PIGTAIL` is disconnected from the panel.
- USB-C is disconnected and `V5`, `V5_DISPLAY_LIMITED`, and panel-side
  capacitance are verified discharged before a connector or link is handled.
- HUB75 buffers are disabled, their outputs are high impedance, and panel OE
  is inactive or high. Signal pins are not credited as a power-off mechanism.
- No panel-side voltage, cable current, or thermal evidence is inferred from
  the limiter state or from a missing panel.

Installing or removing the disconnect, measurement link, or power pigtail is
permitted only after source removal and discharge verification. A limiter
trip, reset, brownout, missing power contact, unexpected backfeed, or missing
measurement record leaves the branch denied.

## Release gates

Before allowing a panel connection, the bench record must identify the exact
2277 revision and the received connector assemblies, prove continuity and
polarity for both four-contact branches, and capture startup peak current,
duration, panel-end droop, cable drop, branch current sharing, limiter retry
behavior, fuse temperature, connector temperature, and blocked-vent thermal
behavior. Repeat the run after warm-up at the declared maximum brightness and
refresh setting with the scoring, Ethernet, and Wi-Fi loads active.

The power-off and backfeed matrix must measure both `V3_3` absent with V5
present and V5 absent with `V3_3` present. It must include panel OE, HUB75
buffer pins, ESP32 pins, rail currents, injected current, and panel-side
voltage. A de-energized cable insertion and removal trace is required.

BP-055 therefore freezes a reviewable branch contract but grants no
schematic integration, footprint, layout, assembly, or fabrication approval.
